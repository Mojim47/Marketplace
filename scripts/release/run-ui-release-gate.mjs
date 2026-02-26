import { spawn } from 'node:child_process';
import net from 'node:net';

const DEFAULT_WEB_PORT = Number.parseInt(process.env.UI_WEB_PORT ?? '3000', 10);
const DEFAULT_ADMIN_PORT = Number.parseInt(process.env.UI_ADMIN_PORT ?? '3003', 10);
const COLD_START_RUNS = Math.max(
  1,
  Number.parseInt(process.env.UI_GATE_COLD_START_RUNS ?? '2', 10) || 2
);

function buildBaseEnv(webPort, adminPort) {
  return {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    UI_SERVER_ALREADY_RUNNING: 'true',
    UI_WEB_PORT: String(webPort),
    UI_ADMIN_PORT: String(adminPort),
    ADMIN_DISABLE_AUTH_MIDDLEWARE: 'true',
    AUTH_MODE: 'mock',
    ALLOW_AUTH_MOCK: 'true',
    PROD_STRICT_POLICY: 'false',
    CSP_API_DOMAIN: process.env.CSP_API_DOMAIN ?? 'api.example.com',
    CSP_CDN_DOMAIN: process.env.CSP_CDN_DOMAIN ?? 'cdn.example.com',
    CSP_ANALYTICS_DOMAIN: process.env.CSP_ANALYTICS_DOMAIN ?? 'analytics.example.com',
  };
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true, env });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function startServer(command, args, env) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env,
  });
}

function waitForProcessExit(proc, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!proc) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => resolve(), timeoutMs);
    proc.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function reservePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    const bind = (port) => {
      server.listen(port);
    };

    server.once('error', () => {
      bind(0);
    });

    server.once('listening', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to reserve numeric port')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });

    bind(preferredPort);
  });
}

async function stopServer(proc) {
  if (!proc || proc.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32' && proc.pid) {
    const killer = spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    await waitForProcessExit(killer, 10000);
  } else {
    proc.kill('SIGTERM');
    await waitForProcessExit(proc, 5000);
    if (proc.exitCode === null) {
      proc.kill('SIGKILL');
      await waitForProcessExit(proc, 3000);
    }
  }
}

async function waitFor(url, timeoutMs = 90000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const initialWebPort = await reservePort(DEFAULT_WEB_PORT);
  const initialAdminPort = await reservePort(DEFAULT_ADMIN_PORT);
  const buildEnv = buildBaseEnv(initialWebPort, initialAdminPort);

  await run('pnpm', ['--filter', '@nextgen/web', 'build'], buildEnv);
  await run('pnpm', ['--filter', '@nextgen/admin', 'build'], buildEnv);

  for (let runIndex = 1; runIndex <= COLD_START_RUNS; runIndex += 1) {
    console.log(`[ui-gate] cold-start run ${runIndex}/${COLD_START_RUNS}`);
    const runWebPort = await reservePort(DEFAULT_WEB_PORT + runIndex);
    const runAdminPort = await reservePort(DEFAULT_ADMIN_PORT + runIndex);
    const runEnv = buildBaseEnv(runWebPort, runAdminPort);

    const webServer = startServer(
      'pnpm',
      ['--filter', '@nextgen/web', 'exec', 'next', 'start', '--port', String(runWebPort)],
      { ...runEnv, PORT: String(runWebPort) }
    );
    const adminServer = startServer(
      'pnpm',
      ['--filter', '@nextgen/admin', 'exec', 'next', 'start', '--port', String(runAdminPort)],
      { ...runEnv, PORT: String(runAdminPort) }
    );

    try {
      await waitFor(`http://localhost:${runWebPort}/livez`);
      await waitFor(`http://localhost:${runAdminPort}/livez`);

      await run(
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          'tests/ui/playwright/web.commerce-critical.e2e.spec.ts',
          'tests/ui/playwright/web.commerce-resilience.e2e.spec.ts',
          '-c',
          'playwright.ui.config.ts',
          '--project=web',
        ],
        runEnv
      );

      if (runIndex === COLD_START_RUNS) {
        await run('pnpm', ['ui:lighthouse'], runEnv);
      }
    } finally {
      await stopServer(adminServer);
      await stopServer(webServer);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { spawn } from 'child_process';
import net from 'net';

const DEFAULT_WEB_PORT = Number.parseInt(process.env.UI_WEB_PORT ?? '3100', 10);
const DEFAULT_ADMIN_PORT = Number.parseInt(process.env.UI_ADMIN_PORT ?? '3103', 10);

const baseEnv = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  ADMIN_DISABLE_AUTH_MIDDLEWARE: 'true',
  AUTH_MODE: 'mock',
  ALLOW_AUTH_MOCK: 'true',
  CSP_API_DOMAIN: process.env.CSP_API_DOMAIN ?? 'api.example.com',
  CSP_CDN_DOMAIN: process.env.CSP_CDN_DOMAIN ?? 'cdn.example.com',
  CSP_ANALYTICS_DOMAIN: process.env.CSP_ANALYTICS_DOMAIN ?? 'analytics.example.com',
};

function run(command, args = [], env = baseEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true, env });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function reservePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    const bind = (port) => {
      server.listen(port, '127.0.0.1');
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

async function waitFor(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startServer(command, args = [], envOverrides = {}) {
  return spawn(command, args, { stdio: 'inherit', shell: true, env: { ...baseEnv, ...envOverrides } });
}

async function stopServer(proc) {
  if (!proc || proc.killed) return;
  proc.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (!proc.killed) proc.kill('SIGKILL');
}

async function main() {
  const webPort = await reservePort(DEFAULT_WEB_PORT);
  const adminPort = await reservePort(DEFAULT_ADMIN_PORT);

  await run('pnpm', ['ui:tokens:check']);
  await run('pnpm', ['ui:drift:check']);
  await run('pnpm', ['ui:anti-patterns']);
  await run('pnpm', ['ui:events']);

  await run('pnpm', ['--filter', '@nextgen/web', 'build']);
  await run('pnpm', ['--filter', '@nextgen/admin', 'build']);

  const webServer = startServer(
    'pnpm',
    ['--filter', '@nextgen/web', 'exec', 'next', 'start', '--port', String(webPort)],
    { PORT: String(webPort) }
  );
  const adminServer = startServer(
    'pnpm',
    ['--filter', '@nextgen/admin', 'exec', 'next', 'start', '--port', String(adminPort)],
    { PORT: String(adminPort) }
  );

  try {
    await waitFor(`http://localhost:${webPort}/livez`);
    await waitFor(`http://localhost:${adminPort}/livez`);

    const testEnv = {
      ...baseEnv,
      UI_SERVER_ALREADY_RUNNING: 'true',
      UI_WEB_PORT: String(webPort),
      UI_ADMIN_PORT: String(adminPort),
    };
    await run('pnpm', ['ui:playwright'], testEnv);
    await run('pnpm', ['ui:pa11y'], testEnv);
    await run('pnpm', ['ui:lighthouse'], testEnv);
    await run('pnpm', ['ui:phase1:report'], testEnv);
  } finally {
    await stopServer(adminServer);
    await stopServer(webServer);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PRODUCTION_HARDENING_CONTRACT_PATH || 'ops/contracts/production-hardening-contract.json'
);
const reportPath = path.resolve(
  repoRoot,
  process.env.LOAD_TEST_REPORT_PATH || 'artifacts/release/load-test-report.json'
);
const apiPort = Number.parseInt(process.env.API_PORT || '4012', 10);
const baseUrl = process.env.LOAD_GATE_BASE_URL || `http://127.0.0.1:${apiPort}`;
const startLocalApi = (process.env.LOAD_GATE_START_LOCAL_API || 'true').toLowerCase() === 'true';
const startupTimeoutMs = Number.parseInt(process.env.LOAD_GATE_STARTUP_TIMEOUT_MS || '45000', 10);
const requestTimeoutMs = Number.parseInt(process.env.LOAD_GATE_REQUEST_TIMEOUT_MS || '3000', 10);
const totalRequests = Number.parseInt(process.env.LOAD_GATE_TOTAL_REQUESTS || '600', 10);
const concurrency = Number.parseInt(process.env.LOAD_GATE_CONCURRENCY || '40', 10);
const apiDistEntry = path.resolve(repoRoot, 'dist/apps/api/src/main.js');
const effectiveDatabaseUrl =
  process.env.DATABASE_URL ||
  process.env.LOAD_GATE_DATABASE_URL ||
  'postgresql://nextgen:nextgen123@127.0.0.1:5432/nextgen_marketplace';
const effectiveRedisUrl =
  process.env.REDIS_URL || process.env.LOAD_GATE_REDIS_URL || 'redis://:nextgen123@127.0.0.1:6379/0';

function fail(message) {
  console.error(`[load-gate][fatal] ${message}`);
  process.exit(1);
}

function resolvePnpmCommand() {
  if (process.platform === 'win32') {
    return {
      cmd: 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm --filter @nextgen/api-v3 start'],
      shell: false,
    };
  }
  return { cmd: 'pnpm', args: ['--filter', '@nextgen/api-v3', 'start'], shell: false };
}

function resolveApiCommand() {
  if (fs.existsSync(apiDistEntry)) {
    return {
      cmd: process.execPath,
      args: [apiDistEntry],
      shell: false,
      description: `node ${path.relative(repoRoot, apiDistEntry)}`,
    };
  }
  const fallback = resolvePnpmCommand();
  return { ...fallback, description: `pnpm --filter @nextgen/api-v3 start` };
}

function normalizeMinioEndpoint(rawEndpoint, rawPort) {
  const endpoint = typeof rawEndpoint === 'string' ? rawEndpoint.trim() : '';
  const fallbackPort = Number.parseInt(String(rawPort || '9000'), 10) || 9000;
  if (!endpoint) {
    return null;
  }

  try {
    const parsed = new URL(endpoint);
    if (parsed.hostname) {
      const parsedPort = Number.parseInt(parsed.port || String(fallbackPort), 10);
      return {
        endpoint: parsed.hostname,
        port: Number.isNaN(parsedPort) ? fallbackPort : parsedPort,
      };
    }
  } catch {}

  if (endpoint.includes(':')) {
    const [host, portText] = endpoint.split(':');
    const parsedPort = Number.parseInt(portText || String(fallbackPort), 10);
    return {
      endpoint: host || endpoint,
      port: Number.isNaN(parsedPort) ? fallbackPort : parsedPort,
    };
  }

  return { endpoint, port: fallbackPort };
}

async function waitForHealth(url, timeoutMs, getChildExitInfo) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const exitInfo = getChildExitInfo?.();
    if (exitInfo) {
      const signalPart = exitInfo.signal ? ` signal=${exitInfo.signal}` : '';
      throw new Error(
        `api process exited before health became ready (code=${String(exitInfo.code)}${signalPart})`
      );
    }
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status === 200) {
        return;
      }
    } catch {}
    await delay(500);
  }
  throw new Error(`timeout waiting for health: ${url}`);
}

function extractHostPortFromUrl(rawUrl, defaultPort) {
  if (!rawUrl) {
    return null;
  }
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname;
    const port = Number.parseInt(parsed.port || String(defaultPort), 10);
    if (!host || Number.isNaN(port)) {
      return null;
    }
    return { host, port };
  } catch {
    return null;
  }
}

function waitForTcp(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      fn(value);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(resolve));
    socket.on('timeout', () =>
      finish(reject, new Error(`tcp timeout to ${host}:${String(port)} after ${String(timeoutMs)}ms`))
    );
    socket.on('error', (error) => {
      finish(reject, error);
    });
  });
}

function formatConnectionError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (error.message) {
    return error.message;
  }
  const maybeCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : null;
  if (maybeCode) {
    return maybeCode;
  }
  if ('errors' in error && Array.isArray(error.errors) && error.errors.length > 0) {
    const first = error.errors[0];
    if (first instanceof Error && first.message) {
      return first.message;
    }
    if (first && typeof first === 'object' && 'code' in first) {
      return String(first.code);
    }
  }
  return error.name || 'unknown';
}

async function preflightDependencies() {
  const checks = [
    {
      name: 'postgres',
      details: extractHostPortFromUrl(effectiveDatabaseUrl, 5432),
    },
    {
      name: 'redis',
      details: extractHostPortFromUrl(effectiveRedisUrl, 6379),
    },
  ];

  for (const check of checks) {
    if (!check.details) {
      continue;
    }
    const { host, port } = check.details;
    try {
      await waitForTcp(host, port, 1500);
    } catch (error) {
      const reason = formatConnectionError(error);
      throw new Error(
        `dependency "${check.name}" unreachable at ${host}:${String(port)} (${reason}). ` +
          'Start local dependencies (for example: `docker-compose up -d postgres redis minio`) ' +
          'or set LOAD_GATE_START_LOCAL_API=false to target an existing healthy API.'
      );
    }
  }
}

async function timedFetch(target) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(`${baseUrl}${target.path}`, {
      method: target.method,
      headers: target.body ? { 'content-type': 'application/json' } : undefined,
      body: target.body ? JSON.stringify(target.body) : undefined,
      signal: controller.signal,
    });
    return {
      ok: res.status < 500,
      status: res.status,
      latencyMs: performance.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: performance.now() - started,
      error: error instanceof Error ? error.message : 'unknown',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function p95(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

async function runLoad() {
  const targets = [
    { method: 'GET', path: '/health/live' },
    { method: 'GET', path: '/health/ready' },
    { method: 'GET', path: '/metrics' },
  ];

  const startedAt = Date.now();
  const latencies = [];
  let completed = 0;
  let failures = 0;
  let serverErrors = 0;
  const byStatus = {};

  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= totalRequests) {
        return;
      }
      const target = targets[current % targets.length];
      const res = await timedFetch(target);
      completed += 1;
      latencies.push(res.latencyMs);
      byStatus[String(res.status)] = (byStatus[String(res.status)] || 0) + 1;
      if (!res.ok) {
        failures += 1;
      }
      if (res.status >= 500) {
        serverErrors += 1;
      }
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const elapsedMs = Math.max(1, Date.now() - startedAt);
  const throughputRps = (completed * 1000) / elapsedMs;
  const errorRate = completed === 0 ? 1 : failures / completed;
  const p95Ms = p95(latencies);

  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    totalRequests,
    concurrency,
    durationMs: elapsedMs,
    throughputRps,
    errorRate,
    serverErrorCount: serverErrors,
    latencyP95Ms: p95Ms,
    statusCounts: byStatus,
  };
}

function loadContractThresholds() {
  if (!fs.existsSync(contractPath)) {
    fail(`missing contract file: ${contractPath}`);
  }
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const loadThresholds = contract?.gates?.capacityLoadGate?.thresholds || {};
  const sloThresholds = contract?.gates?.sloErrorBudget?.thresholds || {};
  return {
    throughputRpsMin: Number(
      process.env.LOAD_GATE_THROUGHPUT_RPS_MIN || loadThresholds.throughputRpsMin || 100
    ),
    errorRateMax: Number(process.env.LOAD_GATE_ERROR_RATE_MAX || loadThresholds.errorRateMax || 0.01),
    latencyP95MsMax: Number(
      process.env.LOAD_GATE_LATENCY_P95_MS_MAX || sloThresholds.latencyP95MsMax || 500
    ),
  };
}

async function run() {
  const thresholds = loadContractThresholds();
  let child = null;
  let childExitInfo = null;
  try {
    if (startLocalApi) {
      await preflightDependencies();
      const { cmd, args, shell, description } = resolveApiCommand();
      console.log(`[load-gate] starting local api via ${description}`);
      const childEnv = {
        ...process.env,
        API_PORT: String(apiPort),
        NODE_ENV: process.env.NODE_ENV || 'production',
        DATABASE_URL: effectiveDatabaseUrl,
        REDIS_URL: effectiveRedisUrl,
        JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-ci-pipeline-minimum-32-chars',
        JWT_REFRESH_SECRET:
          process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-pipeline-minimum-32-chars',
        PRISMA_CLIENT_ENGINE_TYPE: 'binary',
        PRISMA_CLI_QUERY_ENGINE_TYPE: 'binary',
      };
      const minioConfig = normalizeMinioEndpoint(
        process.env.MINIO_ENDPOINT,
        process.env.MINIO_API_PORT || process.env.MINIO_PORT
      );
      childEnv.MINIO_ENDPOINT = minioConfig?.endpoint || '127.0.0.1';
      childEnv.MINIO_API_PORT = String(minioConfig?.port || 9000);
      delete childEnv.MINIO_PORT;
      child = spawn(cmd, args, {
        shell,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: childEnv,
      });
      child.stdout.on('data', (buf) => process.stdout.write(buf));
      child.stderr.on('data', (buf) => process.stderr.write(buf));
      child.on('exit', (code, signal) => {
        childExitInfo = { code, signal };
      });
      await waitForHealth(`${baseUrl}/health/live`, startupTimeoutMs, () => childExitInfo);
      await waitForHealth(`${baseUrl}/health/ready`, startupTimeoutMs, () => childExitInfo);
    }

    const report = await runLoad();
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify(
        {
          ...report,
          thresholds,
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const violations = [];
    if (report.throughputRps < thresholds.throughputRpsMin) {
      violations.push(
        `throughputRps=${report.throughputRps.toFixed(2)} below min=${thresholds.throughputRpsMin}`
      );
    }
    if (report.errorRate > thresholds.errorRateMax) {
      violations.push(
        `errorRate=${(report.errorRate * 100).toFixed(2)}% above max=${(thresholds.errorRateMax * 100).toFixed(2)}%`
      );
    }
    if (report.latencyP95Ms > thresholds.latencyP95MsMax) {
      violations.push(
        `latencyP95Ms=${report.latencyP95Ms.toFixed(2)} above max=${thresholds.latencyP95MsMax}`
      );
    }

    if (violations.length > 0) {
      fail(`capacity gate failed: ${violations.join(' | ')} (report=${reportPath})`);
    }

    console.log(
      `[load-gate] passed throughput=${report.throughputRps.toFixed(2)}rps errorRate=${(report.errorRate * 100).toFixed(2)}% p95=${report.latencyP95Ms.toFixed(2)}ms report=${reportPath}`
    );
  } finally {
    if (child) {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', shell: false });
      } else {
        child.kill('SIGTERM');
        await delay(500);
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }
    }
  }
}

run().catch((error) => fail(error instanceof Error ? error.message : 'unknown'));

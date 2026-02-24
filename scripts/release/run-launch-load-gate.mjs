#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
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

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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
  try {
    if (startLocalApi) {
      const { cmd, args, shell } = resolvePnpmCommand();
      child = spawn(cmd, args, {
        shell,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          API_PORT: String(apiPort),
          NODE_ENV: process.env.NODE_ENV || 'production',
          DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/nextgen_ci',
          REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
          JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-ci-pipeline-minimum-32-chars',
        },
      });
      child.stdout.on('data', (buf) => process.stdout.write(buf));
      child.stderr.on('data', (buf) => process.stderr.write(buf));
      await waitForHealth(`${baseUrl}/health/live`, startupTimeoutMs);
      await waitForHealth(`${baseUrl}/health/ready`, startupTimeoutMs);
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
      child.kill('SIGTERM');
      await delay(500);
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
  }
}

run().catch((error) => fail(error instanceof Error ? error.message : 'unknown'));

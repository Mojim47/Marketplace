#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createWriteStream, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const API_PORT = Number.parseInt(process.env.API_PORT || '4010', 10);
const BASE_URL = process.env.API_BASE_URL || `http://127.0.0.1:${API_PORT}`;
const BOOTSTRAP_TIMEOUT_MS = Number.parseInt(process.env.BOOTSTRAP_TIMEOUT_MS || '45000', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '2500', 10);
const ERROR_BUDGET_RATIO = Number.parseFloat(process.env.ERROR_BUDGET_RATIO || '0.005');
const LATENCY_P95_SLO_SECONDS = Number.parseFloat(process.env.LATENCY_P95_SLO_SECONDS || '0.4');
const METRIC_ROUTE_CARDINALITY_MAX = Number.parseInt(
  process.env.METRIC_ROUTE_CARDINALITY_MAX || '50',
  10
);
const LOAD_SIM_ENABLED = process.env.LOAD_SIM_ENABLED !== 'false';
const LOAD_SIM_CONCURRENCY = Number.parseInt(process.env.LOAD_SIM_CONCURRENCY || '12', 10);
const LOAD_SIM_REQUESTS_PER_ROUTE = Number.parseInt(
  process.env.LOAD_SIM_REQUESTS_PER_ROUTE || '24',
  10
);
const LOG_PATH = process.env.BOOTSTRAP_LOG_PATH || 'api-bootstrap-observability.log';

const REQUIRED_LOG_FIELDS = ['timestamp', 'level', 'message'];

function fail(message) {
  console.error(`[gate] ${message}`);
  process.exit(1);
}

function parseMetricLine(line) {
  const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([0-9eE+\-.]+)$/.exec(line.trim());
  if (!match) {
    return null;
  }
  const [, name, , labelText = '', valueText] = match;
  const labels = {};
  if (labelText.length > 0) {
    for (const pair of labelText.split(',')) {
      const eq = pair.indexOf('=');
      if (eq < 0) {
        continue;
      }
      const key = pair.slice(0, eq).trim();
      const raw = pair.slice(eq + 1).trim();
      labels[key] = raw.replace(/^"|"$/g, '');
    }
  }
  return { name, labels, value: Number(valueText) };
}

function parsePrometheus(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) {
      continue;
    }
    const row = parseMetricLine(line);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

function approxQuantileFromHistogramBuckets(buckets, q) {
  if (buckets.length === 0) {
    return 0;
  }
  const sorted = [...buckets].sort((a, b) => a.le - b.le);
  const total = sorted[sorted.length - 1].count;
  if (total <= 0) {
    return 0;
  }
  const target = total * q;
  for (const bucket of sorted) {
    if (bucket.count >= target) {
      return bucket.le;
    }
  }
  return sorted[sorted.length - 1].le;
}

async function httpGet(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    const body = await response.text();
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function simulateLoad() {
  if (!LOAD_SIM_ENABLED) {
    return;
  }

  const routes = [
    { method: 'POST', path: '/checkout/init', body: {} },
    { method: 'GET', path: '/orders' },
    { method: 'POST', path: '/cart/items', body: { productId: 'missing', quantity: 1 } },
  ];

  const requests = [];
  for (const route of routes) {
    for (let i = 0; i < LOAD_SIM_REQUESTS_PER_ROUTE; i += 1) {
      requests.push(route);
    }
  }

  const execute = async (route) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}${route.path}`, {
        method: route.method,
        headers: {
          'content-type': 'application/json',
          'x-trace-id': `load-sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        },
        body: route.body ? JSON.stringify(route.body) : undefined,
        signal: controller.signal,
      });
      return response.status;
    } finally {
      clearTimeout(timeout);
    }
  };

  let idx = 0;
  const workers = Array.from({ length: LOAD_SIM_CONCURRENCY }, async () => {
    while (idx < requests.length) {
      const current = requests[idx];
      idx += 1;
      const status = await execute(current);
      if (status >= 500) {
        throw new Error(`load_sim_5xx:${current.method}:${current.path}:${status}`);
      }
    }
  });

  await Promise.all(workers);
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

async function waitForHealth(path, timeoutMs, isExited) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isExited()) {
      throw new Error(`api_process_exited_before_${path}`);
    }
    try {
      const res = await httpGet(path);
      if (res.status === 200) {
        return;
      }
    } catch {}
    await delay(500);
  }
  throw new Error(`timeout_waiting_${path}`);
}

function validateStructuredLogs(logText) {
  const lines = logText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'));

  if (lines.length === 0) {
    throw new Error('no_structured_log_lines_found');
  }

  let bootTransitions = 0;
  let httpRequestLines = 0;
  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    for (const field of REQUIRED_LOG_FIELDS) {
      if (!(field in obj)) {
        throw new Error(`structured_log_missing_field:${field}`);
      }
    }
    if (obj.type === 'boot_transition') {
      if (!obj.traceId || !obj.prevState || !obj.nextState || !obj.code) {
        throw new Error('boot_transition_schema_invalid');
      }
      bootTransitions += 1;
    }
    if (obj.message === 'http_request') {
      if (!obj.method || !obj.route || !('statusCode' in obj)) {
        throw new Error('http_request_schema_invalid');
      }
      httpRequestLines += 1;
    }
  }

  if (bootTransitions === 0) {
    throw new Error('missing_boot_transition_logs');
  }
  if (httpRequestLines === 0) {
    throw new Error('missing_http_request_logs');
  }
}

function validateRedAndSlo(metricsText) {
  const rows = parsePrometheus(metricsText);
  const httpTotals = rows.filter((r) => r.name === 'http_requests_total');
  const httpDurBuckets = rows.filter((r) => r.name === 'http_request_duration_seconds_bucket');

  if (httpTotals.length === 0) {
    throw new Error('missing_metric:http_requests_total');
  }
  if (httpDurBuckets.length === 0) {
    throw new Error('missing_metric:http_request_duration_seconds_bucket');
  }

  const routeSet = new Set(httpTotals.map((r) => r.labels.route || ''));
  if (routeSet.size > METRIC_ROUTE_CARDINALITY_MAX) {
    throw new Error(`metric_cardinality_exceeded:${routeSet.size}`);
  }

  let total = 0;
  let errors = 0;
  for (const row of httpTotals) {
    const count = row.value;
    const statusCode = row.labels.status_code || '';
    total += count;
    if (statusCode.startsWith('5')) {
      errors += count;
    }
  }
  if (total <= 0) {
    throw new Error('empty_http_traffic_for_slo');
  }

  const errorRatio = errors / total;
  if (errorRatio > ERROR_BUDGET_RATIO) {
    throw new Error(`error_budget_breached:${errorRatio.toFixed(6)}`);
  }

  const aggregateBuckets = new Map();
  for (const row of httpDurBuckets) {
    const le = Number(row.labels.le);
    if (Number.isNaN(le)) {
      continue;
    }
    aggregateBuckets.set(le, (aggregateBuckets.get(le) || 0) + row.value);
  }

  const bucketPairs = Array.from(aggregateBuckets.entries()).map(([le, count]) => ({ le, count }));
  const p95 = approxQuantileFromHistogramBuckets(bucketPairs, 0.95);
  if (p95 > LATENCY_P95_SLO_SECONDS) {
    throw new Error(`latency_p95_slo_breached:${p95.toFixed(3)}`);
  }
}

async function run() {
  const { cmd, args, shell } = resolvePnpmCommand();
  const logStream = createWriteStream(LOG_PATH, { flags: 'w' });
  const child = spawn(cmd, args, {
    shell,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      API_PORT: String(API_PORT),
      NODE_ENV: process.env.NODE_ENV || 'production',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/nextgen_ci',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      JWT_SECRET:
        process.env.JWT_SECRET || 'test-jwt-secret-for-ci-pipeline-minimum-32-chars',
    },
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  let exitedEarly = false;
  child.on('exit', () => {
    exitedEarly = true;
  });

  try {
    await waitForHealth('/health/live', BOOTSTRAP_TIMEOUT_MS, () => exitedEarly);
    const ready = await httpGet('/health/ready');
    if (ready.status !== 200) {
      throw new Error(`health_ready_failed:${ready.status}`);
    }
    const startup = await httpGet('/health/startup');
    if (startup.status !== 200) {
      throw new Error(`health_startup_failed:${startup.status}`);
    }

    await simulateLoad();

    const metrics = await httpGet('/metrics');
    if (metrics.status !== 200) {
      throw new Error(`metrics_endpoint_failed:${metrics.status}`);
    }

    validateRedAndSlo(metrics.body);

    await delay(250);
    const logText = readFileSync(LOG_PATH, 'utf8');
    validateStructuredLogs(logText);

    if (exitedEarly) {
      throw new Error('api_process_exited_early');
    }

    console.log('[gate] bootstrap + observability gate passed');
  } finally {
    child.kill('SIGTERM');
    await delay(500);
    if (!child.killed) {
      child.kill('SIGKILL');
    }
    logStream.end();
  }
}

run().catch((error) => {
  const reason = error instanceof Error ? error.message : 'unknown_gate_error';
  fail(reason);
});

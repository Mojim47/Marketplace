#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PRODUCTION_HARDENING_CONTRACT_PATH || 'ops/contracts/production-hardening-contract.json'
);

const metricsUrl = process.env.LIVE_METRICS_URL;
const authToken = process.env.LIVE_METRICS_AUTH_TOKEN || '';
const timeoutMs = Number.parseInt(process.env.LIVE_METRICS_TIMEOUT_MS || '5000', 10);

function fail(message) {
  console.error(`[live-metrics-gate][fatal] ${message}`);
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

function loadThresholds() {
  if (!fs.existsSync(contractPath)) {
    fail(`missing contract file: ${contractPath}`);
  }
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const slo = contract?.gates?.sloErrorBudget?.thresholds || {};
  const load = contract?.gates?.capacityLoadGate?.thresholds || {};
  return {
    errorRateMax: Number(process.env.LIVE_METRICS_ERROR_RATE_MAX || load.errorRateMax || 0.01),
    latencyP95MsMax: Number(process.env.LIVE_METRICS_LATENCY_P95_MS_MAX || slo.latencyP95MsMax || 500),
    burnRate1hMax: Number(process.env.LIVE_METRICS_BURN_RATE_1H_MAX || slo.burnRate1hMax || 1),
    burnRate6hMax: Number(process.env.LIVE_METRICS_BURN_RATE_6H_MAX || slo.burnRate6hMax || 1),
  };
}

async function fetchMetrics() {
  if (!metricsUrl) {
    fail('LIVE_METRICS_URL is required');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(metricsUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      fail(`metrics endpoint returned status=${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateMetrics(metricsText, thresholds) {
  const rows = parsePrometheus(metricsText);
  if (rows.length === 0) {
    fail('empty metrics payload');
  }

  const httpTotals = rows.filter((r) => r.name === 'http_requests_total');
  const durBuckets = rows.filter((r) => r.name === 'http_request_duration_seconds_bucket');
  const burn1hRow = rows.find((r) => r.name === 'slo_error_budget_burn_rate_1h');
  const burn6hRow = rows.find((r) => r.name === 'slo_error_budget_burn_rate_6h');

  if (httpTotals.length === 0) {
    fail('missing http_requests_total metric');
  }
  if (durBuckets.length === 0) {
    fail('missing http_request_duration_seconds_bucket metric');
  }

  let total = 0;
  let errors = 0;
  for (const row of httpTotals) {
    const count = Number(row.value || 0);
    total += count;
    const code = String(row.labels.status_code || '');
    if (code.startsWith('5')) {
      errors += count;
    }
  }
  if (total <= 0) {
    fail('no HTTP traffic in metrics snapshot');
  }
  const errorRate = errors / total;

  const bucketByLe = new Map();
  for (const row of durBuckets) {
    const le = Number(row.labels.le);
    if (!Number.isFinite(le)) {
      continue;
    }
    bucketByLe.set(le, (bucketByLe.get(le) || 0) + Number(row.value || 0));
  }
  const p95Sec = approxQuantileFromHistogramBuckets(
    Array.from(bucketByLe.entries()).map(([le, count]) => ({ le, count })),
    0.95
  );
  const p95Ms = p95Sec * 1000;

  const burn1h = burn1hRow ? Number(burn1hRow.value) : 0;
  const burn6h = burn6hRow ? Number(burn6hRow.value) : 0;

  const violations = [];
  if (errorRate > thresholds.errorRateMax) {
    violations.push(
      `errorRate=${(errorRate * 100).toFixed(2)}% > max=${(thresholds.errorRateMax * 100).toFixed(2)}%`
    );
  }
  if (p95Ms > thresholds.latencyP95MsMax) {
    violations.push(`latencyP95Ms=${p95Ms.toFixed(2)} > max=${thresholds.latencyP95MsMax}`);
  }
  if (burn1h > thresholds.burnRate1hMax) {
    violations.push(`burnRate1h=${burn1h.toFixed(3)} > max=${thresholds.burnRate1hMax}`);
  }
  if (burn6h > thresholds.burnRate6hMax) {
    violations.push(`burnRate6h=${burn6h.toFixed(3)} > max=${thresholds.burnRate6hMax}`);
  }

  return {
    errorRate,
    latencyP95Ms: p95Ms,
    burnRate1h: burn1h,
    burnRate6h: burn6h,
    violations,
  };
}

async function run() {
  const thresholds = loadThresholds();
  const metricsText = await fetchMetrics();
  const evaluated = evaluateMetrics(metricsText, thresholds);

  if (evaluated.violations.length > 0) {
    fail(`live metrics gate blocked deploy: ${evaluated.violations.join(' | ')}`);
  }

  console.log(
    `[live-metrics-gate] passed errorRate=${(evaluated.errorRate * 100).toFixed(2)}% p95=${evaluated.latencyP95Ms.toFixed(2)}ms burn1h=${evaluated.burnRate1h.toFixed(3)} burn6h=${evaluated.burnRate6h.toFixed(3)}`
  );
}

run().catch((error) => fail(error instanceof Error ? error.message : 'unknown'));

#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PREFLIGHT_CONTRACT_PATH || 'ops/contracts/preflight-go-no-go-contract.json'
);
const mode = process.env.PREFLIGHT_MODE || 'staging';
const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
const metricsUrl = process.env.METRICS_URL || `${apiBaseUrl}/metrics`;
const releaseManifestPath = process.env.RELEASE_MANIFEST_PATH || 'artifacts/release/manifest.json';

function fail(message) {
  console.error(`[preflight][fatal] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      ...options
    });
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : '';
    const stdout = error?.stdout ? String(error.stdout) : '';
    fail(`command failed: ${command} ${args.join(' ')}\n${stderr || stdout}`);
  }
}

function checkHealthEndpoint(endpointPath) {
  const url = `${apiBaseUrl}${endpointPath}`;
  const status = run('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', url]).trim();
  if (status !== '200') {
    fail(`health check failed ${url} status=${status}`);
  }
}

if (!fs.existsSync(contractPath)) {
  fail(`missing preflight contract: ${contractPath}`);
}

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

if (!['staging', 'prod'].includes(mode)) {
  fail(`PREFLIGHT_MODE must be staging|prod, got ${mode}`);
}

const requiredEnv = Array.isArray(contract.requiredEnv) ? contract.requiredEnv : [];
for (const key of requiredEnv) {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    fail(`required environment missing: ${key}`);
  }
}

if ((process.env.JWT_SECRET || '').length < 32) {
  fail('JWT_SECRET must be at least 32 characters');
}

const envProductionFile = path.resolve(repoRoot, process.env.ENV_PRODUCTION_FILE);
if (!fs.existsSync(envProductionFile)) {
  fail(`ENV_PRODUCTION_FILE not found: ${envProductionFile}`);
}
if (envProductionFile.startsWith(repoRoot)) {
  fail('ENV_PRODUCTION_FILE must be outside repository');
}

run('node', ['scripts/release/validate-launch-graph.mjs']);
run('node', ['scripts/release/validate-state-machine-contract.mjs']);
run('node', ['scripts/release/verify-release-contract.mjs'], {
  env: { ...process.env, RELEASE_MANIFEST_PATH: releaseManifestPath }
});

const dbOut = run('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1;']).trim();
if (dbOut !== '1') {
  fail(`database connectivity failed, expected SELECT 1 => 1, got: ${dbOut}`);
}

const redisOut = run('redis-cli', ['-u', process.env.REDIS_URL, 'ping']).trim().toUpperCase();
if (redisOut !== 'PONG') {
  fail(`redis connectivity failed, expected PONG, got: ${redisOut}`);
}

const healthEndpoints = Array.isArray(contract.healthEndpoints) ? contract.healthEndpoints : [];
for (const endpointPath of healthEndpoints) {
  checkHealthEndpoint(endpointPath);
}

run('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
const migrationStatus = run('pnpm', ['exec', 'prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma']);
if (!/up to date|No pending migrations/i.test(migrationStatus)) {
  fail('prisma migrate status is not clean');
}

run('node', ['scripts/ai/verify-model-contract.mjs']);
run('node', ['scripts/ai/shadow-eval-gate.mjs']);

for (const key of ['AI_CANARY_MODEL_VERSION', 'AI_MODEL_CANARY_PERCENT', 'AI_SHADOW_EVAL_REPORT_PATH']) {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    fail(`AI canary/shadow readiness env missing: ${key}`);
  }
}

const canaryPercent = Number(process.env.AI_MODEL_CANARY_PERCENT);
if (!Number.isFinite(canaryPercent) || canaryPercent < 1 || canaryPercent > 50) {
  fail(`AI_MODEL_CANARY_PERCENT must be in range [1, 50], got ${process.env.AI_MODEL_CANARY_PERCENT}`);
}

const metricsSnapshot = run('curl', ['-sS', metricsUrl]);
const requiredMetrics = contract?.checks?.arTelemetryMetrics || [];
for (const metricName of requiredMetrics) {
  if (!metricsSnapshot.includes(metricName)) {
    fail(`required metrics missing: ${metricName}`);
  }
}

console.log(`[preflight] mode=${mode} full preflight go/no-go passed (fail-closed checks)`);

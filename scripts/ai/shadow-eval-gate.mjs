#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve(
  process.cwd(),
  process.env.AI_SHADOW_EVAL_REPORT_PATH || 'ops/assets/ai/models/shadow-eval.report.json'
);
const thresholdOverride = process.env.AI_SHADOW_DRIFT_THRESHOLD;
const autoRollback = process.env.AI_AUTO_ROLLBACK_ON_DRIFT === 'true';
const rollbackScript =
  process.env.AI_AUTO_ROLLBACK_SCRIPT_PATH || path.join('scripts', 'ai', 'auto-rollback-model.mjs');

function fail(message) {
  console.error(`[shadow-gate][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(reportPath)) {
  fail(`shadow evaluation report missing: ${reportPath}`);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
} catch (_error) {
  fail(`invalid JSON in ${reportPath}`);
}

const averageDrift = Number(report.averageDrift);
const maxDrift = Number(report.maxDrift);
const threshold = Number(thresholdOverride ?? report.threshold ?? 0.45);

if (!Number.isFinite(averageDrift) || !Number.isFinite(maxDrift) || !Number.isFinite(threshold)) {
  fail('averageDrift, maxDrift and threshold must be finite numbers');
}

const driftExceeded = averageDrift > threshold || maxDrift > threshold * 1.5;
if (driftExceeded) {
  console.error(
    `[shadow-gate] drift exceeded average=${averageDrift} max=${maxDrift} threshold=${threshold}`
  );
  if (autoRollback) {
    try {
      execFileSync('node', [rollbackScript], {
        stdio: 'inherit',
        env: {
          ...process.env,
          AI_ROLLBACK_REASON: 'shadow_eval_gate_failed',
          AI_ROLLBACK_TRACE_ID: `shadow-gate-${Date.now()}`,
        },
      });
    } catch (_error) {
      fail(`auto rollback command failed: ${rollbackScript}`);
    }
  }
  process.exit(1);
}

console.log(
  `[shadow-gate] healthy model=${report.modelVersion} shadow=${report.shadowModelVersion} average=${averageDrift} max=${maxDrift} threshold=${threshold}`
);

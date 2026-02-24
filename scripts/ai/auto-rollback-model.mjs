#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const registryPath = path.resolve(
  process.cwd(),
  process.env.AI_MODEL_ROLLOUT_REGISTRY || 'ops/assets/ai/models/rollout.registry.json'
);

function fail(message) {
  console.error(`[ai-rollback][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(registryPath)) {
  fail(`rollout registry not found: ${registryPath}`);
}

const raw = fs.readFileSync(registryPath, 'utf-8');
let registry;
try {
  registry = JSON.parse(raw);
} catch (_error) {
  fail(`invalid JSON: ${registryPath}`);
}

const targetVersion = process.env.AI_ROLLBACK_TARGET_VERSION || registry.previousModelVersion;
if (!targetVersion) {
  fail('no rollback target version available');
}

const now = new Date().toISOString();
const previousActive = registry.activeModelVersion;
registry.activeModelVersion = targetVersion;
registry.previousModelVersion = previousActive || targetVersion;
registry.canary = {
  ...(registry.canary || {}),
  enabled: false,
  trafficPercent: 0,
};
registry.lastRollback = {
  reason: process.env.AI_ROLLBACK_REASON || 'manual',
  traceId: process.env.AI_ROLLBACK_TRACE_ID || null,
  fromVersion: previousActive || null,
  toVersion: targetVersion,
  at: now,
};
registry.lastUpdatedAt = now;

fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
console.log(
  `[ai-rollback] rollback executed from=${previousActive || 'unknown'} to=${targetVersion} registry=${registryPath}`
);

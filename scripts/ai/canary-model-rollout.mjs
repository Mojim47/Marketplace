#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const registryPath = path.resolve(
  process.cwd(),
  process.env.AI_MODEL_ROLLOUT_REGISTRY || 'ops/assets/ai/models/rollout.registry.json'
);
const canaryVersion = process.env.AI_CANARY_MODEL_VERSION;
const trafficPercent = Number(process.env.AI_CANARY_TRAFFIC_PERCENT ?? 5);

function fail(message) {
  console.error(`[ai-canary][fatal] ${message}`);
  process.exit(1);
}

if (!canaryVersion) {
  fail('AI_CANARY_MODEL_VERSION is required');
}
if (!Number.isFinite(trafficPercent) || trafficPercent <= 0 || trafficPercent > 100) {
  fail('AI_CANARY_TRAFFIC_PERCENT must be in range 1..100');
}
if (!fs.existsSync(registryPath)) {
  fail(`rollout registry not found: ${registryPath}`);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
registry.canary = {
  enabled: true,
  modelVersion: canaryVersion,
  trafficPercent: Math.floor(trafficPercent),
};
registry.lastUpdatedAt = new Date().toISOString();

fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
console.log(
  `[ai-canary] enabled canary model=${canaryVersion} traffic=${Math.floor(trafficPercent)} registry=${registryPath}`
);

#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;
const enforce = (process.env.SECRETS_ROTATION_ENFORCE ?? 'true') === 'true';
const repoRoot = process.cwd();
const defaultPolicyPath = path.resolve(repoRoot, 'ops/contracts/secrets-rotation-policy.json');
const defaultRegistryPath = path.resolve(repoRoot, 'ops/contracts/secrets-rotation-registry.json');
const policyPath = path.resolve(
  repoRoot,
  process.env.SECRETS_ROTATION_POLICY_PATH ?? defaultPolicyPath
);
const registryPath = path.resolve(
  repoRoot,
  process.env.SECRETS_ROTATION_REGISTRY_PATH ?? defaultRegistryPath
);

function parseDate(input, key) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid timestamp for ${key}: ${input}`);
  }
  return parsed;
}

function ageDays(ts) {
  return (Date.now() - ts.getTime()) / DAY_MS;
}

function loadPolicy() {
  if (!fs.existsSync(policyPath)) {
    throw new Error(`missing secrets rotation policy file: ${policyPath}`);
  }
  const raw = fs.readFileSync(policyPath, 'utf8');
  const policy = JSON.parse(raw);
  if (!Array.isArray(policy.requiredSecrets) || policy.requiredSecrets.length === 0) {
    throw new Error('requiredSecrets must be a non-empty array in rotation policy');
  }
  return policy;
}

function parseDiscovered() {
  const raw = process.env.SECRETS_ROTATION_DISCOVERED ?? '';
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadDiscoveredFromRegistry() {
  if (!fs.existsSync(registryPath)) {
    return [];
  }
  const raw = fs.readFileSync(registryPath, 'utf8');
  const registry = JSON.parse(raw);
  if (!Array.isArray(registry.runtimeSecrets)) {
    throw new Error(`runtimeSecrets must be an array in registry: ${registryPath}`);
  }
  return registry.runtimeSecrets.map((item) => String(item).trim()).filter(Boolean);
}

function main() {
  if (!enforce) {
    console.log('secrets-rotation-gate skipped (SECRETS_ROTATION_ENFORCE=false)');
    return;
  }

  const policy = loadPolicy();
  const provider = process.env.SECRETS_PROVIDER ?? 'vault';
  const defaultMaxAgeDays = Number(process.env.SECRETS_ROTATION_MAX_AGE_DAYS ?? '90');
  if (!Number.isFinite(defaultMaxAgeDays) || defaultMaxAgeDays <= 0) {
    throw new Error(
      `invalid SECRETS_ROTATION_MAX_AGE_DAYS: ${process.env.SECRETS_ROTATION_MAX_AGE_DAYS}`
    );
  }

  const required = new Map(policy.requiredSecrets.map((item) => [item.name, item]));
  const discoveredManual = parseDiscovered();
  const discoveredRegistry = loadDiscoveredFromRegistry();
  const discovered = [...new Set([...discoveredRegistry, ...discoveredManual])];
  const violations = [];

  if (policy.denyByDefault === true && discovered.length === 0) {
    violations.push(
      'deny-by-default enabled but discovered secrets list is empty (set SECRETS_ROTATION_DISCOVERED or configure secrets-rotation-registry.json)'
    );
  }

  if (policy.denyByDefault === true && discovered.length > 0) {
    const unknown = discovered.filter((name) => !required.has(name));
    for (const name of unknown) {
      violations.push(`${name}: discovered secret is not declared in rotation policy (deny-by-default)`);
    }
  }

  for (const item of required.values()) {
    const rotatedAtEnv = item.rotatedAtEnv || `${item.name}_ROTATED_AT`;
    const versionEnv = item.versionEnv || `${item.name}_SECRET_VERSION`;
    const rotatedAt = process.env[rotatedAtEnv];
    const version = process.env[versionEnv];
    const maxAgeDays = Number(item.maxAgeDays ?? defaultMaxAgeDays);

    if (!rotatedAt) {
      violations.push(`${item.name}: missing ${rotatedAtEnv}`);
      continue;
    }
    if (!version) {
      violations.push(`${item.name}: missing ${versionEnv}`);
      continue;
    }
    if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
      violations.push(`${item.name}: invalid maxAgeDays=${item.maxAgeDays}`);
      continue;
    }

    const age = ageDays(parseDate(rotatedAt, rotatedAtEnv));
    if (age > maxAgeDays) {
      violations.push(`${item.name}: rotation age ${age.toFixed(1)}d exceeds ${maxAgeDays}d`);
    }
  }

  const providerRequirements = policy.providerRequirements ?? {};
  const mustHave = providerRequirements[provider] ?? [];
  for (const envKey of mustHave) {
    if (!process.env[envKey]) {
      violations.push(`${envKey} is required when SECRETS_PROVIDER=${provider}`);
    }
  }

  if (violations.length > 0) {
    console.error('secrets-rotation-gate FAIL');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        provider,
        policyPath,
        registryPath: fs.existsSync(registryPath) ? registryPath : null,
        denyByDefault: policy.denyByDefault === true,
        checked: [...required.keys()],
        discovered,
      },
      null,
      2
    )
  );
}

main();

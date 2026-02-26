#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const repoRoot = process.cwd();
const policyPath = path.resolve(
  repoRoot,
  process.env.SECRETS_ROTATION_POLICY_PATH ?? 'ops/contracts/secrets-rotation-policy.json'
);
const policySchemaPath = path.resolve(
  repoRoot,
  process.env.SECRETS_ROTATION_POLICY_SCHEMA_PATH ?? 'ops/contracts/secrets-rotation-policy.schema.json'
);
const registryPath = path.resolve(
  repoRoot,
  process.env.SECRETS_ROTATION_REGISTRY_PATH ?? 'ops/contracts/secrets-rotation-registry.json'
);
const registrySchemaPath = path.resolve(
  repoRoot,
  process.env.SECRETS_ROTATION_REGISTRY_SCHEMA_PATH ?? 'ops/contracts/secrets-rotation-registry.schema.json'
);

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function uniqueNormalized(items, label) {
  if (!Array.isArray(items)) {
    throw new Error(`${label} must be an array`);
  }
  const normalized = items.map((item) => String(item).trim()).filter(Boolean);
  const duplicates = normalized.filter((item, idx) => normalized.indexOf(item) !== idx);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicates: ${[...new Set(duplicates)].join(', ')}`);
  }
  return normalized;
}

function main() {
  const policySchema = loadJson(policySchemaPath);
  const registrySchema = loadJson(registrySchemaPath);
  const policy = loadJson(policyPath);
  const registry = loadJson(registryPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validatePolicy = ajv.compile(policySchema);
  const validateRegistry = ajv.compile(registrySchema);
  const schemaErrors = [];

  if (!validatePolicy(policy)) {
    for (const err of validatePolicy.errors ?? []) {
      schemaErrors.push(`policy schema ${err.instancePath || '/'}: ${err.message}`);
    }
  }
  if (!validateRegistry(registry)) {
    for (const err of validateRegistry.errors ?? []) {
      schemaErrors.push(`registry schema ${err.instancePath || '/'}: ${err.message}`);
    }
  }

  if (schemaErrors.length > 0) {
    console.error('secrets-contract-sync FAIL');
    for (const err of schemaErrors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  const policyNames = uniqueNormalized(
    (policy.requiredSecrets ?? []).map((item) => item?.name),
    'policy.requiredSecrets[*].name'
  );
  const registryNames = uniqueNormalized(registry.runtimeSecrets ?? [], 'registry.runtimeSecrets');

  const policySet = new Set(policyNames);
  const registrySet = new Set(registryNames);

  const onlyInPolicy = policyNames.filter((name) => !registrySet.has(name));
  const onlyInRegistry = registryNames.filter((name) => !policySet.has(name));

  if (onlyInPolicy.length > 0 || onlyInRegistry.length > 0) {
    console.error('secrets-contract-sync FAIL');
    if (onlyInPolicy.length > 0) {
      console.error(`- present only in policy: ${onlyInPolicy.join(', ')}`);
    }
    if (onlyInRegistry.length > 0) {
      console.error(`- present only in registry: ${onlyInRegistry.join(', ')}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        policyPath,
        policySchemaPath,
        registryPath,
        registrySchemaPath,
        syncedSecrets: registryNames,
      },
      null,
      2
    )
  );
}

main();

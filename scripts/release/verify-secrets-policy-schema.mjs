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
function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function unique(values) {
  return [...new Set(values)];
}

function main() {
  const policy = loadJson(policyPath);
  const schema = loadJson(policySchemaPath);
  const violations = [];

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const valid = validate(policy);
  if (!valid) {
    for (const err of validate.errors ?? []) {
      const at = err.instancePath || '/';
      violations.push(`schema ${at}: ${err.message}`);
    }
  }

  const secretNames = [];
  const rotatedAtEnvs = [];
  const versionEnvs = [];

  for (const [index, item] of (policy.requiredSecrets ?? []).entries()) {
    const prefix = `requiredSecrets[${index}]`;

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      violations.push(`${prefix} must be an object`);
      continue;
    }

    if (typeof item.name !== 'string' || item.name.trim().length === 0) {
      violations.push(`${prefix}.name must be a non-empty string`);
    } else {
      secretNames.push(item.name.trim());
    }

    if (typeof item.rotatedAtEnv !== 'string' || item.rotatedAtEnv.trim().length === 0) {
      violations.push(`${prefix}.rotatedAtEnv must be a non-empty string`);
    } else {
      rotatedAtEnvs.push(item.rotatedAtEnv.trim());
    }

    if (typeof item.versionEnv !== 'string' || item.versionEnv.trim().length === 0) {
      violations.push(`${prefix}.versionEnv must be a non-empty string`);
    } else {
      versionEnvs.push(item.versionEnv.trim());
    }

    const maxAgeDays = Number(item.maxAgeDays);
    if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
      violations.push(`${prefix}.maxAgeDays must be a positive number`);
    }
  }

  if (unique(secretNames).length !== secretNames.length) {
    violations.push('requiredSecrets contains duplicate name values');
  }
  if (unique(rotatedAtEnvs).length !== rotatedAtEnvs.length) {
    violations.push('requiredSecrets contains duplicate rotatedAtEnv values');
  }
  if (unique(versionEnvs).length !== versionEnvs.length) {
    violations.push('requiredSecrets contains duplicate versionEnv values');
  }

  const providerRequirements =
    policy.providerRequirements && typeof policy.providerRequirements === 'object'
      ? policy.providerRequirements
      : {};
  if (policy.providerRequirements && (typeof providerRequirements !== 'object' || Array.isArray(providerRequirements))) {
    violations.push('providerRequirements must be an object');
  } else {
    for (const [provider, envList] of Object.entries(providerRequirements)) {
      if (!Array.isArray(envList)) {
        violations.push(`providerRequirements.${provider} must be an array`);
        continue;
      }
      const normalized = envList.map((v) => String(v).trim()).filter(Boolean);
      if (normalized.length !== envList.length) {
        violations.push(`providerRequirements.${provider} contains empty env key`);
      }
      if (unique(normalized).length !== normalized.length) {
        violations.push(`providerRequirements.${provider} contains duplicate env keys`);
      }
    }
  }

  if (violations.length > 0) {
    console.error('secrets-policy-schema FAIL');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        policyPath,
        policySchemaPath,
        checkedSecrets: secretNames,
      },
      null,
      2
    )
  );
}

main();

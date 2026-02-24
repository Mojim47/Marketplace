#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PRODUCTION_HARDENING_CONTRACT_PATH || 'ops/contracts/production-hardening-contract.json'
);
const runtimeSpecPath = path.resolve(repoRoot, process.env.RUNTIME_SPEC_PATH || 'k8s/base/api-stack.yml');

function fail(message) {
  console.error(`[runtime-hardening-gate][fatal] ${message}`);
  process.exit(1);
}

function expectPattern(content, regex, label) {
  if (!regex.test(content)) {
    fail(`missing runtime hardening control: ${label}`);
  }
}

if (!fs.existsSync(contractPath)) {
  fail(`missing production hardening contract: ${contractPath}`);
}
if (!fs.existsSync(runtimeSpecPath)) {
  fail(`runtime spec not found: ${runtimeSpecPath}`);
}

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const gate = contract?.gates?.runtimeContainerHardening;
if (!gate?.enabled) {
  console.log('[runtime-hardening-gate] skipped (disabled)');
  process.exit(0);
}

const spec = fs.readFileSync(runtimeSpecPath, 'utf8');

if (gate?.policy?.nonRootRequired) {
  expectPattern(spec, /runAsNonRoot:\s*true/i, 'runAsNonRoot=true');
  if (/runAsUser:\s*0\b/i.test(spec)) {
    fail('runAsUser: 0 is forbidden');
  }
}

if (gate?.policy?.readOnlyRootFsRequired) {
  expectPattern(spec, /readOnlyRootFilesystem:\s*true/i, 'readOnlyRootFilesystem=true');
}

if (gate?.policy?.dropAllCapabilitiesRequired) {
  expectPattern(spec, /capabilities:\s*[\s\S]*drop:\s*[\s\S]*-\s*ALL/i, 'capabilities.drop includes ALL');
}

if (gate?.policy?.seccompRequired) {
  expectPattern(
    spec,
    /seccompProfile:\s*[\s\S]*type:\s*(RuntimeDefault|Localhost)/i,
    'seccompProfile.type RuntimeDefault|Localhost'
  );
}

if (gate?.policy?.latestTagForbidden) {
  const lines = spec.split(/\r?\n/);
  const bad = lines.filter((line) => /^\s*image:\s*.+:latest\s*$/i.test(line));
  if (bad.length > 0) {
    fail(`latest image tag is forbidden, found ${bad.length} entries`);
  }
}

console.log(`[runtime-hardening-gate] passed spec=${path.relative(repoRoot, runtimeSpecPath).replaceAll('\\', '/')}`);

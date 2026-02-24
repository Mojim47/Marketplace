#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const contractPath = path.resolve(
  process.cwd(),
  process.env.AI_MODEL_CONTRACT_PATH || 'ops/assets/ai/models/model.contract.json'
);
const strictSignature = process.env.AI_MODEL_CONTRACT_STRICT_SIGNATURE === 'true';
const publicKeyPem = process.env.MODEL_CONTRACT_PUBLIC_KEY_PEM;

function fail(message) {
  console.error(`[ai-contract][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(contractPath)) {
  fail(`missing model contract: ${contractPath}`);
}

const raw = fs.readFileSync(contractPath, 'utf8');
let contract;
try {
  contract = JSON.parse(raw);
} catch (_error) {
  fail(`invalid JSON in model contract: ${contractPath}`);
}

for (const key of [
  'modelName',
  'modelVersion',
  'artifactPath',
  'artifactSha256',
  'datasetHash',
  'signedAt',
]) {
  if (typeof contract[key] !== 'string' || contract[key].trim().length === 0) {
    fail(`model contract missing required field: ${key}`);
  }
}

if (!/^[a-fA-F0-9]{64}$/.test(contract.artifactSha256)) {
  fail('artifactSha256 must be 64-char hex');
}
if (!/^[a-fA-F0-9]{64}$/.test(contract.datasetHash)) {
  fail('datasetHash must be 64-char hex');
}

const artifactPath = path.resolve(path.dirname(contractPath), contract.artifactPath);
if (!fs.existsSync(artifactPath)) {
  fail(`artifact file missing: ${artifactPath}`);
}
const artifactHash = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
if (artifactHash.toLowerCase() !== String(contract.artifactSha256).toLowerCase()) {
  fail(`artifact sha256 mismatch: ${artifactPath}`);
}

if (contract.tokenizerPath) {
  if (typeof contract.tokenizerSha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(contract.tokenizerSha256)) {
    fail('tokenizerSha256 is required and must be 64-char hex when tokenizerPath exists');
  }
  const tokenizerPath = path.resolve(path.dirname(contractPath), contract.tokenizerPath);
  if (!fs.existsSync(tokenizerPath)) {
    fail(`tokenizer file missing: ${tokenizerPath}`);
  }
  const tokenizerHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(tokenizerPath))
    .digest('hex');
  if (tokenizerHash.toLowerCase() !== String(contract.tokenizerSha256).toLowerCase()) {
    fail(`tokenizer sha256 mismatch: ${tokenizerPath}`);
  }
}

if (contract.signatureBase64) {
  if (!publicKeyPem) {
    if (strictSignature) {
      fail('MODEL_CONTRACT_PUBLIC_KEY_PEM is required when strict signature mode is enabled');
    }
  } else {
    const payload = JSON.stringify({ ...contract, signatureBase64: undefined });
    const verifier = crypto.createVerify('sha256');
    verifier.update(payload);
    verifier.end();
    const verified = verifier.verify(publicKeyPem, Buffer.from(contract.signatureBase64, 'base64'));
    if (!verified) {
      fail('contract signature verification failed');
    }
  }
} else if (strictSignature) {
  fail('model contract has no signatureBase64 in strict signature mode');
}

const evalValue = Number(contract?.metrics?.evaluationValue);
const minValue = Number(contract?.metrics?.minimumAcceptedValue);
if (!Number.isFinite(evalValue) || !Number.isFinite(minValue)) {
  fail('metrics.evaluationValue and metrics.minimumAcceptedValue must be finite numbers');
}
if (evalValue < minValue) {
  fail(`model quality gate failed: evaluationValue ${evalValue} < minimumAcceptedValue ${minValue}`);
}

console.log(
  `[ai-contract] verified model=${contract.modelName} version=${contract.modelVersion} contract=${contractPath}`
);

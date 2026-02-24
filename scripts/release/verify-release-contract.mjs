#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.resolve(repoRoot, process.env.RELEASE_MANIFEST_PATH || 'artifacts/release/manifest.json');
const releaseContractPath = path.resolve(repoRoot, process.env.RELEASE_CONTRACT_PATH || 'ops/contracts/release-contract.json');

function fail(message) {
  console.error(`[release-verify][fatal] ${message}`);
  process.exit(1);
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

if (!fs.existsSync(manifestPath)) {
  fail(`missing release manifest: ${manifestPath}`);
}
if (!fs.existsSync(releaseContractPath)) {
  fail(`missing release contract: ${releaseContractPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const contract = JSON.parse(fs.readFileSync(releaseContractPath, 'utf8'));
const requiredFields = contract?.requirements?.manifestRequiredFields || [];

for (const field of requiredFields) {
  if (!(field in manifest)) {
    fail(`manifest missing required field: ${field}`);
  }
}

if (contract?.requirements?.commitOrTagRequired && !manifest.commit && !manifest.tag) {
  fail('manifest must include commit or tag');
}
if (manifest.commit && !/^[0-9a-f]{40}$/.test(String(manifest.commit))) {
  fail('manifest.commit must be a 40-char SHA when present');
}

const moduleArtifacts = Array.isArray(manifest.moduleArtifacts) ? manifest.moduleArtifacts : [];
if (moduleArtifacts.length === 0) {
  fail('manifest.moduleArtifacts must be a non-empty array');
}

for (const item of moduleArtifacts) {
  for (const key of ['moduleId', 'artifact', 'sha256File', 'sha256']) {
    if (typeof item[key] !== 'string' || item[key].trim() === '') {
      fail(`module artifact missing ${key}`);
    }
  }
  if (!/^[a-f0-9]{64}$/i.test(item.sha256)) {
    fail(`invalid sha256 format for ${item.moduleId}`);
  }
  const artifactPath = path.resolve(repoRoot, item.artifact);
  const shaFilePath = path.resolve(repoRoot, item.sha256File);
  if (!fs.existsSync(artifactPath)) {
    fail(`artifact file missing: ${item.artifact}`);
  }
  if (!fs.existsSync(shaFilePath)) {
    fail(`sha256 file missing: ${item.sha256File}`);
  }
  const computed = hashFile(artifactPath);
  if (computed.toLowerCase() !== item.sha256.toLowerCase()) {
    fail(`artifact checksum mismatch for ${item.moduleId}`);
  }
  const shaLine = fs.readFileSync(shaFilePath, 'utf8').trim().split(/\r?\n/)[0] || '';
  const firstToken = shaLine.split(/\s+/)[0] || '';
  if (firstToken.toLowerCase() !== item.sha256.toLowerCase()) {
    fail(`sha256 file mismatch for ${item.moduleId}`);
  }
}

const releaseDigest = crypto
  .createHash('sha256')
  .update(
    moduleArtifacts
      .slice()
      .sort((a, b) => String(a.moduleId).localeCompare(String(b.moduleId)))
      .map((a) => `${a.moduleId}:${a.sha256}`)
      .join('\n')
  )
  .digest('hex');

if (releaseDigest !== manifest.releaseDigest) {
  fail(`releaseDigest mismatch expected=${manifest.releaseDigest} actual=${releaseDigest}`);
}

if (contract?.rollbackPolicy?.mustRecordPreviousRelease && !manifest?.rollback?.previousReleaseRef) {
  fail('rollback.previousReleaseRef is required');
}
if (contract?.rollbackPolicy?.mustRecordRollbackCommand && !manifest?.rollback?.rollbackCommand) {
  fail('rollback.rollbackCommand is required');
}
if (contract?.rollbackPolicy?.mustTestRollbackPath && !manifest?.rollback?.rollbackVerifiedAt) {
  fail('rollback.rollbackVerifiedAt is required');
}

console.log(
  `[release-verify] verified modules=${moduleArtifacts.length} releaseDigest=${manifest.releaseDigest}`
);

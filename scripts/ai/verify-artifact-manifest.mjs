#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(
  process.cwd(),
  process.env.ARTIFACT_MANIFEST_PATH || 'artifacts/manifest.json'
);
const expectedCommit = process.env.ARTIFACT_EXPECT_COMMIT;

function fail(message) {
  console.error(`[artifact-manifest][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail(`manifest not found: ${manifestPath}`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (_error) {
  fail(`invalid JSON manifest: ${manifestPath}`);
}

for (const key of ['commit', 'artifact', 'sha256_file']) {
  if (typeof manifest[key] !== 'string' || manifest[key].trim().length === 0) {
    fail(`manifest missing required field: ${key}`);
  }
}

if (expectedCommit && manifest.commit !== expectedCommit) {
  fail(`manifest commit mismatch expected=${expectedCommit} actual=${manifest.commit}`);
}

const manifestDir = path.dirname(manifestPath);
const artifactPath = path.resolve(manifestDir, manifest.artifact);
const shaFilePath = path.resolve(manifestDir, manifest.sha256_file);

if (!fs.existsSync(artifactPath)) {
  fail(`artifact file not found: ${artifactPath}`);
}
if (!fs.existsSync(shaFilePath)) {
  fail(`sha256 file not found: ${shaFilePath}`);
}

const shaLine = fs.readFileSync(shaFilePath, 'utf8').trim().split(/\r?\n/)[0] || '';
const firstToken = shaLine.split(/\s+/)[0] || '';
if (!/^[a-fA-F0-9]{64}$/.test(firstToken)) {
  fail(`invalid sha256 line in ${shaFilePath}`);
}

const computed = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
if (computed.toLowerCase() !== firstToken.toLowerCase()) {
  fail(`artifact checksum mismatch for ${artifactPath}`);
}

console.log(
  `[artifact-manifest] verified commit=${manifest.commit} artifact=${manifest.artifact} sha256=${computed}`
);

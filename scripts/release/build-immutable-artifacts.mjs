#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const graphPath = path.resolve(repoRoot, process.env.LAUNCH_GRAPH_PATH || 'ops/contracts/launch-integration-graph.json');
const releaseContractPath = path.resolve(repoRoot, process.env.RELEASE_CONTRACT_PATH || 'ops/contracts/release-contract.json');
const outDir = path.resolve(repoRoot, process.env.RELEASE_OUT_DIR || 'artifacts/release');
const commit = process.env.RELEASE_COMMIT || '';
const tag = process.env.RELEASE_TAG || '';
const previousReleaseRef = process.env.PREVIOUS_RELEASE_REF || '';
const rollbackCommand =
  process.env.ROLLBACK_COMMAND || 'deploy --artifact <previous_release_artifact> --ref <previous_release_ref>';
const rollbackVerifiedAt = process.env.ROLLBACK_VERIFIED_AT || '';
const enforceCleanWorktree = process.env.RELEASE_ENFORCE_CLEAN_WORKTREE !== 'false';

function fail(message) {
  console.error(`[release-build][fatal] ${message}`);
  process.exit(1);
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

if (!fs.existsSync(graphPath)) {
  fail(`missing launch graph contract: ${graphPath}`);
}
if (!fs.existsSync(releaseContractPath)) {
  fail(`missing release contract: ${releaseContractPath}`);
}

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const releaseContract = JSON.parse(fs.readFileSync(releaseContractPath, 'utf8'));
const modules = Array.isArray(graph.requiredModules) ? graph.requiredModules : [];
if (modules.length === 0) {
  fail('launch graph has no requiredModules');
}

if (!commit && !tag) {
  fail('RELEASE_COMMIT or RELEASE_TAG is required');
}
if (commit && !/^[0-9a-f]{40}$/.test(commit)) {
  fail('RELEASE_COMMIT must be a 40-char SHA');
}

if (releaseContract?.rollbackPolicy?.mustRecordPreviousRelease && !previousReleaseRef) {
  fail('PREVIOUS_RELEASE_REF is required by release contract');
}
if (releaseContract?.rollbackPolicy?.mustRecordRollbackCommand && !rollbackCommand) {
  fail('ROLLBACK_COMMAND is required by release contract');
}
if (releaseContract?.rollbackPolicy?.mustTestRollbackPath && !rollbackVerifiedAt) {
  fail('ROLLBACK_VERIFIED_AT is required by release contract');
}

if (enforceCleanWorktree) {
  const out = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (out.trim().length > 0) {
    fail('worktree is dirty; immutable artifact build refused');
  }
}

execFileSync('node', ['scripts/release/validate-launch-graph.mjs'], { stdio: 'inherit' });

fs.mkdirSync(outDir, { recursive: true });

const moduleArtifacts = [];
for (const mod of modules) {
  const moduleId = String(mod.id);
  const safeId = moduleId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const roots = mod.artifactRoots.map((p) => path.resolve(repoRoot, p));
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      fail(`artifact root missing for ${moduleId}: ${root}`);
    }
  }

  const tarName = `${safeId}.tar.gz`;
  const shaName = `${safeId}.sha256`;
  const tarPath = path.join(outDir, tarName);
  const shaPath = path.join(outDir, shaName);
  const relativeRoots = roots.map((p) => path.relative(repoRoot, p).replaceAll('\\', '/'));

  execFileSync('tar', ['-czf', tarPath, ...relativeRoots], { cwd: repoRoot, stdio: 'inherit' });
  const digest = hashFile(tarPath);
  fs.writeFileSync(shaPath, `${digest}  ${tarName}\n`, 'utf8');

  moduleArtifacts.push({
    moduleId,
    artifact: path.relative(repoRoot, tarPath).replaceAll('\\', '/'),
    sha256File: path.relative(repoRoot, shaPath).replaceAll('\\', '/'),
    sha256: digest
  });
}

const sortedArtifactLines = moduleArtifacts
  .slice()
  .sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  .map((a) => `${a.moduleId}:${a.sha256}`);
const releaseDigest = crypto.createHash('sha256').update(sortedArtifactLines.join('\n')).digest('hex');
const graphDigest = crypto.createHash('sha256').update(fs.readFileSync(graphPath)).digest('hex');

const manifest = {
  generatedAt: new Date().toISOString(),
  commit,
  tag,
  graphContractPath: path.relative(repoRoot, graphPath).replaceAll('\\', '/'),
  graphDigest,
  moduleArtifacts,
  releaseDigest,
  rollback: {
    previousReleaseRef,
    rollbackCommand,
    rollbackVerifiedAt
  }
};

const manifestPath = path.join(outDir, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`[release-build] built immutable module artifacts=${moduleArtifacts.length}`);
console.log(`[release-build] manifest=${path.relative(repoRoot, manifestPath).replaceAll('\\', '/')}`);
console.log(`[release-build] releaseDigest=${releaseDigest}`);

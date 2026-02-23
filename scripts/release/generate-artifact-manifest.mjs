#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const releaseManifestPath = path.resolve(
  repoRoot,
  process.env.RELEASE_MANIFEST_PATH || 'artifacts/release/manifest.json'
);
const outputManifestPath = path.resolve(
  repoRoot,
  process.env.ARTIFACT_MANIFEST_PATH || 'artifacts/manifest.json'
);
const preferredModuleId = process.env.ARTIFACT_MODULE_ID || '';

function fail(message) {
  console.error(`[artifact-manifest-gen][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(releaseManifestPath)) {
  fail(`release manifest not found: ${releaseManifestPath}`);
}

let releaseManifest;
try {
  releaseManifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8'));
} catch (_error) {
  fail(`invalid release manifest JSON: ${releaseManifestPath}`);
}

const moduleArtifacts = Array.isArray(releaseManifest.moduleArtifacts)
  ? releaseManifest.moduleArtifacts
  : [];
if (moduleArtifacts.length === 0) {
  fail('release manifest has no moduleArtifacts');
}

let selected = null;
if (preferredModuleId) {
  selected = moduleArtifacts.find((item) => item.moduleId === preferredModuleId) || null;
  if (!selected) {
    fail(`module id not found in release manifest: ${preferredModuleId}`);
  }
}
if (!selected) {
  selected =
    moduleArtifacts.find((item) => String(item.moduleId).startsWith('api.')) || moduleArtifacts[0];
}

if (typeof releaseManifest.commit !== 'string' || releaseManifest.commit.trim().length === 0) {
  fail('release manifest commit is missing');
}
if (!selected?.artifact || !selected?.sha256File) {
  fail('selected module artifact is missing artifact or sha256File');
}

const artifactManifest = {
  commit: releaseManifest.commit,
  artifact: path
    .relative(path.dirname(outputManifestPath), path.resolve(repoRoot, selected.artifact))
    .replaceAll('\\', '/'),
  sha256_file: path
    .relative(path.dirname(outputManifestPath), path.resolve(repoRoot, selected.sha256File))
    .replaceAll('\\', '/'),
  module_id: selected.moduleId,
  generated_from: path.relative(repoRoot, releaseManifestPath).replaceAll('\\', '/'),
  generated_at: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(outputManifestPath), { recursive: true });
fs.writeFileSync(outputManifestPath, `${JSON.stringify(artifactManifest, null, 2)}\n`, 'utf8');

console.log(
  `[artifact-manifest-gen] wrote ${path.relative(repoRoot, outputManifestPath).replaceAll('\\', '/')}`
);
console.log(
  `[artifact-manifest-gen] module=${artifactManifest.module_id} artifact=${artifactManifest.artifact}`
);

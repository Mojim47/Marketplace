#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PRODUCTION_HARDENING_CONTRACT_PATH || 'ops/contracts/production-hardening-contract.json'
);
const cveReportPath = path.resolve(
  repoRoot,
  process.env.CVE_REPORT_PATH || 'artifacts/release/vuln-report.json'
);
const sbomPath = path.resolve(repoRoot, process.env.SBOM_PATH || 'artifacts/release/sbom.spdx.json');
const artifactRef = process.env.ARTIFACT_REF || '';
const artifactImage = process.env.ARTIFACT_IMAGE || '';
const artifactBlobPath = path.resolve(
  repoRoot,
  process.env.ARTIFACT_BLOB_PATH || `artifacts/launch-dist-${artifactRef || 'unknown'}.tar.gz`
);
const signaturePath = path.resolve(
  repoRoot,
  process.env.COSIGN_BLOB_SIGNATURE_PATH || `${artifactBlobPath}.sig`
);
const cosignKeyPath = path.resolve(
  repoRoot,
  process.env.COSIGN_PUBLIC_KEY_PATH || 'secrets/cosign/cosign.pub'
);

function fail(message) {
  console.error(`[supply-chain-gate][fatal] ${message}`);
  process.exit(1);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : '';
    const stdout = error?.stdout ? String(error.stdout) : '';
    fail(`command failed: ${command} ${args.join(' ')}\n${stderr || stdout}`);
  }
}

function extractSeverityCounts(input, counts = { CRITICAL: 0, HIGH: 0 }) {
  if (Array.isArray(input)) {
    for (const item of input) {
      extractSeverityCounts(item, counts);
    }
    return counts;
  }
  if (input && typeof input === 'object') {
    const obj = input;
    if (typeof obj.Severity === 'string') {
      const sev = obj.Severity.toUpperCase();
      if (sev === 'CRITICAL') counts.CRITICAL += 1;
      if (sev === 'HIGH') counts.HIGH += 1;
    }
    for (const value of Object.values(obj)) {
      extractSeverityCounts(value, counts);
    }
  }
  return counts;
}

if (!fs.existsSync(contractPath)) {
  fail(`missing production hardening contract: ${contractPath}`);
}
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const gate = contract?.gates?.supplyChainSecurity;
if (!gate?.enabled) {
  console.log('[supply-chain-gate] skipped (disabled)');
  process.exit(0);
}

if (gate?.policy?.cosignRequired) {
  run('cosign', ['version']);
  if (artifactImage) {
    if (!fs.existsSync(cosignKeyPath)) {
      fail(`cosign public key missing: ${cosignKeyPath}`);
    }
    run('cosign', ['verify', '--key', cosignKeyPath, artifactImage]);
  } else {
    if (!fs.existsSync(artifactBlobPath)) {
      fail(`artifact blob missing for cosign verify-blob: ${artifactBlobPath}`);
    }
    if (!fs.existsSync(signaturePath)) {
      fail(`artifact cosign signature missing: ${signaturePath}`);
    }
    if (!fs.existsSync(cosignKeyPath)) {
      fail(`cosign public key missing: ${cosignKeyPath}`);
    }
    run('cosign', [
      'verify-blob',
      '--key',
      cosignKeyPath,
      '--signature',
      signaturePath,
      artifactBlobPath
    ]);
  }
}

if (gate?.policy?.sbomRequired) {
  if (!fs.existsSync(sbomPath)) {
    fail(`SBOM missing: ${sbomPath}`);
  }
  if (fs.statSync(sbomPath).size === 0) {
    fail(`SBOM file is empty: ${sbomPath}`);
  }
}

if (gate?.policy?.cveReportRequired) {
  if (!fs.existsSync(cveReportPath)) {
    fail(`CVE report missing: ${cveReportPath}`);
  }
  let cveReport;
  try {
    cveReport = JSON.parse(fs.readFileSync(cveReportPath, 'utf8'));
  } catch (_error) {
    fail(`invalid CVE report JSON: ${cveReportPath}`);
  }
  const counts = extractSeverityCounts(cveReport);
  const maxCritical = Number(gate?.thresholds?.maxCritical ?? 0);
  const maxHigh = Number(gate?.thresholds?.maxHigh ?? 0);

  if (counts.CRITICAL > maxCritical) {
    fail(`CVE critical threshold breached: critical=${counts.CRITICAL} max=${maxCritical}`);
  }
  if (counts.HIGH > maxHigh) {
    fail(`CVE high threshold breached: high=${counts.HIGH} max=${maxHigh}`);
  }
}

if (!artifactRef && !artifactImage) {
  fail('ARTIFACT_REF or ARTIFACT_IMAGE is required');
}

console.log('[supply-chain-gate] passed (cosign + sbom + cve thresholds)');

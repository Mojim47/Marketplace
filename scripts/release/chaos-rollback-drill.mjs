#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nextgen-chaos-'));

function fail(message) {
  console.error(`[chaos-drill][fatal] ${message}`);
  process.exit(1);
}

function runExpectFail(command, args, env = {}) {
  try {
    execFileSync(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: { ...process.env, ...env }
    });
    fail(`expected command to fail but succeeded: ${command} ${args.join(' ')}`);
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : null;
    if (status === 0 || status === null) {
      const stderr = error?.stderr ? String(error.stderr) : '';
      const stdout = error?.stdout ? String(error.stdout) : '';
      fail(`unexpected command error: ${command} ${args.join(' ')}\n${stderr || stdout}`);
    }
    return {
      status,
      stderr: String(error?.stderr || ''),
      stdout: String(error?.stdout || '')
    };
  }
}

function runExpectSuccess(command, args, env = {}) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: { ...process.env, ...env }
    });
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : '';
    const stdout = error?.stdout ? String(error.stdout) : '';
    fail(`expected success but failed: ${command} ${args.join(' ')}\n${stderr || stdout}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function file(pathLike) {
  return path.join(tmpRoot, pathLike);
}

const checks = [];

try {
  const cveReportPath = file('vuln-report.json');
  const sbomPath = file('sbom.spdx.json');
  writeJson(sbomPath, { spdxVersion: 'SPDX-2.3', name: 'nextgen-release' });
  writeJson(cveReportPath, {
    Results: [
      {
        Vulnerabilities: [
          { VulnerabilityID: 'CVE-TEST-0001', Severity: 'CRITICAL' },
          { VulnerabilityID: 'CVE-TEST-0002', Severity: 'HIGH' }
        ]
      }
    ]
  });

  const cveBreach = runExpectFail('node', ['scripts/release/verify-supply-chain-gate.mjs'], {
    ARTIFACT_REF: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    SBOM_PATH: sbomPath,
    CVE_REPORT_PATH: cveReportPath,
    COSIGN_BLOB_SIGNATURE_PATH: file('missing.sig'),
    ARTIFACT_BLOB_PATH: file('missing-artifact.tar.gz')
  });
  checks.push({
    scenario: 'supply-chain-breach',
    passed: true,
    detail: `failed as expected (status=${cveBreach.status})`
  });

  const runtimeSpecPath = file('bad-runtime.yml');
  fs.writeFileSync(
    runtimeSpecPath,
    [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: bad-runtime',
      'spec:',
      '  template:',
      '    spec:',
      '      containers:',
      '        - name: api',
      '          image: ghcr.io/nextgen/api:latest',
      '          securityContext:',
      '            runAsUser: 0'
    ].join('\n'),
    'utf8'
  );
  const runtimeBreach = runExpectFail('node', ['scripts/release/verify-runtime-hardening-gate.mjs'], {
    RUNTIME_SPEC_PATH: runtimeSpecPath
  });
  checks.push({
    scenario: 'runtime-hardening-breach',
    passed: true,
    detail: `failed as expected (status=${runtimeBreach.status})`
  });

  const shadowReportPath = file('shadow-breach.json');
  writeJson(shadowReportPath, {
    modelVersion: 'baseline-v1',
    shadowModelVersion: 'canary-v2',
    threshold: 0.45,
    averageDrift: 0.91,
    maxDrift: 0.98
  });
  const driftBreach = runExpectFail('node', ['scripts/ai/shadow-eval-gate.mjs'], {
    AI_SHADOW_EVAL_REPORT_PATH: shadowReportPath,
    AI_AUTO_ROLLBACK_ON_DRIFT: 'false'
  });
  checks.push({
    scenario: 'ai-drift-breach',
    passed: true,
    detail: `failed as expected (status=${driftBreach.status})`
  });

  const drReportPath = file('dr-report-breach.json');
  const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  writeJson(drReportPath, {
    lastDrillAt: oldDate,
    restoreTestPassed: false,
    rpoMinutesActual: 120,
    rtoMinutesActual: 240
  });
  const sloReportPath = file('slo-report-breach.json');
  writeJson(sloReportPath, {
    burnRate1h: 5.0,
    burnRate6h: 3.0,
    latencyP95Ms: 1500,
    availabilityRatio: 0.9
  });
  const networkPath = file('network.yml');
  fs.writeFileSync(networkPath, 'kind: ConfigMap\nmetadata:\n  name: no-policy\n', 'utf8');

  const drSloBreach = runExpectFail('node', ['scripts/release/verify-dr-slo-gate.mjs'], {
    DR_DRILL_REPORT_PATH: drReportPath,
    SLO_REPORT_PATH: sloReportPath,
    NETWORK_POLICY_PATH: networkPath,
    AI_KILL_SWITCH: 'false',
    AR_KILL_SWITCH: 'false',
    CHECKOUT_KILL_SWITCH: 'false',
    PAYMENT_KILL_SWITCH: 'false'
  });
  checks.push({
    scenario: 'dr-slo-breach',
    passed: true,
    detail: `failed as expected (status=${drSloBreach.status})`
  });

  const reportPath = path.resolve(
    repoRoot,
    process.env.CHAOS_DRILL_REPORT_PATH || 'artifacts/release/chaos-rollback-drill-report.json'
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  writeJson(reportPath, {
    generatedAt: new Date().toISOString(),
    allExpectedFailuresObserved: true,
    checks
  });

  console.log(`[chaos-drill] all synthetic breaches triggered fail-closed behavior (${checks.length} scenarios)`);
  console.log(`[chaos-drill] report=${path.relative(repoRoot, reportPath).replaceAll('\\', '/')}`);
} finally {
  if (process.env.CHAOS_DRILL_KEEP_TMP !== 'true') {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } else {
    runExpectSuccess('node', ['-e', `console.log(${JSON.stringify(`[chaos-drill] tmp=${tmpRoot}`)})`]);
  }
}

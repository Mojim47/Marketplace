#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PRODUCTION_HARDENING_CONTRACT_PATH || 'ops/contracts/production-hardening-contract.json'
);
const drReportPath = path.resolve(repoRoot, process.env.DR_DRILL_REPORT_PATH || 'artifacts/release/dr-drill-report.json');
const sloReportPath = path.resolve(repoRoot, process.env.SLO_REPORT_PATH || 'artifacts/release/slo-report.json');
const loadReportPath = path.resolve(
  repoRoot,
  process.env.LOAD_TEST_REPORT_PATH || 'artifacts/release/load-test-report.json'
);
const chaosReportPath = path.resolve(
  repoRoot,
  process.env.CHAOS_DRILL_REPORT_PATH || 'artifacts/release/chaos-rollback-drill-report.json'
);
const oncallPath = path.resolve(repoRoot, process.env.ONCALL_ROTATION_PATH || 'ops/runbooks/oncall-rotation.md');
const incidentMatrixPath = path.resolve(
  repoRoot,
  process.env.INCIDENT_MATRIX_PATH || 'ops/runbooks/incident-severity-matrix.md'
);
const postmortemTemplatePath = path.resolve(
  repoRoot,
  process.env.POSTMORTEM_TEMPLATE_PATH || 'ops/runbooks/postmortem-template.md'
);
const networkPolicyPath = path.resolve(repoRoot, process.env.NETWORK_POLICY_PATH || 'k8s/base/6-networkpolicies.yml');

function fail(message) {
  console.error(`[dr-slo-gate][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(contractPath)) {
  fail(`missing production hardening contract: ${contractPath}`);
}

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const drGate = contract?.gates?.disasterRecovery;
const sloGate = contract?.gates?.sloErrorBudget;
const killSwitchGate = contract?.gates?.featureKillSwitch;
const auditGate = contract?.gates?.auditCompliance;
const networkGate = contract?.gates?.networkZeroTrust;
const opsGate = contract?.gates?.opsReadiness;
const loadGate = contract?.gates?.capacityLoadGate;
const chaosGate = contract?.gates?.chaosRollbackDrill;

if (drGate?.enabled) {
  if (!fs.existsSync(drReportPath)) {
    fail(`DR drill report missing: ${drReportPath}`);
  }
  let drReport;
  try {
    drReport = JSON.parse(fs.readFileSync(drReportPath, 'utf8'));
  } catch (_error) {
    fail(`invalid DR drill report JSON: ${drReportPath}`);
  }

  const lastDrill = new Date(drReport.lastDrillAt);
  if (Number.isNaN(lastDrill.getTime())) {
    fail('dr report lastDrillAt is invalid');
  }
  const ageDays = (Date.now() - lastDrill.getTime()) / (1000 * 60 * 60 * 24);
  const maxAge = Number(drGate?.policy?.lastDrillMaxAgeDays ?? 30);
  if (ageDays > maxAge) {
    fail(`DR drill is stale: ageDays=${ageDays.toFixed(1)} maxAgeDays=${maxAge}`);
  }

  if (drGate?.policy?.restoreTestMustPass && drReport.restoreTestPassed !== true) {
    fail('DR restore test must pass');
  }

  const rpoActual = Number(drReport.rpoMinutesActual);
  const rtoActual = Number(drReport.rtoMinutesActual);
  const rpoMax = Number(drGate?.thresholds?.rpoMinutesMax ?? 15);
  const rtoMax = Number(drGate?.thresholds?.rtoMinutesMax ?? 60);
  if (!Number.isFinite(rpoActual) || !Number.isFinite(rtoActual)) {
    fail('dr report must include numeric rpoMinutesActual and rtoMinutesActual');
  }
  if (rpoActual > rpoMax) {
    fail(`RPO threshold breached: actual=${rpoActual} max=${rpoMax}`);
  }
  if (rtoActual > rtoMax) {
    fail(`RTO threshold breached: actual=${rtoActual} max=${rtoMax}`);
  }
}

if (sloGate?.enabled) {
  if (!fs.existsSync(sloReportPath)) {
    fail(`SLO report missing: ${sloReportPath}`);
  }
  let sloReport;
  try {
    sloReport = JSON.parse(fs.readFileSync(sloReportPath, 'utf8'));
  } catch (_error) {
    fail(`invalid SLO report JSON: ${sloReportPath}`);
  }

  const burn1h = Number(sloReport.burnRate1h);
  const burn6h = Number(sloReport.burnRate6h);
  const latencyP95Ms = Number(sloReport.latencyP95Ms);
  const availability = Number(sloReport.availabilityRatio);

  const burn1hMax = Number(sloGate?.thresholds?.burnRate1hMax ?? 1);
  const burn6hMax = Number(sloGate?.thresholds?.burnRate6hMax ?? 1);
  const latencyMax = Number(sloGate?.thresholds?.latencyP95MsMax ?? 500);
  const availabilityMin = Number(sloGate?.thresholds?.availabilityMin ?? 0.999);

  if (!Number.isFinite(burn1h) || !Number.isFinite(burn6h) || !Number.isFinite(latencyP95Ms) || !Number.isFinite(availability)) {
    fail('slo report must include numeric burnRate1h, burnRate6h, latencyP95Ms, availabilityRatio');
  }
  if (burn1h > burn1hMax) {
    fail(`SLO burn rate 1h breached: actual=${burn1h} max=${burn1hMax}`);
  }
  if (burn6h > burn6hMax) {
    fail(`SLO burn rate 6h breached: actual=${burn6h} max=${burn6hMax}`);
  }
  if (latencyP95Ms > latencyMax) {
    fail(`SLO p95 latency breached: actualMs=${latencyP95Ms} maxMs=${latencyMax}`);
  }
  if (availability < availabilityMin) {
    fail(`SLO availability breached: actual=${availability} min=${availabilityMin}`);
  }
}

if (loadGate?.enabled) {
  if (!fs.existsSync(loadReportPath)) {
    fail(`load test report missing: ${loadReportPath}`);
  }
  let loadReport;
  try {
    loadReport = JSON.parse(fs.readFileSync(loadReportPath, 'utf8'));
  } catch (_error) {
    fail(`invalid load test report JSON: ${loadReportPath}`);
  }
  const throughputRps = Number(loadReport.throughputRps);
  const errorRate = Number(loadReport.errorRate);
  const throughputRpsMin = Number(loadGate?.thresholds?.throughputRpsMin ?? 100);
  const errorRateMax = Number(loadGate?.thresholds?.errorRateMax ?? 0.01);
  if (!Number.isFinite(throughputRps) || !Number.isFinite(errorRate)) {
    fail('load report must include numeric throughputRps and errorRate');
  }
  if (throughputRps < throughputRpsMin) {
    fail(`capacity throughput breached: actual=${throughputRps} min=${throughputRpsMin}`);
  }
  if (errorRate > errorRateMax) {
    fail(`capacity error rate breached: actual=${errorRate} max=${errorRateMax}`);
  }
}

if (chaosGate?.enabled) {
  if (!fs.existsSync(chaosReportPath)) {
    fail(`chaos drill report missing: ${chaosReportPath}`);
  }
  let chaosReport;
  try {
    chaosReport = JSON.parse(fs.readFileSync(chaosReportPath, 'utf8'));
  } catch (_error) {
    fail(`invalid chaos drill report JSON: ${chaosReportPath}`);
  }
  if (chaosReport.allExpectedFailuresObserved !== true) {
    fail('chaos drill did not observe all expected fail-closed scenarios');
  }
  const checks = Array.isArray(chaosReport.checks) ? chaosReport.checks : [];
  const minScenarios = Number(chaosGate?.thresholds?.minScenarios ?? 3);
  if (checks.length < minScenarios) {
    fail(`chaos drill scenarios below threshold: actual=${checks.length} min=${minScenarios}`);
  }
}

if (killSwitchGate?.enabled) {
  const requiredKillSwitches = [
    'AI_KILL_SWITCH',
    'AR_KILL_SWITCH',
    'CHECKOUT_KILL_SWITCH',
    'PAYMENT_KILL_SWITCH'
  ];
  for (const key of requiredKillSwitches) {
    const value = process.env[key];
    if (typeof value !== 'string' || !['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
      fail(`kill-switch env missing/invalid: ${key}`);
    }
  }
}

if (networkGate?.enabled) {
  if (!fs.existsSync(networkPolicyPath)) {
    fail(`network policy file missing: ${networkPolicyPath}`);
  }
  const policyText = fs.readFileSync(networkPolicyPath, 'utf8');
  if (networkGate?.policy?.defaultDenyRequired && !/NetworkPolicy/i.test(policyText)) {
    fail('network zero-trust default policy missing NetworkPolicy declarations');
  }
  if (networkGate?.policy?.mtlsRequired && !process.env.MTLS_ENFORCED) {
    fail('MTLS_ENFORCED env is required');
  }
  if (networkGate?.policy?.egressAllowlistRequired && !process.env.EGRESS_ALLOWLIST_VERSION) {
    fail('EGRESS_ALLOWLIST_VERSION env is required');
  }
}

if (auditGate?.enabled) {
  if (auditGate?.policy?.structuredLoggingRequired && process.env.LOG_FORMAT !== 'json') {
    fail('LOG_FORMAT must be json for audit compliance');
  }
  if (auditGate?.policy?.tamperEvidentLogRequired && !process.env.TAMPER_EVIDENT_LOG_CHAIN) {
    fail('TAMPER_EVIDENT_LOG_CHAIN env is required');
  }
  const retentionDays = Number(process.env.LOG_RETENTION_DAYS || '0');
  const retentionMin = Number(auditGate?.policy?.retentionDaysMin ?? 365);
  if (!Number.isFinite(retentionDays) || retentionDays < retentionMin) {
    fail(`LOG_RETENTION_DAYS must be >= ${retentionMin}`);
  }
  if (auditGate?.policy?.traceabilityChainRequired && !process.env.TRACEABILITY_CHAIN_ENABLED) {
    fail('TRACEABILITY_CHAIN_ENABLED env is required');
  }
}

if (opsGate?.enabled) {
  if (!fs.existsSync(oncallPath)) {
    fail(`ops readiness missing on-call rotation: ${oncallPath}`);
  }
  if (!fs.existsSync(incidentMatrixPath)) {
    fail(`ops readiness missing incident matrix: ${incidentMatrixPath}`);
  }
  if (!fs.existsSync(postmortemTemplatePath)) {
    fail(`ops readiness missing postmortem template: ${postmortemTemplatePath}`);
  }
}

console.log(
  '[dr-slo-gate] passed (DR + SLO + load + chaos + kill-switch + zero-trust + audit + ops readiness)'
);

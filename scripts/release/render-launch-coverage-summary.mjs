#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PREPROD_QUALITY_CONTRACT_PATH ?? 'ops/contracts/pre-production-quality-gate.json'
);
const summaryPath = path.resolve(
  repoRoot,
  process.env.COVERAGE_SUMMARY_PATH ?? 'coverage/coverage-summary.json'
);
const phaseName = process.env.PREPROD_COVERAGE_PHASE ?? 'phase-1';
const outputPath = process.env.GITHUB_STEP_SUMMARY || '';

function readJson(filePath, required = true) {
  if (!fs.existsSync(filePath)) {
    if (!required) {
      return null;
    }
    throw new Error(`missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveThresholds(contract, phase) {
  const coverage = contract.coverage ?? {};
  const phases = Array.isArray(coverage.phases) ? coverage.phases : [];
  const current = phases.find((p) => p?.name === phase);
  if (!current) {
    throw new Error(`coverage phase not found: ${phase}`);
  }
  const t = current.thresholds ?? {};
  return {
    lines: Number(t.lines ?? current.minimumCoveragePercent ?? 0),
    statements: Number(t.statements ?? current.minimumCoveragePercent ?? 0),
    functions: Number(t.functions ?? current.minimumCoveragePercent ?? 0),
    branches: Number(t.branches ?? current.minimumCoveragePercent ?? 0),
  };
}

function getPct(total, key) {
  return Number(total?.[key]?.pct ?? 0);
}

function statusIcon(actual, target) {
  return actual >= target ? '' : '';
}

function main() {
  const contract = readJson(contractPath);
  const coverageSummary =
    readJson(summaryPath, false) ??
    ({
      total: {
        lines: { pct: 0 },
        statements: { pct: 0 },
        functions: { pct: 0 },
        branches: { pct: 0 },
      },
    });
  const total = coverageSummary.total ?? {};
  const thresholds = resolveThresholds(contract, phaseName);
  const coverageMissing = !fs.existsSync(summaryPath);

  const metrics = [
    { key: 'lines', actual: getPct(total, 'lines'), target: thresholds.lines },
    { key: 'statements', actual: getPct(total, 'statements'), target: thresholds.statements },
    { key: 'functions', actual: getPct(total, 'functions'), target: thresholds.functions },
    { key: 'branches', actual: getPct(total, 'branches'), target: thresholds.branches },
  ];

  const body = [
    '## Launch Coverage Dashboard',
    '',
    `- Profile: \`${contract.coverage?.profile ?? 'launch'}\``,
    `- Phase: \`${phaseName}\``,
    `- Source: \`${path.relative(repoRoot, summaryPath)}\``,
    coverageMissing ? '- Coverage summary: missing, rendered with zeroed fallback to keep workflow deterministic.' : '',
    '',
    '| Metric | Actual | Target | Status |',
    '|---|---:|---:|---:|',
    ...metrics.map(
      (m) =>
        `| ${m.key} | ${m.actual.toFixed(2)}% | ${m.target.toFixed(2)}% | ${statusIcon(m.actual, m.target)} |`
    ),
    '',
  ].join('\n');

  if (outputPath) {
    fs.appendFileSync(outputPath, `${body}\n`, 'utf8');
  } else {
    process.stdout.write(`${body}\n`);
  }
}

main();

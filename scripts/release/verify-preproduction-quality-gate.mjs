#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contractPath = path.resolve(
  repoRoot,
  process.env.PREPROD_QUALITY_CONTRACT_PATH ?? 'ops/contracts/pre-production-quality-gate.json'
);

function fail(message) {
  console.error(`preproduction-quality-gate FAIL: ${message}`);
  process.exit(1);
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing file: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`missing ${label}: ${filePath}`);
  }
}

function resolveCoverageConfig(contract) {
  // Backward compatibility for v2026.1 contract shape
  if (Number.isFinite(Number(contract.minimumCoveragePercent))) {
    const legacy = Number(contract.minimumCoveragePercent);
    return {
      thresholds: {
        lines: legacy,
        statements: legacy,
        functions: legacy,
        branches: legacy,
      },
      summaryPath: contract.coverageSummaryPath ?? 'coverage/coverage-summary.json',
      profile: 'default',
      phase: null,
    };
  }

  const coverage = contract.coverage;
  if (!coverage || typeof coverage !== 'object') {
    fail('coverage configuration is required');
  }

  const summaryPath = coverage.summaryPath ?? 'coverage/coverage-summary.json';
  const profile = coverage.profile ?? 'default';
  const mode = coverage.mode ?? 'fixed';

  if (mode === 'fixed') {
    const threshold = Number(coverage.minimumCoveragePercent);
    if (!Number.isFinite(threshold)) {
      fail('coverage.minimumCoveragePercent must be numeric in fixed mode');
    }
    return {
      thresholds: {
        lines: threshold,
        statements: threshold,
        functions: threshold,
        branches: threshold,
      },
      summaryPath,
      profile,
      phase: null,
    };
  }

  if (mode === 'phased') {
    const phases = Array.isArray(coverage.phases) ? coverage.phases : [];
    if (phases.length === 0) {
      fail('coverage.phases must be non-empty in phased mode');
    }
    const selectedPhase = process.env.PREPROD_COVERAGE_PHASE ?? coverage.currentPhase;
    if (!selectedPhase) {
      fail('coverage.currentPhase (or PREPROD_COVERAGE_PHASE) is required in phased mode');
    }
    const found = phases.find((phase) => phase?.name === selectedPhase);
    if (!found) {
      fail(`coverage phase not found: ${selectedPhase}`);
    }
    const phaseThresholds = found.thresholds;
    if (phaseThresholds && typeof phaseThresholds === 'object') {
      const lines = Number(phaseThresholds.lines);
      const statements = Number(phaseThresholds.statements);
      const functions = Number(phaseThresholds.functions);
      const branches = Number(phaseThresholds.branches);
      for (const [k, v] of Object.entries({ lines, statements, functions, branches })) {
        if (!Number.isFinite(v)) {
          fail(`coverage phase thresholds.${k} invalid for ${selectedPhase}`);
        }
      }
      return {
        thresholds: { lines, statements, functions, branches },
        summaryPath,
        profile,
        phase: selectedPhase,
      };
    }

    const threshold = Number(found.minimumCoveragePercent);
    if (!Number.isFinite(threshold)) {
      fail(`coverage phase threshold(s) invalid for ${selectedPhase}`);
    }
    return {
      thresholds: {
        lines: threshold,
        statements: threshold,
        functions: threshold,
        branches: threshold,
      },
      summaryPath,
      profile,
      phase: selectedPhase,
    };
  }

  fail(`unsupported coverage.mode: ${mode}`);
}

function assertCoverage(contract) {
  const resolved = resolveCoverageConfig(contract);
  const summaryPath = path.resolve(repoRoot, resolved.summaryPath);
  assertFileExists(summaryPath, 'coverage summary');

  const summary = loadJson(summaryPath);
  const total = summary.total ?? {};
  const keys = ['lines', 'statements', 'functions', 'branches'];

  for (const key of keys) {
    const threshold = Number(resolved.thresholds[key]);
    const pct = Number(total?.[key]?.pct);
    if (!Number.isFinite(pct)) {
      fail(`coverage metric missing: total.${key}.pct`);
    }
    if (pct < threshold) {
      fail(`coverage ${key} below threshold (${pct} < ${threshold})`);
    }
  }

  return {
    summaryPath,
    thresholds: resolved.thresholds,
    profile: resolved.profile,
    phase: resolved.phase,
  };
}

function assertArtifacts(contract) {
  const requiredArtifacts = Array.isArray(contract.requiredArtifacts) ? contract.requiredArtifacts : [];
  if (requiredArtifacts.length === 0) {
    fail('requiredArtifacts must be a non-empty array');
  }
  for (const rel of requiredArtifacts) {
    const filePath = path.resolve(repoRoot, rel);
    assertFileExists(filePath, `required artifact (${rel})`);
  }
  return requiredArtifacts;
}

function main() {
  const contract = loadJson(contractPath);
  if (typeof contract.version !== 'string' || contract.version.trim().length === 0) {
    fail('contract.version must be a non-empty string');
  }

  const coverage = assertCoverage(contract);
  const artifacts = assertArtifacts(contract);

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        contractPath,
        version: contract.version,
        thresholds: coverage.thresholds,
        coverageProfile: coverage.profile,
        coveragePhase: coverage.phase,
        coverageSummaryPath: coverage.summaryPath,
        requiredArtifacts: artifacts,
      },
      null,
      2
    )
  );
}

main();

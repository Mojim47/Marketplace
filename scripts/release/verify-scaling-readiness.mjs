#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const apiStackPath = path.resolve(repoRoot, process.env.K8S_API_STACK_PATH || 'k8s/base/api-stack.yml');
const hpaPath = path.resolve(repoRoot, process.env.K8S_HPA_PATH || 'k8s/base/hpa-autoscaling.yml');
const helmValuesPath = path.resolve(repoRoot, process.env.HELM_VALUES_PATH || 'helm/values.yaml');
const reportPath = path.resolve(
  repoRoot,
  process.env.SCALING_READINESS_REPORT_PATH || 'artifacts/release/scaling-readiness-report.json'
);

function fail(message) {
  console.error(`[scaling-gate][fatal] ${message}`);
  process.exit(1);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing required file: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function extractNumber(text, key) {
  const pattern = new RegExp(`\\b${key}\\s*:\\s*(\\d+)`);
  const match = text.match(pattern);
  return match ? Number.parseInt(match[1], 10) : NaN;
}

function run() {
  const apiStackText = readRequired(apiStackPath);
  const hpaText = readRequired(hpaPath);
  const helmValuesText = readRequired(helmValuesPath);

  const hpaDeclarations = (apiStackText.match(/kind:\s*HorizontalPodAutoscaler/g) || []).length +
    (hpaText.match(/kind:\s*HorizontalPodAutoscaler/g) || []).length;
  if (hpaDeclarations < 1) {
    fail('no HorizontalPodAutoscaler declared for runtime workloads');
  }

  const minReplicas = extractNumber(`${apiStackText}\n${hpaText}`, 'minReplicas');
  const maxReplicas = extractNumber(`${apiStackText}\n${hpaText}`, 'maxReplicas');
  if (!Number.isFinite(minReplicas) || minReplicas < 2) {
    fail(`minReplicas must be >= 2 (found=${Number.isFinite(minReplicas) ? minReplicas : 'missing'})`);
  }
  if (!Number.isFinite(maxReplicas) || maxReplicas < minReplicas) {
    fail(
      `maxReplicas must be >= minReplicas (min=${Number.isFinite(minReplicas) ? minReplicas : 'missing'} max=${Number.isFinite(maxReplicas) ? maxReplicas : 'missing'})`
    );
  }

  const poolMin = extractNumber(helmValuesText, 'poolMin');
  const poolMax = extractNumber(helmValuesText, 'poolMax');
  if (!Number.isFinite(poolMin) || !Number.isFinite(poolMax)) {
    fail('helm values must define poolMin and poolMax for DB connection pooling');
  }
  if (poolMin < 2 || poolMax < poolMin) {
    fail(`invalid DB pool configuration poolMin=${poolMin} poolMax=${poolMax}`);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    files: {
      apiStackPath: path.relative(repoRoot, apiStackPath).replaceAll('\\', '/'),
      hpaPath: path.relative(repoRoot, hpaPath).replaceAll('\\', '/'),
      helmValuesPath: path.relative(repoRoot, helmValuesPath).replaceAll('\\', '/'),
    },
    hpa: {
      declarations: hpaDeclarations,
      minReplicas,
      maxReplicas,
    },
    dbPooling: {
      poolMin,
      poolMax,
    },
    status: 'passed',
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[scaling-gate] passed report=${path.relative(repoRoot, reportPath).replaceAll('\\', '/')}`);
}

run();

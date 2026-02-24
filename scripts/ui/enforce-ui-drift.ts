import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type AuditFile = {
  file: string;
  inlineStyles: number;
  hardcodedColorClasses: number;
  arbitraryClassTokens: number;
  hardcodedHex: number;
  driftScore: number;
};

type AuditReport = {
  summary: {
    hardcodedColorClassCount: number;
    arbitraryClassCount: number;
    inlineStyles: number;
  };
  tokens: {
    spacing: Record<string, number>;
    radius: Record<string, number>;
  };
  files: AuditFile[];
};

type Baseline = {
  summary: {
    hardcodedColorClassCount: number;
    arbitraryClassCount: number;
    inlineStyles: number;
  };
  ruleViolations: {
    spacingScaleOnly: Record<string, number>;
    radiusScaleOnly: Record<string, number>;
  };
  files: Record<
    string,
    {
      inlineStyles: number;
      hardcodedColorClasses: number;
      arbitraryClassTokens: number;
      hardcodedHex: number;
      driftScore: number;
    }
  >;
};

const AUDIT_PATH = path.join('artifacts', 'ui-audit', 'elite-ui-audit.json');
const BASELINE_PATH = path.join('scripts', 'ui', 'baselines', 'elite-ui-baseline.json');
const REPORT_PATH = path.join('artifacts', 'ui-audit', 'phase1-ci-report.md');
const ALLOWED_SPACING = new Set(['0', '1', '2', '3', '4', '6', '8', '12', '16', '24', '32', '48']);
const ALLOWED_RADIUS = new Set([
  'rounded-none',
  'rounded-sm',
  'rounded',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-full',
]);

function sumValues(input: Record<string, number>): number {
  return Object.values(input).reduce((a, b) => a + b, 0);
}

function getSpacingViolations(spacing: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [token, count] of Object.entries(spacing)) {
    const match = token.match(/^(?:p|m|gap|space-[xy])(?:[trblxy])?-(\d+(?:\.\d+)?)$/);
    if (!match) {
      continue;
    }
    if (!ALLOWED_SPACING.has(match[1])) {
      out[token] = count;
    }
  }
  return out;
}

function getRadiusViolations(radius: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [token, count] of Object.entries(radius)) {
    if (token.startsWith('rounded') && !ALLOWED_RADIUS.has(token)) {
      out[token] = count;
    }
  }
  return out;
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function compareMetric(
  name: string,
  current: number,
  baseline: number,
  violations: string[],
  lines: string[]
): void {
  const delta = current - baseline;
  const trend = delta > 0 ? `+${delta}` : String(delta);
  lines.push(`- ${name}: current=${current}, baseline=${baseline}, delta=${trend}`);
  if (delta > 0) {
    violations.push(`${name} increased by ${delta}`);
  }
}

function compareRuleCount(
  name: string,
  current: Record<string, number>,
  baseline: Record<string, number>,
  violations: string[],
  lines: string[]
): void {
  const currentCount = sumValues(current);
  const baselineCount = sumValues(baseline);
  const delta = currentCount - baselineCount;
  const trend = delta > 0 ? `+${delta}` : String(delta);
  lines.push(`- ${name}: current=${currentCount}, baseline=${baselineCount}, delta=${trend}`);
  if (delta > 0) {
    violations.push(`${name} violations increased by ${delta}`);
  }
}

function main(): void {
  const enforce = (process.env.UI_DRIFT_ENFORCE || 'false').toLowerCase() === 'true';
  execSync('pnpm ui:elite:audit', { stdio: 'inherit' });
  const audit = readJson<AuditReport>(AUDIT_PATH);
  const baseline = readJson<Baseline>(BASELINE_PATH);
  const violations: string[] = [];
  const lines: string[] = [];

  lines.push('# Phase 1 CI Drift Report');
  lines.push('');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary Metrics');

  compareMetric(
    'hardcoded_color_classes',
    audit.summary.hardcodedColorClassCount,
    baseline.summary.hardcodedColorClassCount,
    violations,
    lines
  );
  compareMetric(
    'arbitrary_classes',
    audit.summary.arbitraryClassCount,
    baseline.summary.arbitraryClassCount,
    violations,
    lines
  );
  compareMetric(
    'inline_styles',
    audit.summary.inlineStyles,
    baseline.summary.inlineStyles,
    violations,
    lines
  );

  lines.push('');
  lines.push('## Lint Rules (Token Enforced)');
  const spacingViolations = getSpacingViolations(audit.tokens.spacing);
  const radiusViolations = getRadiusViolations(audit.tokens.radius);
  compareRuleCount(
    'spacing_scale_only',
    spacingViolations,
    baseline.ruleViolations.spacingScaleOnly,
    violations,
    lines
  );
  compareRuleCount(
    'radius_scale_only',
    radiusViolations,
    baseline.ruleViolations.radiusScaleOnly,
    violations,
    lines
  );

  lines.push('');
  lines.push('## File Regressions');
  const fileRegressions: string[] = [];
  for (const file of audit.files) {
    const base = baseline.files[file.file] ?? {
      inlineStyles: 0,
      hardcodedColorClasses: 0,
      arbitraryClassTokens: 0,
      hardcodedHex: 0,
      driftScore: 0,
    };
    const diffs = [
      ['hardcodedColorClasses', file.hardcodedColorClasses - base.hardcodedColorClasses],
      ['arbitraryClassTokens', file.arbitraryClassTokens - base.arbitraryClassTokens],
      ['inlineStyles', file.inlineStyles - base.inlineStyles],
      ['hardcodedHex', file.hardcodedHex - base.hardcodedHex],
      ['driftScore', file.driftScore - base.driftScore],
    ].filter(([, delta]) => delta > 0);
    if (diffs.length > 0) {
      const detail = diffs.map(([name, delta]) => `${name}=+${delta}`).join(', ');
      fileRegressions.push(`- ${file.file}: ${detail}`);
      violations.push(`File regression: ${file.file} (${detail})`);
    }
  }

  if (fileRegressions.length === 0) {
    lines.push('- No file-level regressions against baseline.');
  } else {
    lines.push(...fileRegressions);
  }

  lines.push('');
  lines.push('## Verdict');
  if (violations.length === 0) {
    lines.push('- PASS: no drift regressions against baseline.');
  } else {
    lines.push('- FAIL: drift regressions detected.');
    lines.push('');
    lines.push('### Blocking Violations');
    for (const violation of [...new Set(violations)]) {
      lines.push(`- ${violation}`);
    }
  }
  lines.push('');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf-8');

  if (violations.length > 0 && enforce) {
    console.error('UI drift gate failed. See artifacts/ui-audit/phase1-ci-report.md');
    process.exit(1);
  }

  if (violations.length > 0) {
    console.warn('UI drift regressions detected, enforcement disabled (UI_DRIFT_ENFORCE=false).');
  } else {
    console.log('UI drift gate passed.');
  }
}

main();

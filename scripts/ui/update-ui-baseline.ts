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
  generatedAt: string;
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

function readAudit(): AuditReport {
  if (!fs.existsSync(AUDIT_PATH)) {
    throw new Error(`Audit report missing: ${AUDIT_PATH}. Run pnpm ui:elite:audit first.`);
  }
  return JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8')) as AuditReport;
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

function main(): void {
  const audit = readAudit();
  const baseline: Baseline = {
    generatedAt: new Date().toISOString(),
    summary: {
      hardcodedColorClassCount: audit.summary.hardcodedColorClassCount,
      arbitraryClassCount: audit.summary.arbitraryClassCount,
      inlineStyles: audit.summary.inlineStyles,
    },
    ruleViolations: {
      spacingScaleOnly: getSpacingViolations(audit.tokens.spacing),
      radiusScaleOnly: getRadiusViolations(audit.tokens.radius),
    },
    files: Object.fromEntries(
      audit.files.map((f) => [
        f.file,
        {
          inlineStyles: f.inlineStyles,
          hardcodedColorClasses: f.hardcodedColorClasses,
          arbitraryClassTokens: f.arbitraryClassTokens,
          hardcodedHex: f.hardcodedHex,
          driftScore: f.driftScore,
        },
      ])
    ),
  };

  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf-8');
  console.log(`UI baseline updated: ${BASELINE_PATH}`);
}

main();

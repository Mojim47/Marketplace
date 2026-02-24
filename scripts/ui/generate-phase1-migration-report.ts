import fs from 'node:fs';
import path from 'node:path';

type AuditFile = {
  file: string;
  hardcodedColorClasses: number;
  arbitraryClassTokens: number;
  inlineStyles: number;
  driftScore: number;
};

type AuditReport = {
  generatedAt: string;
  files: AuditFile[];
};

type Baseline = {
  files: Record<
    string,
    {
      hardcodedColorClasses: number;
      arbitraryClassTokens: number;
      inlineStyles: number;
      driftScore: number;
    }
  >;
};

const AUDIT_PATH = path.join('artifacts', 'ui-audit', 'elite-ui-audit.json');
const BASELINE_PATH = path.join('scripts', 'ui', 'baselines', 'elite-ui-baseline.json');
const OUT_PATH = path.join('artifacts', 'ui-audit', 'phase1-migration.json');

const HOTSPOTS = ['apps/web/components/hero-card.tsx'];

const CLASS_MAPPING = {
  'bg-white/5': 'bg-semantic-surface-glass',
  'bg-white/10': 'bg-semantic-surface-elevated',
  'border-white/10': 'border-semantic-border-subtle',
  'border-white/15': 'border-semantic-border-strong',
  'text-white': 'text-semantic-text-primary',
  'text-white/80': 'text-semantic-text-secondary',
  'text-white/60': 'text-semantic-text-muted',
  'text-amber-200/90': 'text-semantic-warning',
  'from-cyan-400': 'from-semantic-accent-primary',
  'to-pink-400': 'to-semantic-accent-secondary',
} as const;

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function main(): void {
  const audit = readJson<AuditReport>(AUDIT_PATH);
  const baseline = readJson<Baseline>(BASELINE_PATH);
  const index = new Map(audit.files.map((f) => [f.file, f]));

  const migrated = HOTSPOTS.map((file) => {
    const current = index.get(file);
    const before = baseline.files[file] ?? {
      hardcodedColorClasses: 0,
      arbitraryClassTokens: 0,
      inlineStyles: 0,
      driftScore: 0,
    };
    const after = current ?? before;
    const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
    const hasSemanticClasses = /(?:text|bg|border|from|via|to)-semantic-/.test(source);
    return {
      file,
      before,
      after,
      delta: {
        hardcodedColorClasses: after.hardcodedColorClasses - before.hardcodedColorClasses,
        arbitraryClassTokens: after.arbitraryClassTokens - before.arbitraryClassTokens,
        inlineStyles: after.inlineStyles - before.inlineStyles,
        driftScore: after.driftScore - before.driftScore,
      },
      migrated: hasSemanticClasses && after.hardcodedColorClasses === 0 && after.arbitraryClassTokens === 0,
      migrationSignals: {
        hasSemanticClasses,
        zeroHardcodedColorClasses: after.hardcodedColorClasses === 0,
        zeroArbitraryClasses: after.arbitraryClassTokens === 0,
      },
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceAuditGeneratedAt: audit.generatedAt,
    hotspots: HOTSPOTS,
    classMapping: CLASS_MAPPING,
    files: migrated,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Phase 1 migration report written: ${OUT_PATH}`);
}

main();

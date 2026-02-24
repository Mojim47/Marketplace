import fs from 'node:fs';
import path from 'node:path';

type StringCount = Record<string, number>;

type FileAudit = {
  file: string;
  routeType: 'page' | 'layout' | 'loading' | 'error' | 'global-error' | 'not-found' | 'other';
  lineCount: number;
  hasInlineStyle: boolean;
  hasOverlayPattern: boolean;
  hardcodedHex: string[];
  hardcodedColorClasses: string[];
  arbitraryClassTokens: string[];
  spacingClasses: string[];
  radiusClasses: string[];
  fontWeightClasses: string[];
  componentTags: string[];
  variantNames: string[];
  stateNames: string[];
};

type AuditReport = {
  generatedAt: string;
  roots: string[];
  summary: {
    filesScanned: number;
    routes: number;
    overlays: number;
    inlineStyles: number;
    hardcodedHexCount: number;
    hardcodedColorClassCount: number;
    arbitraryClassCount: number;
  };
  inventory: {
    pages: string[];
    layouts: string[];
    loadings: string[];
    errors: string[];
    overlays: string[];
    componentTags: StringCount;
    variants: StringCount;
    states: StringCount;
  };
  tokens: {
    spacing: StringCount;
    radius: StringCount;
    fontWeight: StringCount;
    hardcodedHex: StringCount;
    hardcodedColorClasses: StringCount;
  };
  drift: {
    missingSemanticTokenUsage: number;
    hardcodedStyleFiles: string[];
    arbitraryClassFiles: string[];
    topDriftFiles: Array<{ file: string; score: number }>;
  };
  painPoints: Array<{ key: string; description: string; signal: string; count: number }>;
  files: Array<{
    file: string;
    routeType: FileAudit['routeType'];
    inlineStyles: number;
    hardcodedColorClasses: number;
    arbitraryClassTokens: number;
    hardcodedHex: number;
    driftScore: number;
  }>;
};

const ROOTS = [
  path.join('apps', 'web', 'app'),
  path.join('apps', 'web', 'components'),
  path.join('apps', 'admin', 'app'),
  path.join('apps', 'admin', 'src', 'app'),
  path.join('apps', 'admin', 'src', 'components'),
];

const ALLOWED_EXT = new Set(['.ts', '.tsx']);
const SKIP_DIR = new Set(['node_modules', '.next', 'public', 'dist', 'coverage']);
const SPACING_ALLOWLIST = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '6',
  '8',
  '12',
  '16',
  '24',
  '32',
  '48',
]);

function pushCount(store: StringCount, key: string): void {
  if (!key) {
    return;
  }
  store[key] = (store[key] ?? 0) + 1;
}

function listFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  const queue = [root];
  const files: string[] = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIR.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }
      if (ALLOWED_EXT.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function rel(file: string): string {
  return file.replace(/\\/g, '/');
}

function routeTypeFromFile(filePath: string): FileAudit['routeType'] {
  const name = path.basename(filePath);
  if (name === 'page.tsx' || name === 'page.ts') return 'page';
  if (name === 'layout.tsx' || name === 'layout.ts') return 'layout';
  if (name === 'loading.tsx' || name === 'loading.ts') return 'loading';
  if (name === 'error.tsx' || name === 'error.ts') return 'error';
  if (name === 'global-error.tsx' || name === 'global-error.ts') return 'global-error';
  if (name === 'not-found.tsx' || name === 'not-found.ts') return 'not-found';
  return 'other';
}

function analyzeFile(filePath: string): FileAudit {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const classMatches = [...raw.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  const classTokens = classMatches.flatMap((v) => v.split(/\s+/).filter(Boolean));

  const hardcodedHex = unique([...raw.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]));
  const hardcodedColorClasses = unique(
    classTokens.filter((token) =>
      /^(bg|text|border|from|via|to|stroke|fill)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)/.test(
        token
      )
    )
  );
  const arbitraryClassTokens = unique(classTokens.filter((token) => token.includes('[')));
  const spacingClasses = unique(
    classTokens.filter((token) => /^(p|m|gap|space-[xy])([trblxy])?-\d+(\.\d+)?$/.test(token))
  );
  const radiusClasses = unique(classTokens.filter((token) => token.startsWith('rounded')));
  const fontWeightClasses = unique(
    classTokens.filter((token) =>
      /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(token)
    )
  );
  const componentTags = unique([...raw.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]));
  const variantNames = unique(
    [...raw.matchAll(/\bvariant\s*=\s*["'`]([a-zA-Z0-9_-]+)["'`]/g)].map((m) => m[1])
  );
  const stateNames = unique(
    [
      ...raw.matchAll(
        /\b(default|hover|focus|active|disabled|loading|error|success|empty|offline|no-permission)\b/g
      ),
    ].map((m) => m[1])
  );

  return {
    file: rel(filePath),
    routeType: routeTypeFromFile(filePath),
    lineCount: raw.split(/\r?\n/).length,
    hasInlineStyle: /\bstyle\s*=\s*\{\{/.test(raw),
    hasOverlayPattern:
      /<(Modal|Dialog|Drawer|Popover|Tooltip|Toast)\b/.test(raw) ||
      /\brole\s*=\s*["'`]dialog["'`]/.test(raw) ||
      /\b(overlay|backdrop)\b/i.test(raw),
    hardcodedHex,
    hardcodedColorClasses,
    arbitraryClassTokens,
    spacingClasses,
    radiusClasses,
    fontWeightClasses,
    componentTags,
    variantNames,
    stateNames,
  };
}

function scoreDrift(file: FileAudit): number {
  let score = 0;
  score += file.hasInlineStyle ? 3 : 0;
  score += file.hardcodedHex.length * 2;
  score += file.hardcodedColorClasses.length;
  score += file.arbitraryClassTokens.length * 2;
  return score;
}

function toTopList(counter: StringCount, limit = 20): Array<[string, number]> {
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function writeArtifact(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function createMarkdown(report: AuditReport): string {
  const topComponents = toTopList(report.inventory.componentTags, 15);
  const topVariants = toTopList(report.inventory.variants, 15);
  const topStates = toTopList(report.inventory.states, 15);
  const topSpacing = toTopList(report.tokens.spacing, 20);
  const topRadius = toTopList(report.tokens.radius, 10);
  const topHardcodedColorClasses = toTopList(report.tokens.hardcodedColorClasses, 20);
  const topDrift = report.drift.topDriftFiles.slice(0, 20);

  const lines: string[] = [];
  lines.push('# Elite UI/UX Baseline Audit');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Files scanned: ${report.summary.filesScanned}`);
  lines.push(`- Route files: ${report.summary.routes}`);
  lines.push(`- Overlay/dialog files: ${report.summary.overlays}`);
  lines.push(`- Inline styles: ${report.summary.inlineStyles}`);
  lines.push(`- Hardcoded hex values: ${report.summary.hardcodedHexCount}`);
  lines.push(`- Hardcoded color utility classes: ${report.summary.hardcodedColorClassCount}`);
  lines.push(`- Arbitrary utility classes ([...]): ${report.summary.arbitraryClassCount}`);
  lines.push('');
  lines.push('## Page Inventory');
  lines.push(`- Pages: ${report.inventory.pages.length}`);
  lines.push(`- Layouts: ${report.inventory.layouts.length}`);
  lines.push(`- Loading states: ${report.inventory.loadings.length}`);
  lines.push(`- Error states: ${report.inventory.errors.length}`);
  lines.push(`- Overlays/Dialogs: ${report.inventory.overlays.length}`);
  lines.push('');
  lines.push('## Top Components');
  for (const [name, count] of topComponents) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('## Variant Coverage');
  for (const [name, count] of topVariants) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('## State Coverage');
  for (const [name, count] of topStates) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('## Token Usage');
  lines.push('### Spacing classes');
  for (const [name, count] of topSpacing) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('### Radius classes');
  for (const [name, count] of topRadius) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('### Hardcoded color classes');
  for (const [name, count] of topHardcodedColorClasses) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('## Drift Hotspots');
  for (const item of topDrift) {
    lines.push(`- ${item.file}: drift score ${item.score}`);
  }
  lines.push('');
  lines.push('## Pain Points');
  for (const point of report.painPoints) {
    lines.push(`- ${point.key}: ${point.description} (${point.signal}: ${point.count})`);
  }
  lines.push('');
  lines.push('## Gate Recommendation');
  lines.push('- Block merge if new hardcoded hex values are introduced.');
  lines.push('- Block merge if arbitrary utility classes increase.');
  lines.push('- Block merge if inline style usage increases.');
  lines.push('- Require semantic token mapping in net-new UI components.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main(): void {
  const files = ROOTS.flatMap((root) => listFiles(root));
  const audits = files.map((file) => analyzeFile(file));

  const componentTags: StringCount = {};
  const variants: StringCount = {};
  const states: StringCount = {};
  const spacing: StringCount = {};
  const radius: StringCount = {};
  const fontWeight: StringCount = {};
  const hardcodedHex: StringCount = {};
  const hardcodedColorClasses: StringCount = {};

  for (const file of audits) {
    for (const token of file.componentTags) pushCount(componentTags, token);
    for (const token of file.variantNames) pushCount(variants, token);
    for (const token of file.stateNames) pushCount(states, token);
    for (const token of file.spacingClasses) pushCount(spacing, token);
    for (const token of file.radiusClasses) pushCount(radius, token);
    for (const token of file.fontWeightClasses) pushCount(fontWeight, token);
    for (const token of file.hardcodedHex) pushCount(hardcodedHex, token);
    for (const token of file.hardcodedColorClasses) pushCount(hardcodedColorClasses, token);
  }

  const pageFiles = audits.filter((x) => x.routeType === 'page').map((x) => x.file);
  const layoutFiles = audits.filter((x) => x.routeType === 'layout').map((x) => x.file);
  const loadingFiles = audits.filter((x) => x.routeType === 'loading').map((x) => x.file);
  const errorFiles = audits
    .filter(
      (x) =>
        x.routeType === 'error' || x.routeType === 'global-error' || x.routeType === 'not-found'
    )
    .map((x) => x.file);
  const overlayFiles = audits.filter((x) => x.hasOverlayPattern).map((x) => x.file);

  const hardcodedStyleFiles = audits
    .filter(
      (x) => x.hasInlineStyle || x.hardcodedHex.length > 0 || x.hardcodedColorClasses.length > 0
    )
    .map((x) => x.file);
  const arbitraryClassFiles = audits
    .filter((x) => x.arbitraryClassTokens.length > 0)
    .map((x) => x.file);

  const spacingOutsideScale = Object.keys(spacing).filter((token) => {
    const match = token.match(/^(?:p|m|gap|space-[xy])(?:[trblxy])?-(\d+(?:\.\d+)?)$/);
    if (!match) {
      return false;
    }
    return !SPACING_ALLOWLIST.has(match[1]);
  });

  const lowStateCoverageFiles = audits.filter(
    (x) => x.routeType === 'page' && x.stateNames.length <= 1
  ).length;
  const componentDensityFiles = audits.filter((x) => x.componentTags.length >= 12).length;

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    roots: ROOTS.map((r) => rel(r)),
    summary: {
      filesScanned: audits.length,
      routes: pageFiles.length + layoutFiles.length + loadingFiles.length + errorFiles.length,
      overlays: overlayFiles.length,
      inlineStyles: audits.filter((x) => x.hasInlineStyle).length,
      hardcodedHexCount: Object.values(hardcodedHex).reduce((a, b) => a + b, 0),
      hardcodedColorClassCount: Object.values(hardcodedColorClasses).reduce((a, b) => a + b, 0),
      arbitraryClassCount: audits.reduce((acc, x) => acc + x.arbitraryClassTokens.length, 0),
    },
    inventory: {
      pages: pageFiles.sort(),
      layouts: layoutFiles.sort(),
      loadings: loadingFiles.sort(),
      errors: errorFiles.sort(),
      overlays: overlayFiles.sort(),
      componentTags,
      variants,
      states,
    },
    tokens: {
      spacing,
      radius,
      fontWeight,
      hardcodedHex,
      hardcodedColorClasses,
    },
    drift: {
      missingSemanticTokenUsage: Object.values(hardcodedColorClasses).reduce((a, b) => a + b, 0),
      hardcodedStyleFiles: hardcodedStyleFiles.sort(),
      arbitraryClassFiles: arbitraryClassFiles.sort(),
      topDriftFiles: audits
        .map((x) => ({ file: x.file, score: scoreDrift(x) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50),
    },
    painPoints: [
      {
        key: 'cognitive-load-dense-components',
        description:
          'Large component density per file signals high scan cost and harder UX reasoning.',
        signal: 'files_with_12+_components',
        count: componentDensityFiles,
      },
      {
        key: 'visual-drift-hardcoded-colors',
        description: 'Hardcoded color utilities increase inconsistency and token drift.',
        signal: 'hardcoded_color_class_occurrences',
        count: Object.values(hardcodedColorClasses).reduce((a, b) => a + b, 0),
      },
      {
        key: 'state-coverage-gap',
        description: 'Low explicit state coverage on route pages increases user confusion risk.',
        signal: 'pages_with_<=1_named_state',
        count: lowStateCoverageFiles,
      },
      {
        key: 'scale-violation-spacing',
        description: 'Spacing utilities outside the approved scale reduce rhythm consistency.',
        signal: 'spacing_tokens_outside_scale',
        count: spacingOutsideScale.length,
      },
      {
        key: 'inline-style-friction',
        description: 'Inline styles weaken enforceability and make audit automation harder.',
        signal: 'files_with_inline_style',
        count: audits.filter((x) => x.hasInlineStyle).length,
      },
    ],
    files: audits.map((x) => ({
      file: x.file,
      routeType: x.routeType,
      inlineStyles: x.hasInlineStyle ? 1 : 0,
      hardcodedColorClasses: x.hardcodedColorClasses.length,
      arbitraryClassTokens: x.arbitraryClassTokens.length,
      hardcodedHex: x.hardcodedHex.length,
      driftScore: scoreDrift(x),
    })),
  };

  const outDir = path.join('artifacts', 'ui-audit');
  writeArtifact(path.join(outDir, 'elite-ui-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeArtifact(path.join(outDir, 'elite-ui-audit.md'), createMarkdown(report));

  console.log(`Elite UI audit completed. Files scanned: ${report.summary.filesScanned}`);
  console.log(`Artifacts: ${rel(path.join(outDir, 'elite-ui-audit.json'))}`);
  console.log(`Artifacts: ${rel(path.join(outDir, 'elite-ui-audit.md'))}`);
}

main();

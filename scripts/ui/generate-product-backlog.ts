import fs from 'node:fs';
import path from 'node:path';

type Audit = {
  topGaps: string[];
  buttonAudit?: {
    states?: Array<{ state: string; found: boolean }>;
  };
};

type BacklogItem = {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  action: string;
};

const inPath = path.join('artifacts', 'ui-audit', 'product-architecture-audit.json');
const outDir = path.join('artifacts', 'ui-audit');
const outJson = path.join(outDir, 'product-gap-backlog.json');
const outMd = path.join(outDir, 'product-gap-backlog.md');

function priorityFor(gap: string): 'P0' | 'P1' | 'P2' {
  const g = gap.toLowerCase();
  if (g.includes('auth layer') || g.includes('permission denied') || g.includes('error'))
    return 'P0';
  if (g.includes('app core') || g.includes('checkout') || g.includes('button variant')) return 'P1';
  return 'P2';
}

function actionFor(gap: string): string {
  if (gap.includes(':')) {
    const [, item] = gap.split(':');
    return `Implement/upgrade "${item.trim()}" with route contract + Playwright coverage.`;
  }
  return `Implement/upgrade ${gap} with route contract + Playwright coverage.`;
}

function main() {
  if (!fs.existsSync(inPath)) {
    console.error(`Missing audit input: ${inPath}. Run "pnpm ui:product:audit" first.`);
    process.exit(1);
  }
  const audit = JSON.parse(fs.readFileSync(inPath, 'utf8')) as Audit;
  const seedGaps = [...(audit.topGaps || [])];
  const missingStates = (audit.buttonAudit?.states || [])
    .filter((s) => !s.found)
    .map((s) => `Button State: ${s.state}`);
  seedGaps.push(...missingStates);

  const items: BacklogItem[] = seedGaps.map((gap, idx) => ({
    id: `UI-GAP-${String(idx + 1).padStart(3, '0')}`,
    priority: priorityFor(gap),
    title: gap,
    action: actionFor(gap),
  }));

  items.sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id));

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outJson,
    JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2),
    'utf8'
  );

  const lines = [
    '# UI Gap Backlog',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| ID | Priority | Title | Action |',
    '|---|---|---|---|',
    ...items.map((i) => `| ${i.id} | ${i.priority} | ${i.title} | ${i.action} |`),
  ];
  fs.writeFileSync(outMd, lines.join('\n'), 'utf8');

  console.log(`Backlog JSON: ${outJson}`);
  console.log(`Backlog MD: ${outMd}`);
  console.log(`Items: ${items.length}`);
}

main();

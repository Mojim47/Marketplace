import fs from 'node:fs';
import path from 'node:path';

type Row = {
  route: string;
  owner: string;
  layer: string;
  status: 'implemented' | 'placeholder';
  source: string;
};

const webAppDir = path.join('apps', 'web', 'app');
const outDir = path.join('artifacts', 'ui-audit');
const outJson = path.join(outDir, 'page-matrix.json');
const outMd = path.join(outDir, 'page-matrix.md');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full.replace(/\\/g, '/'));
    }
  }
  return out;
}

function toRoute(file: string): string | null {
  if (!file.endsWith('/page.tsx')) {
    return null;
  }
  const rel = file.replace(/^apps\/web\/app\//, '').replace(/\/page\.tsx$/, '');
  if (!rel || rel === 'page.tsx') {
    return '/';
  }
  const cleaned = rel
    .split('/')
    .filter((seg) => !seg.startsWith('('))
    .join('/');
  return `/${cleaned}`.replace(/\/+/g, '/');
}

function ownerFor(route: string): string {
  if (route.startsWith('/auth')) return 'identity-team';
  if (route.startsWith('/checkout') || route.startsWith('/cart') || route.startsWith('/orders')) return 'commerce-team';
  if (route.startsWith('/profile') || route.startsWith('/billing') || route.startsWith('/notifications')) return 'account-team';
  if (route === '/' || route.startsWith('/pricing') || route.startsWith('/docs') || route.startsWith('/blog') || route.startsWith('/about')) return 'growth-team';
  if (route.startsWith('/maintenance') || route.startsWith('/403') || route.startsWith('/empty-state')) return 'platform-team';
  return 'web-platform';
}

function layerFor(route: string): string {
  if (route === '/' || route.startsWith('/pricing') || route.startsWith('/docs') || route.startsWith('/blog') || route.startsWith('/about')) return 'marketing';
  if (route.startsWith('/auth')) return 'auth';
  if (route.startsWith('/maintenance') || route.startsWith('/empty-state') || route.startsWith('/403') || route.startsWith('/offline')) return 'state';
  return 'app-core';
}

function main() {
  const files = walk(webAppDir);
  const rows: Row[] = [];
  for (const file of files) {
    const route = toRoute(file);
    if (!route) continue;
    rows.push({
      route,
      owner: ownerFor(route),
      layer: layerFor(route),
      status: 'implemented',
      source: file,
    });
  }
  rows.sort((a, b) => a.route.localeCompare(b.route));

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2), 'utf8');

  const lines = [
    '# Page Matrix',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Route | Layer | Owner | Status | Source |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.route} | ${r.layer} | ${r.owner} | ${r.status} | ${r.source} |`),
  ];
  fs.writeFileSync(outMd, lines.join('\n'), 'utf8');

  console.log(`Page matrix JSON: ${outJson}`);
  console.log(`Page matrix MD: ${outMd}`);
  console.log(`Routes: ${rows.length}`);
}

main();

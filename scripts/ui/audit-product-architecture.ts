import fs from 'node:fs';
import path from 'node:path';

type CoverageItem = {
  key: string;
  label: string;
  found: boolean;
  matchedBy?: string;
};

type CategoryReport = {
  name: string;
  coverage: number;
  found: number;
  total: number;
  items: CoverageItem[];
};

const webAppDir = path.join('apps', 'web', 'app');
const buttonPath = path.join('apps', 'web', 'components', 'ui', 'Button.tsx');
const outDir = path.join('artifacts', 'ui-audit');
const outJson = path.join(outDir, 'product-architecture-audit.json');
const outMd = path.join(outDir, 'product-architecture-audit.md');

const required = {
  marketing: [
    { key: 'landing', label: 'Landing', patterns: ['apps/web/app/page.tsx'] },
    { key: 'pricing', label: 'Pricing', patterns: ['/pricing/page.tsx'] },
    { key: 'about', label: 'About', patterns: ['/about/page.tsx'] },
    { key: 'docs', label: 'Docs', patterns: ['/docs/page.tsx'] },
    { key: 'blog', label: 'Blog', patterns: ['/blog/page.tsx'] },
  ],
  auth: [
    { key: 'login', label: 'Login', patterns: ['/auth/login/page.tsx'] },
    { key: 'register', label: 'Register', patterns: ['/auth/register/page.tsx'] },
    { key: 'reset_password', label: 'Reset Password', patterns: ['/auth/reset-password/page.tsx'] },
    { key: 'verify_email', label: 'Verify Email', patterns: ['/auth/verify', '/verify-email/page.tsx'] },
    { key: 'two_factor', label: '2FA', patterns: ['/auth/2fa', '/2fa'] },
  ],
  appCore: [
    { key: 'dashboard', label: 'Dashboard', patterns: ['/dashboard/page.tsx'] },
    { key: 'workflow', label: 'Main Workflow', patterns: ['/checkout/page.tsx', '/cart/page.tsx'] },
    { key: 'detail', label: 'Detail Page', patterns: ['/product/[id]/page.tsx', '/categories/[slug]/page.tsx'] },
    { key: 'settings', label: 'Settings', patterns: ['/settings/page.tsx', '/profile/page.tsx'] },
    { key: 'profile', label: 'Profile', patterns: ['/profile/page.tsx'] },
    { key: 'billing', label: 'Billing', patterns: ['/billing/page.tsx'] },
    { key: 'notifications', label: 'Notifications', patterns: ['/notifications/page.tsx'] },
    { key: 'activity_log', label: 'Activity Log', patterns: ['/activity', '/audit-log'] },
  ],
  statePages: [
    { key: 'empty_state', label: 'Empty State', patterns: ['/empty-state/page.tsx'] },
    { key: 'error_state', label: 'Error State', patterns: ['/error.tsx', 'global-error.tsx'] },
    { key: 'loading_state', label: 'Loading State', patterns: ['/loading.tsx'] },
    { key: 'permission_denied', label: 'Permission Denied', patterns: ['/403/page.tsx', '/permission-denied/page.tsx'] },
    { key: 'not_found', label: '404 Not Found', patterns: ['/not-found.tsx'] },
    { key: 'maintenance', label: 'Maintenance', patterns: ['/maintenance'] },
  ],
};

const requiredButtons = ['primary', 'secondary', 'ghost', 'danger', 'subtle', 'icon', 'floating'];

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }
    if (e.isFile()) {
      out.push(full.replace(/\\/g, '/'));
    }
  }
  return out;
}

function toCoverage(
  name: string,
  defs: Array<{ key: string; label: string; patterns: string[] }>,
  files: string[]
): CategoryReport {
  const items: CoverageItem[] = defs.map((def) => {
    for (const pattern of def.patterns) {
      const found = files.find((f) => f.toLowerCase().includes(pattern.toLowerCase()));
      if (found) {
        return { key: def.key, label: def.label, found: true, matchedBy: found };
      }
    }
    return { key: def.key, label: def.label, found: false };
  });
  const found = items.filter((x) => x.found).length;
  const total = items.length;
  return {
    name,
    coverage: total === 0 ? 100 : Math.round((found / total) * 100),
    found,
    total,
    items,
  };
}

function auditButtons(buttonFile: string) {
  const src = fs.existsSync(buttonFile) ? fs.readFileSync(buttonFile, 'utf8') : '';
  const variants = requiredButtons.map((name) => ({
    name,
    found: src.includes(`'${name}'`) || src.includes(`"${name}"`) || src.includes(`${name}:`),
  }));
  const states = ['loading', 'disabled', 'hover', 'focus', 'active'].map((state) => ({
    state,
    found: src.toLowerCase().includes(state),
  }));
  return {
    variants,
    states,
    variantCoverage: Math.round((variants.filter((x) => x.found).length / variants.length) * 100),
    stateCoverage: Math.round((states.filter((x) => x.found).length / states.length) * 100),
  };
}

function writeMarkdown(report: any) {
  const lines: string[] = [];
  lines.push('# UI Product Architecture Audit');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`Overall Coverage: **${report.overallCoverage}%**`);
  lines.push('');

  for (const category of report.categories as CategoryReport[]) {
    lines.push(`## ${category.name} (${category.coverage}%)`);
    for (const item of category.items) {
      if (item.found) {
        lines.push(`- PASS: ${item.label} -> ${item.matchedBy}`);
      } else {
        lines.push(`- FAIL: ${item.label}`);
      }
    }
    lines.push('');
  }

  lines.push('## Button System');
  lines.push(`- Variant coverage: ${report.buttonAudit.variantCoverage}%`);
  for (const v of report.buttonAudit.variants) {
    lines.push(`- ${v.found ? 'PASS' : 'FAIL'}: ${v.name}`);
  }
  lines.push(`- State coverage: ${report.buttonAudit.stateCoverage}%`);
  for (const s of report.buttonAudit.states) {
    lines.push(`- ${s.found ? 'PASS' : 'FAIL'}: ${s.state}`);
  }
  lines.push('');

  lines.push('## Immediate Gaps');
  for (const gap of report.topGaps as string[]) {
    lines.push(`- ${gap}`);
  }

  return lines.join('\n');
}

function main() {
  const files = walkFiles(webAppDir);

  const categories: CategoryReport[] = [
    toCoverage('Marketing Layer', required.marketing, files),
    toCoverage('Auth Layer', required.auth, files),
    toCoverage('App Core Layer', required.appCore, files),
    toCoverage('State Pages Layer', required.statePages, files),
  ];

  const buttonAudit = auditButtons(buttonPath);
  const categoryAvg = Math.round(
    categories.reduce((sum, c) => sum + c.coverage, 0) / (categories.length || 1)
  );
  const overallCoverage = Math.round((categoryAvg + buttonAudit.variantCoverage + buttonAudit.stateCoverage) / 3);

  const missing = categories.flatMap((c) =>
    c.items.filter((i) => !i.found).map((i) => `${c.name}: ${i.label}`)
  );
  const missingButtonVariants = buttonAudit.variants
    .filter((x: { found: boolean }) => !x.found)
    .map((x: { name: string }) => `Button Variant: ${x.name}`);

  const topGaps = [...missing, ...missingButtonVariants].slice(0, 12);

  const report = {
    generatedAt: new Date().toISOString(),
    scanRoot: webAppDir,
    fileCount: files.length,
    overallCoverage,
    categories,
    buttonAudit,
    topGaps,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outMd, writeMarkdown(report), 'utf8');

  const minCoverageRaw = process.env.UI_PRODUCT_AUDIT_MIN_COVERAGE || '0';
  const minCoverage = Number(minCoverageRaw);
  if (Number.isFinite(minCoverage) && minCoverage > 0 && overallCoverage < minCoverage) {
    console.error(
      `UI product audit failed: overall ${overallCoverage}% is below required ${minCoverage}%.`
    );
    process.exit(1);
  }

  console.log(`UI product audit JSON: ${outJson}`);
  console.log(`UI product audit MD: ${outMd}`);
  console.log(`Overall coverage: ${overallCoverage}%`);
}

main();

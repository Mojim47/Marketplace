import fs from 'node:fs';
import path from 'node:path';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  zIndex,
} from '../../libs/design-system/src/tokens';

type JsonMap = Record<string, unknown>;

function hexToRgb(hex: string): string {
  const normalized = hex.replace('#', '');
  const bigint = Number.parseInt(
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized,
    16
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

function flattenColors(): string[] {
  const lines: string[] = [];

  for (const [group, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      lines.push(`  --color-${group}: ${value};`);
      lines.push(`  --color-${group}-rgb: ${hexToRgb(value)};`);
      continue;
    }

    for (const [shade, shadeValue] of Object.entries(value as JsonMap)) {
      const token = `--color-${group}-${shade}`;
      lines.push(`  ${token}: ${shadeValue};`);
      if (typeof shadeValue === 'string' && shadeValue.startsWith('#')) {
        lines.push(`  ${token}-rgb: ${hexToRgb(shadeValue)};`);
      }
    }
  }

  return lines;
}

function flattenScale(prefix: string, scale: Record<string, string | number>): string[] {
  return Object.entries(scale).map(([key, value]) => `  --${prefix}-${key}: ${String(value)};`);
}

function buildCss(): string {
  const lines: string[] = [];
  lines.push(':root {');
  lines.push(...flattenColors());
  lines.push(...flattenScale('space', spacing as Record<string, string | number>));
  lines.push(...flattenScale('radius', borderRadius as Record<string, string | number>));
  lines.push(...flattenScale('shadow', shadows as Record<string, string | number>));
  lines.push(...flattenScale('z', zIndex as Record<string, string | number>));
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function tailwindColor(token: string): string {
  return `rgb(var(${token}-rgb) / <alpha-value>)`;
}

function buildTailwindTokens(): JsonMap {
  const colorTokens: JsonMap = {};
  for (const [group, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      colorTokens[group] = tailwindColor(`--color-${group}`);
      continue;
    }
    const groupMap: JsonMap = {};
    for (const [shade] of Object.entries(value as JsonMap)) {
      groupMap[shade] = tailwindColor(`--color-${group}-${shade}`);
    }
    colorTokens[group] = groupMap;
  }

  return {
    colors: colorTokens,
    spacing: Object.fromEntries(Object.keys(spacing).map((key) => [key, `var(--space-${key})`])),
    borderRadius: Object.fromEntries(
      Object.keys(borderRadius).map((key) => [key, `var(--radius-${key})`])
    ),
    boxShadow: Object.fromEntries(Object.keys(shadows).map((key) => [key, `var(--shadow-${key})`])),
    zIndex: Object.fromEntries(Object.keys(zIndex).map((key) => [key, `var(--z-${key})`])),
  };
}

function writeFileIfChanged(filePath: string, contents: string): boolean {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf-8');
    if (current === contents) {
      return false;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return true;
}

function main() {
  const check = process.argv.includes('--check');
  const css = buildCss();
  const tokens = `${JSON.stringify(buildTailwindTokens(), null, 2)}\n`;

  const webCssPath = path.join('apps', 'web', 'app', 'design-tokens.css');
  const adminCssPath = path.join('apps', 'admin', 'src', 'app', 'design-tokens.css');
  const webTailwindPath = path.join('apps', 'web', 'tailwind.tokens.json');
  const adminTailwindPath = path.join('apps', 'admin', 'tailwind.tokens.json');

  const expected: Record<string, string> = {
    [webCssPath]: css,
    [adminCssPath]: css,
    [webTailwindPath]: tokens,
    [adminTailwindPath]: tokens,
  };

  const mismatches: string[] = [];
  for (const [filePath, content] of Object.entries(expected)) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    if (check) {
      if (existing !== content) {
        mismatches.push(filePath);
      }
    } else {
      writeFileIfChanged(filePath, content);
    }
  }

  if (mismatches.length > 0) {
    console.error('Design tokens are out of sync. Regenerate and commit:');
    for (const file of mismatches) {
      console.error(`- ${file}`);
    }
    process.exit(1);
  }
}

main();

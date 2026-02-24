#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const mode = process.argv.includes('--staged')
  ? 'staged'
  : process.argv.includes('--git-changed')
    ? 'git-changed'
    : 'all';
const enforceAsciiScripts =
  mode === 'staged' || process.argv.includes('--enforce-ascii-scripts');
const explicitFiles = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith('--'))
  .map((arg) => arg.trim())
  .filter(Boolean);

const textExtensions = new Set([
  '.md',
  '.txt',
  '.yml',
  '.yaml',
  '.json',
  '.sh',
  '.mjs',
  '.cjs',
  '.js',
  '.ts',
  '.tsx',
  '.css',
  '.scss',
  '.html',
  '.env',
  '.toml',
  '.ini',
]);

const asciiOnlyExtensions = new Set(['.sh', '.mjs', '.cjs', '.ps1', '.cmd', '.bat']);
const alwaysTextFiles = new Set(['.gitattributes', '.editorconfig', '.gitignore']);

function fail(message) {
  console.error(`[text-governance][fatal] ${message}`);
  process.exitCode = 1;
}

function listTargetFiles() {
  if (explicitFiles.length > 0) {
    return explicitFiles.filter((file) => fs.existsSync(file));
  }

  const command =
    mode === 'staged'
      ? 'git diff --cached --name-only --diff-filter=ACMR'
      : mode === 'git-changed'
        ? 'git diff --name-only --diff-filter=ACMR HEAD~1..HEAD'
        : 'git ls-files --cached';

  const stdout = execSync(command, { encoding: 'utf8' });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => fs.existsSync(file));
}

function shouldCheck(filePath) {
  const base = path.basename(filePath);
  if (alwaysTextFiles.has(base)) {
    return true;
  }
  if (base.startsWith('.env')) {
    return true;
  }
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

function isAscii(buffer) {
  for (const byte of buffer) {
    if (byte > 0x7f) {
      return false;
    }
  }
  return true;
}

function hasCrlf(buffer) {
  for (let i = 1; i < buffer.length; i += 1) {
    if (buffer[i - 1] === 0x0d && buffer[i] === 0x0a) {
      return true;
    }
  }
  return false;
}

function isUtf8(buffer) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function validateFile(filePath) {
  const errors = [];
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    errors.push('UTF-8 BOM is not allowed');
  }

  if (buffer.length >= 2) {
    if (
      (buffer[0] === 0xff && buffer[1] === 0xfe) ||
      (buffer[0] === 0xfe && buffer[1] === 0xff)
    ) {
      errors.push('UTF-16 BOM detected; use UTF-8 without BOM');
    }
  }

  if (!isUtf8(buffer)) {
    errors.push('File is not valid UTF-8');
  }

  if (hasCrlf(buffer)) {
    errors.push('CRLF detected; use LF');
  }

  if (enforceAsciiScripts && asciiOnlyExtensions.has(ext) && !isAscii(buffer)) {
    errors.push('Non-ASCII characters are not allowed in executable scripts');
  }

  return errors;
}

const files = listTargetFiles().filter(shouldCheck);
if (files.length === 0) {
  process.exit(0);
}

let failures = 0;
for (const filePath of files) {
  const issues = validateFile(filePath);
  if (issues.length > 0) {
    failures += 1;
    for (const issue of issues) {
      fail(`${filePath}: ${issue}`);
    }
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`[text-governance] OK (${files.length} files checked, mode=${mode})`);

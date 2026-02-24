#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || '').trim() || `${cmd} failed`);
  }
  return (result.stdout || '').trim();
}

function resolveBaseSha() {
  const fromEnv =
    process.env.BASE_SHA ||
    process.env.GITHUB_BASE_SHA ||
    process.env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA ||
    '';
  if (fromEnv) {
    return fromEnv;
  }
  try {
    return run('git', ['rev-parse', 'HEAD~1']);
  } catch {
    return run('git', ['rev-parse', 'HEAD']);
  }
}

function listChanged(baseSha) {
  const output = run('git', ['diff', '--name-only', '--diff-filter=ACMR', `${baseSha}...HEAD`]);
  if (!output) {
    return [];
  }
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => fs.existsSync(file))
    .filter((file) => ALLOWED_EXT.has(file.slice(file.lastIndexOf('.'))));
}

function main() {
  const baseSha = resolveBaseSha();
  const changed = listChanged(baseSha);

  if (changed.length === 0) {
    console.log('biome-check: no changed source files, skipping.');
    return;
  }

  const check = spawnSync('pnpm', ['exec', 'biome', 'check', ...changed], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (check.status !== 0) {
    process.exit(check.status ?? 1);
  }
}

main();

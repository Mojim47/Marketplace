#!/usr/bin/env node

const _fs = require('node:fs');
const _path = require('node:path');
const { execSync } = require('node:child_process');

try {
  execSync('pnpm install --legacy-peer-deps', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
} catch (error) {
  console.error('Installation failed:', error.message);
  process.exit(1);
}

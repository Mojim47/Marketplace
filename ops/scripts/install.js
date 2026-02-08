#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Installing dependencies...');
const { execSync } = require('child_process');

try {
  execSync('pnpm install --legacy-peer-deps', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  console.log('Dependencies installed successfully!');
} catch (error) {
  console.error('Installation failed:', error.message);
  process.exit(1);
}

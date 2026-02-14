const fs = require('node:fs');

const required = [
  '.copilot/shadow-context.json',
  '.copilot/system-prompt.txt',
  '.vscode/settings.json',
];

const missing = required.filter((f) => !fs.existsSync(f));

if (missing.length) {
  console.error('❌ Missing:', missing);
  process.exit(1);
} else {
}

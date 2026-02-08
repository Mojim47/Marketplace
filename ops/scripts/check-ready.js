const fs = require('fs');

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
  console.log('✅ All critical files present.');
  console.log('🚀 Ready for full autonomy.');
}

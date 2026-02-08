#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const memoryPath = path.join(root, '.copilot', 'memory.json');

/**
 * Simple append-only memory with tags.
 * Usage:
 *  node ./ops/scripts/agent-memory.mjs add --note "text" --tags tag1,tag2
 *  node ./ops/scripts/agent-memory.mjs list [--tag tag]
 *  node ./ops/scripts/agent-memory.mjs clear [--confirm yes]
 */

function load() {
  if (!fs.existsSync(memoryPath)) {
    fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
    fs.writeFileSync(memoryPath, JSON.stringify({ notes: [], tags: [], lastUpdated: null }, null, 2));
  }
  return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
}

function save(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';
  const map = new Map();
  for (let i = 1; i < args.length; i += 2) {
    const k = args[i];
    const v = args[i + 1];
    if (k && k.startsWith('--')) map.set(k.slice(2), v ?? '');
  }
  return { cmd, opts: Object.fromEntries(map) };
}

function addNote(opts) {
  const note = opts.note || opts.n;
  if (!note) {
    console.error('Missing --note');
    process.exit(1);
  }
  const tags = (opts.tags || opts.t || '').split(',').map(s => s.trim()).filter(Boolean);
  const m = load();
  const entry = { id: `${Date.now()}`, note, tags, ts: new Date().toISOString() };
  m.notes.push(entry);
  for (const t of tags) if (!m.tags.includes(t)) m.tags.push(t);
  save(m);
  console.log('Added note:', entry);
}

function listNotes(opts) {
  const tag = opts.tag || opts.t;
  const m = load();
  const items = tag ? m.notes.filter(n => n.tags.includes(tag)) : m.notes;
  console.log(JSON.stringify({ count: items.length, items }, null, 2));
}

function clearNotes(opts) {
  if ((opts.confirm || '').toLowerCase() !== 'yes') {
    console.error('Refusing to clear without --confirm yes');
    process.exit(1);
  }
  save({ notes: [], tags: [], lastUpdated: null });
  console.log('Memory cleared.');
}

function main() {
  const { cmd, opts } = parseArgs();
  switch (cmd) {
    case 'add':
      return addNote(opts);
    case 'list':
      return listNotes(opts);
    case 'clear':
      return clearNotes(opts);
    default:
      console.log(`Usage:\n  node ./ops/scripts/agent-memory.mjs add --note "text" --tags tag1,tag2\n  node ./ops/scripts/agent-memory.mjs list [--tag tag]\n  node ./ops/scripts/agent-memory.mjs clear --confirm yes`);
  }
}

main();

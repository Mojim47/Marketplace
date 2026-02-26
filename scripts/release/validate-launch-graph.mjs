#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const graphPath = path.resolve(
  process.cwd(),
  process.env.LAUNCH_GRAPH_PATH || 'ops/contracts/launch-integration-graph.json'
);

function fail(message) {
  console.error(`[launch-graph][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(graphPath)) {
  fail(`graph contract not found: ${graphPath}`);
}

let graph;
try {
  graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
} catch (_error) {
  fail(`invalid JSON: ${graphPath}`);
}

const modules = Array.isArray(graph.requiredModules) ? graph.requiredModules : null;
const excluded = Array.isArray(graph.excludedModules) ? graph.excludedModules : null;
if (!modules || !excluded) {
  fail('requiredModules and excludedModules must be arrays');
}

const byId = new Map();
for (const mod of modules) {
  if (!mod || typeof mod.id !== 'string' || mod.id.trim() === '') {
    fail('each module requires non-empty id');
  }
  if (byId.has(mod.id)) {
    fail(`duplicate module id: ${mod.id}`);
  }
  if (!Array.isArray(mod.dependsOn)) {
    fail(`module dependsOn must be array: ${mod.id}`);
  }
  if (!Array.isArray(mod.artifactRoots) || mod.artifactRoots.length === 0) {
    fail(`module artifactRoots must be non-empty array: ${mod.id}`);
  }
  byId.set(mod.id, mod);
}

for (const mod of modules) {
  for (const dep of mod.dependsOn) {
    if (!byId.has(dep)) {
      fail(`module ${mod.id} depends on unknown module ${dep}`);
    }
  }
}

const excludedSet = new Set(excluded);
for (const mod of modules) {
  if (excludedSet.has(mod.id)) {
    fail(`module is both required and excluded: ${mod.id}`);
  }
}

const indegree = new Map();
const edges = new Map();
for (const mod of modules) {
  indegree.set(mod.id, 0);
  edges.set(mod.id, []);
}
for (const mod of modules) {
  for (const dep of mod.dependsOn) {
    edges.get(dep).push(mod.id);
    indegree.set(mod.id, indegree.get(mod.id) + 1);
  }
}

const zero = [...indegree.entries()]
  .filter(([, deg]) => deg === 0)
  .map(([id]) => id)
  .sort();
const order = [];

while (zero.length > 0) {
  const current = zero.shift();
  order.push(current);
  const next = edges.get(current) || [];
  next.sort();
  for (const node of next) {
    indegree.set(node, indegree.get(node) - 1);
    if (indegree.get(node) === 0) {
      zero.push(node);
      zero.sort();
    }
  }
}

if (order.length !== modules.length) {
  fail('dependency cycle detected in launch graph');
}

const graphDigest = crypto
  .createHash('sha256')
  .update(JSON.stringify({ requiredModules: modules, excludedModules: excluded }))
  .digest('hex');

console.log(`[launch-graph] validated modules=${modules.length} excluded=${excluded.length}`);
console.log(`[launch-graph] deterministic order=${order.join(' -> ')}`);
console.log(`[launch-graph] digest=${graphDigest}`);

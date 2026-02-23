#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const contractPath = path.resolve(
  process.cwd(),
  process.env.STATE_MACHINE_CONTRACT_PATH || 'ops/contracts/state-machine-contract.json'
);

function fail(message) {
  console.error(`[state-machine-contract][fatal] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(contractPath)) {
  fail(`missing contract: ${contractPath}`);
}

let contract;
try {
  contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
} catch (_error) {
  fail(`invalid JSON: ${contractPath}`);
}

const logFields = contract.structuredLogRequiredFields;
if (!Array.isArray(logFields)) {
  fail('structuredLogRequiredFields must be array');
}
for (const key of ['traceId', 'prevState', 'nextState', 'guardReason']) {
  if (!logFields.includes(key)) {
    fail(`structured log field missing: ${key}`);
  }
}

const machines = Array.isArray(contract.machines) ? contract.machines : [];
if (machines.length === 0) {
  fail('machines must be a non-empty array');
}

for (const machine of machines) {
  if (!machine.immutable) {
    fail(`machine must be immutable: ${machine.name}`);
  }
  if (!machine.initialState || typeof machine.initialState !== 'string') {
    fail(`machine ${machine.name} initialState is required`);
  }
  if (!machine.allowedTransitions || typeof machine.allowedTransitions !== 'object') {
    fail(`machine ${machine.name} allowedTransitions is required`);
  }

  const states = new Set(Object.keys(machine.allowedTransitions));
  if (!states.has(machine.initialState)) {
    fail(`machine ${machine.name} initialState not found in states`);
  }

  for (const [fromState, toStates] of Object.entries(machine.allowedTransitions)) {
    if (!Array.isArray(toStates)) {
      fail(`machine ${machine.name} transitions for ${fromState} must be array`);
    }
    const uniqueToStates = new Set(toStates);
    if (uniqueToStates.size !== toStates.length) {
      fail(`machine ${machine.name} duplicate transitions from ${fromState}`);
    }
    for (const toState of toStates) {
      if (!states.has(toState)) {
        fail(`machine ${machine.name} has unknown target state ${toState}`);
      }
    }
  }

  const forbidden = Array.isArray(machine.forbiddenTransitions) ? machine.forbiddenTransitions : [];
  for (const pair of forbidden) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      fail(`machine ${machine.name} forbidden transition must be [from,to]`);
    }
    const [fromState, toState] = pair;
    if (!states.has(fromState) || !states.has(toState)) {
      fail(`machine ${machine.name} forbidden transition has unknown state ${fromState}->${toState}`);
    }
    if ((machine.allowedTransitions[fromState] || []).includes(toState)) {
      fail(`machine ${machine.name} conflict: ${fromState}->${toState} is both allowed and forbidden`);
    }
  }
}

if (contract?.runtimeReconciliation?.requiredReadyInvariant !== true) {
  fail('runtimeReconciliation.requiredReadyInvariant must be true');
}
if (contract?.runtimeReconciliation?.autoDegradedHandlingRequired !== true) {
  fail('runtimeReconciliation.autoDegradedHandlingRequired must be true');
}

console.log(`[state-machine-contract] validated machines=${machines.length}`);

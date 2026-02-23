import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const tmpFiles: string[] = [];

function writeTmpJson(name: string, content: string): string {
  const filePath = path.join(os.tmpdir(), `${name}-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(filePath, content, 'utf8');
  tmpFiles.push(filePath);
  return filePath;
}

function runNodeScript(scriptPath: string, env?: NodeJS.ProcessEnv): string {
  return execFileSync('node', [scriptPath], {
    cwd: repoRoot,
    env: { ...process.env, ...(env ?? {}) },
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const filePath of tmpFiles.splice(0, tmpFiles.length)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
});

describe('secrets contract schema gates', () => {
  it('passes for committed policy schema', () => {
    const output = runNodeScript('scripts/release/verify-secrets-policy-schema.mjs');
    expect(output).toContain('"status": "ok"');
  });

  it('fails for invalid policy payload against JSON schema', () => {
    const invalidPolicyPath = writeTmpJson(
      'policy-invalid',
      JSON.stringify(
        {
          $schema: './secrets-rotation-policy.schema.json',
          version: '2026.1',
          denyByDefault: true,
          requiredSecrets: [{ name: 'DATABASE_URL', maxAgeDays: 90 }],
        },
        null,
        2
      )
    );

    expect(() =>
      runNodeScript('scripts/release/verify-secrets-policy-schema.mjs', {
        SECRETS_ROTATION_POLICY_PATH: invalidPolicyPath,
      })
    ).toThrowError(/secrets-policy-schema FAIL/);
  });

  it('fails when registry and policy are out of sync', () => {
    const mismatchedRegistryPath = writeTmpJson(
      'registry-mismatch',
      JSON.stringify(
        {
          $schema: './secrets-rotation-registry.schema.json',
          version: '2026.1',
          runtimeSecrets: ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'NEW_SECRET'],
        },
        null,
        2
      )
    );

    expect(() =>
      runNodeScript('scripts/release/verify-secrets-contract-sync.mjs', {
        SECRETS_ROTATION_REGISTRY_PATH: mismatchedRegistryPath,
      })
    ).toThrowError(/secrets-contract-sync FAIL/);
  });
});

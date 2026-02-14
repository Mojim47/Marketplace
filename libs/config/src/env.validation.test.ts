import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnvFiles, validateEnv } from './env.validation';

describe('env validation negative cases', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('fails when production API secrets are missing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
      CORS_ORIGINS: 'https://example.com',
    };

    const result = validateEnv({ env, service: 'api', exitOnError: false });
    expect(result).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails when neither REDIS_URL nor KEYDB_URL is set', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'x'.repeat(32),
      JWT_REFRESH_SECRET: 'y'.repeat(32),
    };

    const result = validateEnv({ env, service: 'api', exitOnError: false });
    expect(result).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not load env files in production by default', () => {
    process.env.NODE_ENV = 'production';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextgen-env-'));
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'TEST_ENV_SHOULD_NOT_LOAD=1\n');

    const loaded = loadEnvFiles({ cwd: tmpDir });
    expect(loaded.length).toBe(0);
    expect(process.env.TEST_ENV_SHOULD_NOT_LOAD).toBeUndefined();
  });
});

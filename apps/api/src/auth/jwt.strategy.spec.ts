import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy production enforcement', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws in production without public key even if secret is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.JWT_SECRET_DEV;

    expect(() => new JwtStrategy({ validateUser: vi.fn() } as any)).toThrow(
      /JWT_PUBLIC_KEY/,
    );
  });

  it('allows HS256 in non-production when secret is provided', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'a'.repeat(64);
    delete process.env.JWT_PUBLIC_KEY;

    expect(() => new JwtStrategy({ validateUser: vi.fn() } as any)).not.toThrow();
  });

  it('allows RS256 in production when public key is provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_PUBLIC_KEY =
      '-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtest\\n-----END PUBLIC KEY-----';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_SECRET_DEV;

    expect(() => new JwtStrategy({ validateUser: vi.fn() } as any)).not.toThrow();
  });
});

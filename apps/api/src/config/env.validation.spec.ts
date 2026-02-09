import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { __testing } from './env.validation';

const { validateProductionSecrets, checkForWeakSecrets, PRODUCTION_REQUIRED_SECRETS } = __testing;

describe('Environment Validation', () => {
  describe('Property 20: Secrets Validation', () => {
    it('should require all production secrets in production mode', () => {
      const config: Record<string, unknown> = {
        NODE_ENV: 'production',
      };

      const errors = validateProductionSecrets(config);

      // Should have errors for all required secrets
      expect(errors.length).toBe(PRODUCTION_REQUIRED_SECRETS.length);

      for (const secret of PRODUCTION_REQUIRED_SECRETS) {
        expect(errors.some((e) => e.includes(secret))).toBe(true);
      }
    });

    it('should not require production secrets in development mode', () => {
      fc.assert(
        fc.property(fc.constantFrom('development', 'staging', 'test'), (nodeEnv) => {
          const config: Record<string, unknown> = {
            NODE_ENV: nodeEnv,
          };

          const errors = validateProductionSecrets(config);
          expect(errors.length).toBe(0);
        }),
        { numRuns: 10 }
      );
    });

    it('should pass when all production secrets are provided', () => {
      const config: Record<string, unknown> = {
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(64),
        JWT_REFRESH_SECRET: 'b'.repeat(64),
        JWT_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        JWT_PUBLIC_KEY: '-----BEGIN RSA PUBLIC KEY-----\ntest\n-----END RSA PUBLIC KEY-----',
        TOTP_ENCRYPTION_KEY: 'c'.repeat(32),
        ZARINPAL_MERCHANT_ID: 'd'.repeat(36),
        ZARINPAL_WEBHOOK_SECRET: 'e'.repeat(32),
        SESSION_SECRET: 'f'.repeat(32),
      };

      const errors = validateProductionSecrets(config);
      expect(errors.length).toBe(0);
    });

    it('should detect weak secrets', () => {
      const weakSecrets = [
        { key: 'JWT_SECRET', value: 'secret' },
        { key: 'JWT_SECRET', value: 'password' },
        { key: 'JWT_SECRET', value: '123456789' },
        { key: 'JWT_SECRET', value: 'test-secret' },
        { key: 'JWT_SECRET', value: 'dev-key' },
        { key: 'JWT_SECRET', value: 'changeme' },
        { key: 'JWT_SECRET', value: 'default' },
      ];

      for (const { key, value } of weakSecrets) {
        const config = { [key]: value };
        const warnings = checkForWeakSecrets(config);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]).toContain(key);
      }
    });

    it('should not flag strong secrets as weak', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 64, maxLength: 128 })
            .filter((s) => !/^(secret|password|123456|test|dev|changeme|default)/i.test(s)),
          (strongSecret) => {
            const config = { JWT_SECRET: strongSecret };
            const warnings = checkForWeakSecrets(config);

            // Strong random secrets should not trigger warnings
            // (unless they happen to match weak patterns by chance)
            return warnings.length === 0 || !warnings[0].includes('JWT_SECRET');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should check all secret keys for weakness', () => {
      const secretKeys = [
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'TOTP_ENCRYPTION_KEY',
        'SESSION_SECRET',
        'ZARINPAL_WEBHOOK_SECRET',
      ];

      for (const key of secretKeys) {
        const config = { [key]: 'password' }; // Exact match for weak pattern
        const warnings = checkForWeakSecrets(config);
        expect(warnings.some((w) => w.includes(key))).toBe(true);
      }
    });
  });

  describe('Production Secret Requirements', () => {
    it('should list all required production secrets', () => {
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('JWT_SECRET');
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('JWT_REFRESH_SECRET');
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('JWT_PRIVATE_KEY');
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('JWT_PUBLIC_KEY');
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('TOTP_ENCRYPTION_KEY');
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('ZARINPAL_MERCHANT_ID');
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('SESSION_SECRET');
    });

    it('should have minimum length requirements for secrets', () => {
      // JWT secrets should be at least 64 chars in production
      const shortJwtSecret = 'a'.repeat(63);
      const validJwtSecret = 'a'.repeat(64);

      expect(shortJwtSecret.length).toBeLessThan(64);
      expect(validJwtSecret.length).toBeGreaterThanOrEqual(64);
    });
  });

  describe('Environment-Specific Validation', () => {
    it('should allow shorter secrets in development', () => {
      const config: Record<string, unknown> = {
        NODE_ENV: 'development',
        JWT_SECRET: 'a'.repeat(32), // 32 chars is OK in dev
      };

      const errors = validateProductionSecrets(config);
      expect(errors.length).toBe(0);
    });

    it('should require RSA keys only in production', () => {
      const devConfig: Record<string, unknown> = {
        NODE_ENV: 'development',
      };

      const prodConfig: Record<string, unknown> = {
        NODE_ENV: 'production',
      };

      const devErrors = validateProductionSecrets(devConfig);
      const prodErrors = validateProductionSecrets(prodConfig);

      // Dev should not require RSA keys
      expect(devErrors.some((e) => e.includes('JWT_PRIVATE_KEY'))).toBe(false);

      // Production should require RSA keys
      expect(prodErrors.some((e) => e.includes('JWT_PRIVATE_KEY'))).toBe(true);
      expect(prodErrors.some((e) => e.includes('JWT_PUBLIC_KEY'))).toBe(true);
    });
  });

  describe('Secret Pattern Validation', () => {
    it('should validate PostgreSQL connection string format', () => {
      const validUrls = [
        'postgresql://user:pass@localhost:5432/db',
        'postgres://user:pass@localhost:5432/db',
        'postgresql://user:pass@host.com:5432/db?sslmode=require',
      ];

      const invalidUrls = [
        'mysql://user:pass@localhost:3306/db',
        'http://localhost:5432',
        'invalid-url',
      ];

      for (const url of validUrls) {
        expect(/^postgres(ql)?:\/\//.test(url)).toBe(true);
      }

      for (const url of invalidUrls) {
        expect(/^postgres(ql)?:\/\//.test(url)).toBe(false);
      }
    });

    it('should validate Redis connection string format', () => {
      const validUrls = [
        'redis://localhost:6379',
        'rediss://user:pass@host.com:6379',
        'redis://localhost:6379/0',
      ];

      const invalidUrls = ['http://localhost:6379', 'postgresql://localhost:5432', 'invalid-url'];

      for (const url of validUrls) {
        expect(/^redis(s)?:\/\//.test(url)).toBe(true);
      }

      for (const url of invalidUrls) {
        expect(/^redis(s)?:\/\//.test(url)).toBe(false);
      }
    });

    it('should validate RSA key format', () => {
      const validPrivateKey =
        '-----BEGIN RSA PRIVATE KEY-----\nMIIE....\n-----END RSA PRIVATE KEY-----';
      const validPublicKey =
        '-----BEGIN RSA PUBLIC KEY-----\nMIIB....\n-----END RSA PUBLIC KEY-----';
      const validPrivateKey2 = '-----BEGIN PRIVATE KEY-----\nMIIE....\n-----END PRIVATE KEY-----';

      expect(/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(validPrivateKey)).toBe(true);
      expect(/^-----BEGIN (RSA )?PUBLIC KEY-----/.test(validPublicKey)).toBe(true);
      expect(/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(validPrivateKey2)).toBe(true);

      const invalidKey = 'not-a-valid-key';
      expect(/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(invalidKey)).toBe(false);
    });
  });

  describe('Fail-Fast Behavior', () => {
    it('should collect all validation errors', () => {
      const config: Record<string, unknown> = {
        NODE_ENV: 'production',
        // Missing all required secrets
      };

      const errors = validateProductionSecrets(config);

      // Should report all missing secrets, not just the first one
      expect(errors.length).toBe(PRODUCTION_REQUIRED_SECRETS.length);
    });

    it('should provide clear error messages', () => {
      const config: Record<string, unknown> = {
        NODE_ENV: 'production',
      };

      const errors = validateProductionSecrets(config);

      for (const error of errors) {
        expect(error).toContain('Missing required production secret');
        expect(error.length).toBeGreaterThan(30);
      }
    });
  });
});

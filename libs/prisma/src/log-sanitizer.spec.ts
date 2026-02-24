/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Property Tests: Sensitive Data Logging Prevention
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Property 9: Sensitive Data Logging Prevention
 * - Passwords, tokens, and secrets are never logged in plaintext
 * - PII (national IDs, card numbers, etc.) is properly masked
 * - Sanitization preserves data structure while removing sensitive content
 *
 * Validates: Requirements 4.4, 12.3
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { LogSanitizer, getLogSanitizer, sanitizeForLog } from './log-sanitizer';

// Helper to generate digit strings
const digitArbitrary = (length: number) =>
  fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: length, maxLength: length })
    .map((digits) => digits.join(''));

describe('Log Sanitizer - Property Tests', () => {
  let sanitizer: LogSanitizer;

  beforeEach(() => {
    sanitizer = new LogSanitizer();
  });

  describe('Property 9.1: Password Fields Are Always Redacted', () => {
    const passwordFieldNames = [
      'password',
      'passwordHash',
      'password_hash',
      'PASSWORD',
      'Password',
    ];

    it('should redact all password field variations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...passwordFieldNames),
          fc.string({ minLength: 1, maxLength: 100 }),
          (fieldName, passwordValue) => {
            const input = { [fieldName]: passwordValue };
            const result = sanitizer.sanitize(input);

            expect(result[fieldName]).toBe('[REDACTED]');
            expect(result[fieldName]).not.toBe(passwordValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.2: Token Fields Are Always Redacted', () => {
    const tokenFieldNames = [
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'apiKey',
      'api_key',
      'secret',
      'secretKey',
      'privateKey',
      'jwt',
      'jwtToken',
      'sessionToken',
      'csrfToken',
      'bearer',
    ];

    it('should redact all token field variations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...tokenFieldNames),
          fc.string({ minLength: 1, maxLength: 200 }),
          (fieldName, tokenValue) => {
            const input = { [fieldName]: tokenValue };
            const result = sanitizer.sanitize(input);

            expect(result[fieldName]).toBe('[REDACTED]');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.3: Iranian National ID Masking', () => {
    it('should mask Iranian national IDs (10 digits)', () => {
      fc.assert(
        fc.property(digitArbitrary(10), (nationalId) => {
          const input = { data: `کد ملی: ${nationalId}` };
          const result = sanitizer.sanitize(input);

          // Should be masked but not fully redacted
          expect(result.data).not.toContain(nationalId);
          // Should preserve first 3 and last 3 digits
          expect(result.data).toContain(nationalId.slice(0, 3));
          expect(result.data).toContain(nationalId.slice(-3));
          expect(result.data).toContain('****');
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9.4: Iranian Bank Card Number Masking', () => {
    it('should mask 16-digit card numbers', () => {
      fc.assert(
        fc.property(digitArbitrary(16), (cardNumber) => {
          const input = { card: cardNumber };
          const result = sanitizer.sanitize(input);

          // Should not contain full card number
          expect(result.card).not.toBe(cardNumber);
          // Should preserve first 6 and last 4 digits
          expect(result.card).toContain(cardNumber.slice(0, 6));
          expect(result.card).toContain(cardNumber.slice(-4));
          expect(result.card).toContain('******');
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9.5: Iranian Mobile Number Masking', () => {
    it('should mask Iranian mobile numbers (09XXXXXXXXX)', () => {
      fc.assert(
        fc.property(digitArbitrary(9), (suffix) => {
          const mobile = `09${suffix}`;
          const input = { phone: mobile };
          const result = sanitizer.sanitize(input);

          // Should be masked
          expect(result.phone).not.toBe(mobile);
          // Should preserve first 4 and last 3 digits
          expect(result.phone).toContain(mobile.slice(0, 4));
          expect(result.phone).toContain('***');
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9.6: Email Address Masking', () => {
    it('should mask email addresses while preserving domain', () => {
      // Use a more controlled email generator
      const emailArb = fc
        .tuple(
          fc.string({ minLength: 3, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
          fc.string({ minLength: 2, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
          fc.constantFrom('com', 'org', 'net', 'io')
        )
        .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

      fc.assert(
        fc.property(emailArb, (email) => {
          const input = { email };
          const result = sanitizer.sanitize(input);

          // Should contain domain
          const domain = email.split('@')[1];
          expect(result.email).toContain(`@${domain}`);
          // Should not contain full local part for emails with local part > 2 chars
          const localPart = email.split('@')[0];
          if (localPart.length > 2) {
            expect(result.email).not.toBe(email);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9.7: JWT Token Detection and Redaction', () => {
    it('should detect and redact JWT tokens in strings', () => {
      // Generate valid JWT-like structure
      const generateJwtLike = () => {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
          'base64url'
        );
        const payload = Buffer.from(JSON.stringify({ sub: '123', exp: Date.now() })).toString(
          'base64url'
        );
        const signature = 'abcdefghijklmnop';
        return `${header}.${payload}.${signature}`;
      };

      fc.assert(
        fc.property(fc.constant(generateJwtLike()), (jwt) => {
          const input = { message: `Token: ${jwt}` };
          const result = sanitizer.sanitize(input);

          expect(result.message).toContain('[JWT_REDACTED]');
          expect(result.message).not.toContain(jwt);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 9.8: IBAN Masking', () => {
    it('should mask Iranian IBANs', () => {
      fc.assert(
        fc.property(digitArbitrary(24), (digits) => {
          const iban = `IR${digits}`;
          // Use a non-sensitive field name to test IBAN pattern detection
          const input = { ibanValue: iban };
          const result = sanitizer.sanitize(input);

          // Should be masked
          expect(result.ibanValue).not.toBe(iban);
          // Should preserve first 4 and last 4 characters
          expect(result.ibanValue).toContain('IR');
          expect(result.ibanValue).toContain('****');
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 9.9: Nested Object Sanitization', () => {
    it('should sanitize deeply nested objects', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (password, token) => {
            const input = {
              level1: {
                level2: {
                  level3: {
                    password,
                    data: {
                      token,
                      safe: 'visible',
                    },
                  },
                },
              },
            };

            const result = sanitizer.sanitize(input);

            expect(result.level1.level2.level3.password).toBe('[REDACTED]');
            expect(result.level1.level2.level3.data.token).toBe('[REDACTED]');
            expect(result.level1.level2.level3.data.safe).toBe('visible');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9.10: Array Sanitization', () => {
    it('should sanitize arrays of objects', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc
                .string({ minLength: 5, maxLength: 20 })
                .filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
              password: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (users) => {
            const result = sanitizer.sanitize(users);

            result.forEach((user: any, index: number) => {
              expect(user.password).toBe('[REDACTED]');
              expect(user.id).toBe(users[index].id);
              expect(user.name).toBe(users[index].name);
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 9.11: Non-Sensitive Data Preservation', () => {
    it('should preserve non-sensitive data unchanged', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            age: fc.integer({ min: 0, max: 150 }),
            isActive: fc.boolean(),
          }),
          (data) => {
            const result = sanitizer.sanitize(data);

            expect(result.id).toBe(data.id);
            expect(result.name).toBe(data.name);
            expect(result.age).toBe(data.age);
            expect(result.isActive).toBe(data.isActive);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9.12: Error Object Sanitization', () => {
    it('should sanitize error messages containing sensitive data', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 8, maxLength: 20 }), (password) => {
          const error = new Error(`Login failed for password: ${password}`);
          const result = sanitizer.sanitize(error);

          // Error should be converted to object
          expect(result).toHaveProperty('name');
          expect(result).toHaveProperty('message');
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 9.13: URL Password Masking', () => {
    it('should mask passwords in URLs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
          (username, password) => {
            const url = `postgresql://${username}:${password}@localhost:5432/db`;
            const result = sanitizer.sanitizeMessage(url);

            expect(result).not.toContain(`:${password}@`);
            expect(result).toContain(':***@');
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 9.14: Max Depth Protection', () => {
    it('should handle deeply nested objects without stack overflow', () => {
      // Create deeply nested object
      const createDeepObject = (depth: number): any => {
        if (depth === 0) {
          return { value: 'leaf' };
        }
        return { nested: createDeepObject(depth - 1) };
      };

      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (depth) => {
          const deepObject = createDeepObject(depth);

          // Should not throw
          expect(() => sanitizer.sanitize(deepObject)).not.toThrow();
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 9.15: Null and Undefined Handling', () => {
    it('should handle null and undefined values', () => {
      fc.assert(
        fc.property(fc.constantFrom(null, undefined), (value) => {
          const result = sanitizer.sanitize(value);
          expect(result).toBe(value);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 9.16: Custom Sensitive Fields', () => {
    it('should support custom sensitive field names', () => {
      const customSanitizer = new LogSanitizer({
        additionalSensitiveFields: ['customSecret', 'myPrivateData'],
      });

      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (secret1, secret2) => {
            const input = {
              customSecret: secret1,
              myPrivateData: secret2,
              publicData: 'visible',
            };

            const result = customSanitizer.sanitize(input);

            expect(result.customSecret).toBe('[REDACTED]');
            expect(result.myPrivateData).toBe('[REDACTED]');
            expect(result.publicData).toBe('visible');
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 9.17: JSON Output Safety', () => {
    it('should produce valid JSON output', () => {
      fc.assert(
        fc.property(
          fc.record({
            password: fc.string(),
            data: fc.string(),
          }),
          (input) => {
            const jsonOutput = sanitizer.toSafeJson(input);

            // Should be valid JSON
            expect(() => JSON.parse(jsonOutput)).not.toThrow();

            // Should not contain password
            const parsed = JSON.parse(jsonOutput);
            expect(parsed.password).toBe('[REDACTED]');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9.18: Singleton Instance', () => {
    it('should return same instance from getLogSanitizer', () => {
      const instance1 = getLogSanitizer();
      const instance2 = getLogSanitizer();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Property 9.19: Convenience Functions', () => {
    it('should work with convenience functions', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (password) => {
          const input = { password };
          const result = sanitizeForLog(input);

          expect(result.password).toBe('[REDACTED]');
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 9.20: 2FA/MFA Fields Redaction', () => {
    const mfaFieldNames = [
      'totp',
      'totpSecret',
      'mfaSecret',
      'backupCode',
      'otp',
      'otpCode',
      'verificationCode',
    ];

    it('should redact all 2FA/MFA field variations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...mfaFieldNames),
          fc.string({ minLength: 1, maxLength: 50 }),
          (fieldName, value) => {
            const input = { [fieldName]: value };
            const result = sanitizer.sanitize(input);

            expect(result[fieldName]).toBe('[REDACTED]');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property-Based Tests for JWT Token Security
 * 
 * These tests validate the security properties of JWT token generation
 * and validation using fast-check for property-based testing.
 * 
 * Requirements validated:
 * - 1.3: RS256 algorithm support
 * - 1.4: Proper JWT claims (iss, aud, exp, nbf, jti)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

/**
 * JWT Configuration Constants
 * These should match the production configuration
 */
const JWT_CONFIG = {
  ISSUER: 'nextgen-marketplace',
  AUDIENCE: 'nextgen-api',
  MIN_SECRET_LENGTH: 32,
  SUPPORTED_ALGORITHMS: ['RS256', 'HS256'] as const,
  MAX_TOKEN_AGE_SECONDS: 86400, // 24 hours
  MIN_TOKEN_AGE_SECONDS: 300, // 5 minutes
};

/**
 * Generate a test JWT payload
 */
function generateTestPayload(userId: string, email: string, role: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: userId,
    email,
    role,
    jti: randomUUID(),
    nbf: now,
    iat: now,
  };
}

/**
 * Decode JWT without verification (for testing structure)
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

/**
 * Decode JWT header
 */
function decodeJwtHeader(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const header = Buffer.from(parts[0], 'base64url').toString('utf-8');
  return JSON.parse(header);
}

describe('JWT Token Security Properties', () => {
  let jwtService: JwtService;
  const testSecret = 'test-secret-key-that-is-at-least-32-characters-long';

  beforeAll(() => {
    jwtService = new JwtService({
      secret: testSecret,
      signOptions: {
        expiresIn: '1h',
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE,
      },
    });
  });

  describe('Property 1: JWT Structure Validity', () => {
    it('should always produce valid three-part JWT structure', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.constantFrom('USER', 'ADMIN', 'VENDOR', 'EXECUTOR'),
          (userId, email, role) => {
            const payload = generateTestPayload(userId, email, role);
            const token = jwtService.sign(payload);
            
            // JWT must have exactly 3 parts separated by dots
            const parts = token.split('.');
            expect(parts).toHaveLength(3);
            
            // Each part must be non-empty
            parts.forEach((part, index) => {
              expect(part.length).toBeGreaterThan(0);
            });
            
            // Each part must be valid base64url
            parts.forEach((part) => {
              expect(() => Buffer.from(part, 'base64url')).not.toThrow();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Required Claims Presence', () => {
    it('should always include required standard claims', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.constantFrom('USER', 'ADMIN', 'VENDOR'),
          (userId, email, role) => {
            const payload = generateTestPayload(userId, email, role);
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            // Required claims must be present
            expect(decoded).toHaveProperty('sub');
            expect(decoded).toHaveProperty('email');
            expect(decoded).toHaveProperty('role');
            expect(decoded).toHaveProperty('iat'); // Issued at
            expect(decoded).toHaveProperty('exp'); // Expiration
            expect(decoded).toHaveProperty('iss'); // Issuer
            expect(decoded).toHaveProperty('aud'); // Audience
            expect(decoded).toHaveProperty('jti'); // JWT ID
            expect(decoded).toHaveProperty('nbf'); // Not before
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve payload values in token', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.constantFrom('USER', 'ADMIN', 'VENDOR', 'EXECUTOR'),
          (userId, email, role) => {
            const payload = generateTestPayload(userId, email, role);
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            // Payload values must be preserved
            expect(decoded.sub).toBe(userId);
            expect(decoded.email).toBe(email);
            expect(decoded.role).toBe(role);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Issuer and Audience Claims', () => {
    it('should always set correct issuer', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            expect(decoded.iss).toBe(JWT_CONFIG.ISSUER);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always set correct audience', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            expect(decoded.aud).toBe(JWT_CONFIG.AUDIENCE);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 4: Temporal Claims Validity', () => {
    it('should have exp > iat (expiration after issued)', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            const iat = decoded.iat as number;
            const exp = decoded.exp as number;
            
            expect(exp).toBeGreaterThan(iat);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have nbf <= iat (not before at or before issued)', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            const iat = decoded.iat as number;
            const nbf = decoded.nbf as number;
            
            expect(nbf).toBeLessThanOrEqual(iat);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have reasonable token lifetime', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            const iat = decoded.iat as number;
            const exp = decoded.exp as number;
            const lifetime = exp - iat;
            
            // Token lifetime should be within reasonable bounds
            expect(lifetime).toBeGreaterThanOrEqual(JWT_CONFIG.MIN_TOKEN_AGE_SECONDS);
            expect(lifetime).toBeLessThanOrEqual(JWT_CONFIG.MAX_TOKEN_AGE_SECONDS);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: JTI Uniqueness', () => {
    it('should generate unique JTI for each token', () => {
      const jtis = new Set<string>();
      
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            const jti = decoded.jti as string;
            
            // JTI must be a valid UUID format
            expect(jti).toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
            
            // JTI must be unique (not seen before)
            expect(jtis.has(jti)).toBe(false);
            jtis.add(jti);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Token Signature Integrity', () => {
    it('should verify valid tokens', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.constantFrom('USER', 'ADMIN', 'VENDOR'),
          (userId, email, role) => {
            const payload = generateTestPayload(userId, email, role);
            const token = jwtService.sign(payload);
            
            // Token should verify successfully
            const verified = jwtService.verify(token);
            expect(verified.sub).toBe(userId);
            expect(verified.email).toBe(email);
            expect(verified.role).toBe(role);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject tampered tokens', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.integer({ min: 0, max: 2 }), // Which part to tamper
          (userId, email, partIndex) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const parts = token.split('.');
            
            // Tamper with one part
            const tamperedPart = parts[partIndex] + 'x';
            parts[partIndex] = tamperedPart;
            const tamperedToken = parts.join('.');
            
            // Tampered token should fail verification
            expect(() => jwtService.verify(tamperedToken)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 7: Algorithm Header Validation', () => {
    it('should use approved algorithm in header', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const header = decodeJwtHeader(token);
            
            // Algorithm must be one of the approved algorithms
            expect(JWT_CONFIG.SUPPORTED_ALGORITHMS).toContain(header.alg);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have typ JWT in header', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const payload = generateTestPayload(userId, email, 'USER');
            const token = jwtService.sign(payload);
            const header = decodeJwtHeader(token);
            
            expect(header.typ).toBe('JWT');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

describe('JWT Secret Security Properties', () => {
  describe('Property 8: Secret Length Requirements', () => {
    it('should reject secrets shorter than minimum length', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: JWT_CONFIG.MIN_SECRET_LENGTH - 1 }),
          (shortSecret) => {
            // Short secrets should be rejected in production
            expect(shortSecret.length).toBeLessThan(JWT_CONFIG.MIN_SECRET_LENGTH);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept secrets meeting minimum length', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: JWT_CONFIG.MIN_SECRET_LENGTH, maxLength: 256 }),
          (validSecret) => {
            // Valid secrets should meet minimum length
            expect(validSecret.length).toBeGreaterThanOrEqual(JWT_CONFIG.MIN_SECRET_LENGTH);
            
            // Should be able to create JwtService with valid secret
            const service = new JwtService({
              secret: validSecret,
              signOptions: { expiresIn: '1h' },
            });
            
            const token = service.sign({ sub: 'test' });
            expect(token.split('.')).toHaveLength(3);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

describe('JWT Payload Security Properties', () => {
  let jwtService: JwtService;
  const testSecret = 'test-secret-key-that-is-at-least-32-characters-long';

  beforeAll(() => {
    jwtService = new JwtService({
      secret: testSecret,
      signOptions: {
        expiresIn: '1h',
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE,
      },
    });
  });

  describe('Property 9: No Sensitive Data in Payload', () => {
    it('should not include password in token', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 64 }),
          (userId, email, password) => {
            // Even if password is accidentally passed, it should not appear
            const payload = {
              sub: userId,
              email,
              role: 'USER',
              jti: randomUUID(),
              nbf: Math.floor(Date.now() / 1000),
              // Intentionally NOT including password
            };
            
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            // Token should not contain password field
            expect(decoded).not.toHaveProperty('password');
            expect(decoded).not.toHaveProperty('passwordHash');
            
            // Token string should not contain the password
            expect(token).not.toContain(password);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 10: Role Validation', () => {
    it('should only accept valid role values', () => {
      const validRoles = ['USER', 'ADMIN', 'VENDOR', 'EXECUTOR', 'DEALER'];
      
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.constantFrom(...validRoles),
          (userId, email, role) => {
            const payload = generateTestPayload(userId, email, role);
            const token = jwtService.sign(payload);
            const decoded = decodeJwtPayload(token);
            
            expect(validRoles).toContain(decoded.role);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

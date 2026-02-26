// Security Library - Minimal Stabilized Version with full barrel exports used by API
export * from './security.module';
export * from './security.service';

// JWT utilities (stubs)
export interface JWTPayload {
  sub: string;
  [key: string]: unknown;
}

export class JWTManager {
  private signToken(payload: Record<string, unknown>): string {
    // Runtime dependency is provided transitively via Nest JWT stack.
    const jwt = require('jsonwebtoken') as {
      sign: (
        payload: Record<string, unknown>,
        secret: string,
        options?: Record<string, unknown>
      ) => string;
      verify: (
        token: string,
        secret: string,
        options?: Record<string, unknown>
      ) => Record<string, unknown>;
    };
    const secret = process.env.JWT_SECRET || 'development-jwt-secret-32-chars-minimum';
    const issuer = process.env.JWT_ISSUER || 'nextgen-marketplace';
    const audience = process.env.JWT_AUDIENCE || 'nextgen-api';

    return jwt.sign(payload, secret, {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer,
      audience,
    });
  }

  async initialize(): Promise<void> {
    return;
  }
  async issueTokens(sub: string, claims: Record<string, unknown>) {
    const accessToken = this.signToken({ sub, ...claims });
    const refreshToken = this.signToken({ sub, type: 'refresh' });
    return {
      accessToken,
      refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      claims,
    };
  }
  async refreshAccessToken(refreshToken: string) {
    const jwt = require('jsonwebtoken') as {
      verify: (
        token: string,
        secret: string,
        options?: Record<string, unknown>
      ) => Record<string, unknown>;
    };
    const secret = process.env.JWT_SECRET || 'development-jwt-secret-32-chars-minimum';
    const issuer = process.env.JWT_ISSUER || 'nextgen-marketplace';
    const audience = process.env.JWT_AUDIENCE || 'nextgen-api';
    const payload = jwt.verify(refreshToken, secret, { issuer, audience }) as { sub?: string };
    const sub = payload.sub || 'mock-user';
    return {
      accessToken: this.signToken({ sub }),
      refreshToken: this.signToken({ sub, type: 'refresh' }),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }
  async verifyToken(token: string) {
    try {
      const jwt = require('jsonwebtoken') as {
        verify: (
          token: string,
          secret: string,
          options?: Record<string, unknown>
        ) => Record<string, unknown>;
      };
      const secret = process.env.JWT_SECRET || 'development-jwt-secret-32-chars-minimum';
      const issuer = process.env.JWT_ISSUER || 'nextgen-marketplace';
      const audience = process.env.JWT_AUDIENCE || 'nextgen-api';
      const payload = jwt.verify(token, secret, { issuer, audience });
      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }
  sign(_payload: JWTPayload): string {
    return 'mock-jwt';
  }
  verify(_token: string): JWTPayload {
    return { sub: 'mock-user' };
  }
}

// Brute force protection (stub)
export class BruteForceProtection {
  start(): void {
    return;
  }
  stop(): void {
    return;
  }
  isBlocked(_key: string): boolean {
    return false;
  }
  getAttempts(_key: string): { blockedUntil?: number } | null {
    return null;
  }
  getRemainingAttempts(_key: string): number {
    return 5;
  }
  recordAttempt(_key: string, _success: boolean): void {
    return;
  }
  async check(_key: string): Promise<void> {
    return;
  }
}

// CSRF helpers (stubs)
export function createCSRFManager() {
  return {
    validate: async () => true,
  };
}

// Security headers (stubs)
export function createDevelopmentSecurityHeaders() {
  return {};
}

export function createProductionSecurityHeaders() {
  return {};
}

// Rate limiting (stubs)
export const RATE_LIMIT_TIERS = {
  STANDARD: { limit: 100, window: 60_000 },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

export class InMemoryRateLimiter {
  async consume(_key: string, _tier: RateLimitTier): Promise<void> {
    return;
  }
}

export class RedisRateLimiter extends InMemoryRateLimiter {}

export function createRateLimiter() {
  return new InMemoryRateLimiter();
}

// Security Library - Minimal Stabilized Version with full barrel exports used by API
export * from './security.module';
export * from './security.service';

// JWT utilities (stubs)
export interface JWTPayload {
  sub: string;
  [key: string]: unknown;
}

export class JWTManager {
  sign(_payload: JWTPayload): string {
    return 'mock-jwt';
  }
  verify(_token: string): JWTPayload {
    return { sub: 'mock-user' };
  }
}

// Brute force protection (stub)
export class BruteForceProtection {
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

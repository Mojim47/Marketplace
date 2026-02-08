import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Logger } from '@nestjs/common';

const logger = new Logger('CORS');

/**
 * CORS configuration options
 */
export interface CorsConfig {
  /** Allowed origins (exact match or regex patterns) */
  allowedOrigins: string[];
  /** Allow credentials (cookies, authorization headers) */
  credentials: boolean;
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Exposed headers (accessible to client) */
  exposedHeaders: string[];
  /** Preflight cache duration in seconds */
  maxAge: number;
  /** Enable strict origin validation */
  strictOriginValidation: boolean;
}

/**
 * Default CORS configuration for production
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-ID',
    'X-Request-ID',
    'Accept',
    'Accept-Language',
    'Origin',
  ],
  exposedHeaders: [
    'X-Correlation-ID',
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
  ],
  maxAge: 86400, // 24 hours
  strictOriginValidation: true,
};

/**
 * Validate origin against allowed origins list
 * 
 * Security features:
 * - Exact match validation
 * - Regex pattern support for subdomains
 * - Null origin rejection
 * - Logging of rejected origins
 */
export function validateOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
  strictValidation: boolean = true,
): boolean {
  // Reject null/undefined origins in strict mode
  if (!origin) {
    if (strictValidation) {
      logger.warn('CORS: Rejected request with null/undefined origin');
      return false;
    }
    return true; // Allow for same-origin requests
  }

  // Check for exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check for pattern match (for subdomain support)
  for (const allowed of allowedOrigins) {
    // Handle wildcard subdomains (e.g., *.example.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      const originUrl = parseOrigin(origin);
      if (originUrl && originUrl.hostname.endsWith(domain)) {
        // Ensure it's actually a subdomain, not just ending with the domain
        const subdomain = originUrl.hostname.slice(0, -domain.length);
        if (subdomain.length > 0 && subdomain.endsWith('.')) {
          return true;
        }
      }
    }

    // Handle regex patterns (wrapped in /.../)
    if (allowed.startsWith('/') && allowed.endsWith('/')) {
      try {
        const regex = new RegExp(allowed.slice(1, -1));
        if (regex.test(origin)) {
          return true;
        }
      } catch (e) {
        logger.error(`CORS: Invalid regex pattern: ${allowed}`);
      }
    }
  }

  // Log rejected origin for security monitoring
  logger.warn(`CORS: Rejected origin: ${origin}`);
  return false;
}

/**
 * Parse origin URL safely
 */
function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

/**
 * Create CORS origin validator function
 */
export function createOriginValidator(
  allowedOrigins: string[],
  strictValidation: boolean = true,
): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  return (origin, callback) => {
    const isAllowed = validateOrigin(origin, allowedOrigins, strictValidation);
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('œ” —”Ì «“ «Ì‰ „‰»⁄ „Ã«“ ‰Ì” '), false);
    }
  };
}

/**
 * Create NestJS CORS options from config
 */
export function createCorsOptions(config: Partial<CorsConfig> = {}): CorsOptions {
  const mergedConfig = { ...DEFAULT_CORS_CONFIG, ...config };

  return {
    origin: createOriginValidator(
      mergedConfig.allowedOrigins,
      mergedConfig.strictOriginValidation,
    ),
    credentials: mergedConfig.credentials,
    methods: mergedConfig.methods,
    allowedHeaders: mergedConfig.allowedHeaders,
    exposedHeaders: mergedConfig.exposedHeaders,
    maxAge: mergedConfig.maxAge,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}

/**
 * Parse CORS origins from environment variable
 * Supports comma-separated list
 */
export function parseCorsOrigins(envValue: string | undefined): string[] {
  if (!envValue) {
    return [];
  }

  return envValue
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Validate CORS configuration
 * Returns array of validation errors
 */
export function validateCorsConfig(config: CorsConfig): string[] {
  const errors: string[] = [];

  // Check for wildcard origin with credentials
  if (config.allowedOrigins.includes('*') && config.credentials) {
    errors.push('Cannot use wildcard origin (*) with credentials enabled');
  }

  // Check for empty origins in production
  if (config.allowedOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    errors.push('No allowed origins configured for production');
  }

  // Validate origin formats
  for (const origin of config.allowedOrigins) {
    if (origin === '*') continue;
    if (origin.startsWith('*.')) continue;
    if (origin.startsWith('/') && origin.endsWith('/')) continue;

    try {
      new URL(origin);
    } catch {
      errors.push(`Invalid origin format: ${origin}`);
    }
  }

  // Validate methods
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
  for (const method of config.methods) {
    if (!validMethods.includes(method.toUpperCase())) {
      errors.push(`Invalid HTTP method: ${method}`);
    }
  }

  return errors;
}

/**
 * Export for testing
 */
export const __testing = {
  validateOrigin,
  parseOrigin,
  parseCorsOrigins,
  validateCorsConfig,
  DEFAULT_CORS_CONFIG,
};

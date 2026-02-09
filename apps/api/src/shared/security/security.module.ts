/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Shared Security Module
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Central security module that integrates all security services from libs/security.
 * Provides guards, interceptors, and services for API protection.
 *
 * Features:
 * - JWT authentication with RS256
 * - Role-based access control (RBAC)
 * - Rate limiting with Redis-based sliding window algorithm
 * - CSRF protection
 * - Brute force protection
 * - Security headers
 * - WAF integration
 *
 * @module @nextgen/api/shared/security
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { type DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Import security services from libs/security
import {
  BruteForceProtection,
  JWTManager,
  createCSRFManager,
  createDevelopmentSecurityHeaders,
  createProductionSecurityHeaders,
  createRateLimiter,
} from '@nextgen/security';

// Import WAF service from libs/waf
import { WAFService } from '@nextgen/waf';

import { BruteForceGuard, BruteForceService } from './guards/brute-force.guard';
import { CSRFGuard } from './guards/csrf.guard';
import { JWTAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RBACGuard } from './guards/rbac.guard';
// Import guards
import { WAFGuard } from './guards/waf.guard';

// Import tokens
import { SECURITY_TOKENS } from './tokens';

// Export guards
export { WAFGuard } from './guards/waf.guard';
export { JWTAuthGuard, Public, IS_PUBLIC_KEY, AuthenticatedRequest } from './guards/jwt-auth.guard';
export {
  RBACGuard,
  Roles,
  Permissions,
  ROLES_KEY,
  PERMISSIONS_KEY,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
} from './guards/rbac.guard';
export {
  RateLimitGuard,
  RateLimitTier,
  SkipRateLimit,
  RATE_LIMIT_TIER_KEY,
  SKIP_RATE_LIMIT_KEY,
} from './guards/rate-limit.guard';
export { CSRFGuard, SkipCSRF, SKIP_CSRF_KEY } from './guards/csrf.guard';
export {
  BruteForceGuard,
  BruteForceService,
  BruteForceProtected,
  SkipBruteForce,
  BRUTE_FORCE_KEY,
  SKIP_BRUTE_FORCE_KEY,
} from './guards/brute-force.guard';

// Security module configuration interface
export interface SecurityModuleConfig {
  jwtIssuer: string;
  jwtAudience?: string;
  jwtTokenTTL?: number;
  jwtRefreshTokenTTL?: number;
  csrfSecret: string;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  bruteForceMaxAttempts?: number;
  bruteForceWindowMs?: number;
  bruteForceBlockDurationMs?: number;
  isProduction?: boolean;
}

@Global()
@Module({})
export class SecurityModule {
  /**
   * Register the security module with configuration
   */
  static forRoot(config?: Partial<SecurityModuleConfig>): DynamicModule {
    return {
      module: SecurityModule,
      imports: [ConfigModule],
      providers: [
        // JWT Manager Provider
        {
          provide: SECURITY_TOKENS.JWT_MANAGER,
          useFactory: async (configService: ConfigService) => {
            const jwtManager = new JWTManager({
              issuer: config?.jwtIssuer || configService.get('JWT_ISSUER', 'nextgen-marketplace'),
              audience:
                config?.jwtAudience || configService.get('JWT_AUDIENCE', 'nextgen-marketplace'),
              tokenTTL: config?.jwtTokenTTL || configService.get('JWT_TOKEN_TTL', 3600),
              refreshTokenTTL:
                config?.jwtRefreshTokenTTL || configService.get('JWT_REFRESH_TOKEN_TTL', 604800),
              keyRotationIntervalHours: 24,
              oldKeysToKeep: 2,
            });
            await jwtManager.initialize();
            return jwtManager;
          },
          inject: [ConfigService],
        },

        // Rate Limiter Provider - Redis-based sliding window rate limiting
        {
          provide: SECURITY_TOKENS.RATE_LIMITER,
          useFactory: (configService: ConfigService) => {
            const logger = new Logger('RateLimiterFactory');
            const redisUrl = configService.get<string>('REDIS_URL');
            const redisHost = configService.get<string>('REDIS_HOST');

            // Create Redis client for rate limiting
            let redisClient: Redis | undefined;

            if (redisUrl) {
              try {
                redisClient = new Redis(redisUrl, {
                  maxRetriesPerRequest: 3,
                  retryStrategy: (times) => {
                    if (times > 3) {
                      return null;
                    }
                    return Math.min(times * 100, 3000);
                  },
                  lazyConnect: true,
                });
                logger.log('Rate limiter using Redis URL for sliding window algorithm');
              } catch (error) {
                logger.warn(
                  'Failed to create Redis client from URL, falling back to in-memory',
                  error
                );
              }
            } else if (redisHost) {
              try {
                redisClient = new Redis({
                  host: redisHost,
                  port: Number.parseInt(configService.get('REDIS_PORT', '6379'), 10),
                  password: configService.get('REDIS_PASSWORD') || undefined,
                  db: Number.parseInt(configService.get('REDIS_DB', '0'), 10),
                  maxRetriesPerRequest: 3,
                  retryStrategy: (times) => {
                    if (times > 3) {
                      return null;
                    }
                    return Math.min(times * 100, 3000);
                  },
                  lazyConnect: true,
                });
                logger.log('Rate limiter using Redis host for sliding window algorithm');
              } catch (error) {
                logger.warn(
                  'Failed to create Redis client from host, falling back to in-memory',
                  error
                );
              }
            } else {
              logger.warn(
                'No Redis configuration found, using in-memory rate limiter (not recommended for production)'
              );
            }

            // Create rate limiter with Redis if available
            return createRateLimiter({
              redis: redisClient as any, // Cast to match interface
              keyPrefix: 'ratelimit',
              defaultTier: {
                name: 'default',
                maxRequests:
                  config?.rateLimitMaxRequests || configService.get('RATE_LIMIT_MAX_REQUESTS', 100),
                windowSeconds: Math.floor(
                  (config?.rateLimitWindowMs || configService.get('RATE_LIMIT_WINDOW_MS', 60000)) /
                    1000
                ),
                burstAllowance: 20,
              },
              enableBruteForceProtection: true,
              bruteForceThreshold: 10,
              blockDurationSeconds: 900,
            });
          },
          inject: [ConfigService],
        },

        // CSRF Manager Provider
        {
          provide: SECURITY_TOKENS.CSRF_MANAGER,
          useFactory: (configService: ConfigService) => {
            const secret = config?.csrfSecret || configService.get('CSRF_SECRET');
            if (!secret || secret.length < 32) {
              // Generate a default secret for development (should be set in production)
              const defaultSecret = configService.get(
                'JWT_SECRET',
                'development-csrf-secret-minimum-32-chars'
              );
              return createCSRFManager({
                secret: defaultSecret.length >= 32 ? defaultSecret : defaultSecret.padEnd(32, '0'),
                cookieName: 'XSRF-TOKEN',
                headerName: 'X-XSRF-TOKEN',
                secure: configService.get('NODE_ENV') === 'production',
                sameSite: 'strict',
                maxAge: 86400,
                ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
                ignorePaths: ['/api/health', '/api/metrics', '/health', '/livez'],
              });
            }
            return createCSRFManager({
              secret,
              cookieName: 'XSRF-TOKEN',
              headerName: 'X-XSRF-TOKEN',
              secure: configService.get('NODE_ENV') === 'production',
              sameSite: 'strict',
              maxAge: 86400,
              ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
              ignorePaths: ['/api/health', '/api/metrics', '/health', '/livez'],
            });
          },
          inject: [ConfigService],
        },

        // Brute Force Protection Provider
        {
          provide: SECURITY_TOKENS.BRUTE_FORCE,
          useFactory: (configService: ConfigService) => {
            const protection = new BruteForceProtection({
              maxAttempts:
                config?.bruteForceMaxAttempts || configService.get('BRUTE_FORCE_MAX_ATTEMPTS', 5),
              windowMs:
                config?.bruteForceWindowMs ||
                configService.get('BRUTE_FORCE_WINDOW_MS', 15 * 60 * 1000),
              blockDurationMs:
                config?.bruteForceBlockDurationMs ||
                configService.get('BRUTE_FORCE_BLOCK_DURATION_MS', 15 * 60 * 1000),
              whitelistedIPs: ['127.0.0.1', '::1'],
              onBlock: (ip, attempts) => {
                console.warn(`[BruteForce] IP blocked: ${ip} after ${attempts} attempts`);
              },
              onUnblock: (ip) => {
                console.info(`[BruteForce] IP unblocked: ${ip}`);
              },
            });
            protection.start();
            return protection;
          },
          inject: [ConfigService],
        },

        // Security Headers Manager Provider
        {
          provide: SECURITY_TOKENS.SECURITY_HEADERS,
          useFactory: (configService: ConfigService) => {
            const isProduction =
              config?.isProduction ?? configService.get('NODE_ENV') === 'production';
            return isProduction
              ? createProductionSecurityHeaders()
              : createDevelopmentSecurityHeaders();
          },
          inject: [ConfigService],
        },

        // WAF Service Provider
        {
          provide: SECURITY_TOKENS.WAF_SERVICE,
          useFactory: () => {
            return new WAFService();
          },
        },

        // Guards
        WAFGuard,
        JWTAuthGuard,
        RBACGuard,
        RateLimitGuard,
        CSRFGuard,
        BruteForceGuard,
        BruteForceService,
      ],
      exports: [
        SECURITY_TOKENS.JWT_MANAGER,
        SECURITY_TOKENS.RATE_LIMITER,
        SECURITY_TOKENS.CSRF_MANAGER,
        SECURITY_TOKENS.BRUTE_FORCE,
        SECURITY_TOKENS.SECURITY_HEADERS,
        SECURITY_TOKENS.WAF_SERVICE,
        WAFGuard,
        JWTAuthGuard,
        RBACGuard,
        RateLimitGuard,
        CSRFGuard,
        BruteForceGuard,
        BruteForceService,
      ],
    };
  }

  /**
   * Register the security module asynchronously with configuration factory
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<SecurityModuleConfig> | SecurityModuleConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: SecurityModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'SECURITY_MODULE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        // JWT Manager Provider
        {
          provide: SECURITY_TOKENS.JWT_MANAGER,
          useFactory: async (config: SecurityModuleConfig) => {
            const jwtManager = new JWTManager({
              issuer: config.jwtIssuer,
              audience: config.jwtAudience,
              tokenTTL: config.jwtTokenTTL || 3600,
              refreshTokenTTL: config.jwtRefreshTokenTTL || 604800,
              keyRotationIntervalHours: 24,
              oldKeysToKeep: 2,
            });
            await jwtManager.initialize();
            return jwtManager;
          },
          inject: ['SECURITY_MODULE_CONFIG'],
        },
        // Rate Limiter Provider - Redis-based sliding window rate limiting
        {
          provide: SECURITY_TOKENS.RATE_LIMITER,
          useFactory: (config: SecurityModuleConfig, configService: ConfigService) => {
            const logger = new Logger('RateLimiterFactory');
            const redisUrl = configService.get<string>('REDIS_URL');
            const redisHost = configService.get<string>('REDIS_HOST');

            // Create Redis client for rate limiting
            let redisClient: Redis | undefined;

            if (redisUrl) {
              try {
                redisClient = new Redis(redisUrl, {
                  maxRetriesPerRequest: 3,
                  retryStrategy: (times) => {
                    if (times > 3) {
                      return null;
                    }
                    return Math.min(times * 100, 3000);
                  },
                  lazyConnect: true,
                });
                logger.log('Rate limiter using Redis URL for sliding window algorithm');
              } catch (error) {
                logger.warn(
                  'Failed to create Redis client from URL, falling back to in-memory',
                  error
                );
              }
            } else if (redisHost) {
              try {
                redisClient = new Redis({
                  host: redisHost,
                  port: Number.parseInt(configService.get('REDIS_PORT', '6379'), 10),
                  password: configService.get('REDIS_PASSWORD') || undefined,
                  db: Number.parseInt(configService.get('REDIS_DB', '0'), 10),
                  maxRetriesPerRequest: 3,
                  retryStrategy: (times) => {
                    if (times > 3) {
                      return null;
                    }
                    return Math.min(times * 100, 3000);
                  },
                  lazyConnect: true,
                });
                logger.log('Rate limiter using Redis host for sliding window algorithm');
              } catch (error) {
                logger.warn(
                  'Failed to create Redis client from host, falling back to in-memory',
                  error
                );
              }
            } else {
              logger.warn(
                'No Redis configuration found, using in-memory rate limiter (not recommended for production)'
              );
            }

            return createRateLimiter({
              redis: redisClient as any,
              keyPrefix: 'ratelimit',
              defaultTier: {
                name: 'default',
                maxRequests: config.rateLimitMaxRequests || 100,
                windowSeconds: Math.floor((config.rateLimitWindowMs || 60000) / 1000),
                burstAllowance: 20,
              },
              enableBruteForceProtection: true,
              bruteForceThreshold: 10,
              blockDurationSeconds: 900,
            });
          },
          inject: ['SECURITY_MODULE_CONFIG', ConfigService],
        },
        // CSRF Manager Provider
        {
          provide: SECURITY_TOKENS.CSRF_MANAGER,
          useFactory: (config: SecurityModuleConfig) => {
            return createCSRFManager({
              secret: config.csrfSecret,
              cookieName: 'XSRF-TOKEN',
              headerName: 'X-XSRF-TOKEN',
              secure: config.isProduction ?? true,
              sameSite: 'strict',
              maxAge: 86400,
              ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
              ignorePaths: ['/api/health', '/api/metrics', '/health', '/livez'],
            });
          },
          inject: ['SECURITY_MODULE_CONFIG'],
        },
        // Brute Force Protection Provider
        {
          provide: SECURITY_TOKENS.BRUTE_FORCE,
          useFactory: (config: SecurityModuleConfig) => {
            const protection = new BruteForceProtection({
              maxAttempts: config.bruteForceMaxAttempts || 5,
              windowMs: config.bruteForceWindowMs || 15 * 60 * 1000,
              blockDurationMs: config.bruteForceBlockDurationMs || 15 * 60 * 1000,
              whitelistedIPs: ['127.0.0.1', '::1'],
            });
            protection.start();
            return protection;
          },
          inject: ['SECURITY_MODULE_CONFIG'],
        },
        // Security Headers Manager Provider
        {
          provide: SECURITY_TOKENS.SECURITY_HEADERS,
          useFactory: (config: SecurityModuleConfig) => {
            return config.isProduction
              ? createProductionSecurityHeaders()
              : createDevelopmentSecurityHeaders();
          },
          inject: ['SECURITY_MODULE_CONFIG'],
        },
        // WAF Service Provider
        {
          provide: SECURITY_TOKENS.WAF_SERVICE,
          useFactory: () => new WAFService(),
        },

        // Guards
        WAFGuard,
        JWTAuthGuard,
        RBACGuard,
        RateLimitGuard,
        CSRFGuard,
        BruteForceGuard,
        BruteForceService,
      ],
      exports: [
        SECURITY_TOKENS.JWT_MANAGER,
        SECURITY_TOKENS.RATE_LIMITER,
        SECURITY_TOKENS.CSRF_MANAGER,
        SECURITY_TOKENS.BRUTE_FORCE,
        SECURITY_TOKENS.SECURITY_HEADERS,
        SECURITY_TOKENS.WAF_SERVICE,
        WAFGuard,
        JWTAuthGuard,
        RBACGuard,
        RateLimitGuard,
        CSRFGuard,
        BruteForceGuard,
        BruteForceService,
      ],
    };
  }
}

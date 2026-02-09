/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Rate Limit Guard
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Rate limiting guard using sliding window algorithm with Redis support.
 * Limits requests per IP/user to prevent abuse and DDoS attacks.
 *
 * Features:
 * - Sliding window rate limiting
 * - IP-based and user-based limiting
 * - Multiple rate limit tiers
 * - Burst allowance
 * - Rate limit headers in response
 * - Persian error messages
 *
 * @module @nextgen/api/shared/security
 * Requirements: 1.3
 */

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InMemoryRateLimiter,
  RATE_LIMIT_TIERS,
  RateLimitTier,
  RedisRateLimiter,
} from '@nextgen/security';
import { Request, Response } from 'express';
import { SECURITY_TOKENS } from '../tokens';

// Metadata key for custom rate limit tier
export const RATE_LIMIT_TIER_KEY = 'rateLimitTier';

/**
 * Decorator to specify custom rate limit tier for an endpoint
 *
 * @example
 * @RateLimitTier(RATE_LIMIT_TIERS.LOGIN)
 * @Post('login')
 * login() { ... }
 */
export const RateLimitTier = (tier: RateLimitTier) => SetMetadata(RATE_LIMIT_TIER_KEY, tier);

/**
 * Decorator to skip rate limiting for an endpoint
 *
 * @example
 * @SkipRateLimit()
 * @Get('health')
 * health() { ... }
 */
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * Request interface with user payload
 */
interface AuthenticatedRequest extends Request {
  user?: { sub: string; role?: string };
}

/**
 * Rate Limit Guard
 *
 * Enforces rate limiting on API endpoints using sliding window algorithm.
 * Default limit: 100 requests per minute per IP.
 *
 * @example
 * // Apply globally in AppModule
 * providers: [
 *   { provide: APP_GUARD, useClass: RateLimitGuard }
 * ]
 *
 * @example
 * // Apply custom tier to endpoint
 * @RateLimitTier(RATE_LIMIT_TIERS.LOGIN)
 * @Post('auth/login')
 * login() { ... }
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    @Inject(SECURITY_TOKENS.RATE_LIMITER)
    private readonly rateLimiter: InMemoryRateLimiter | RedisRateLimiter,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if rate limiting should be skipped
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get custom tier or use default
    const customTier = this.reflector.getAllAndOverride<RateLimitTier>(RATE_LIMIT_TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Determine rate limit tier based on user authentication
    const tier = customTier || this.getTierForRequest(request);

    // Get identifier (prefer user ID over IP for authenticated requests)
    const identifier = this.getIdentifier(request);

    // Check rate limit
    const result = await this.rateLimiter.checkLimit(identifier, tier);

    // Set rate limit headers
    this.setRateLimitHeaders(response, result.limit, result.remaining, result.resetIn);

    if (!result.allowed) {
      this.logRateLimitExceeded(request, identifier, tier.name);

      // Set Retry-After header
      response.setHeader('Retry-After', result.retryAfter || result.resetIn);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: result.blocked
            ? `��� �� ���� ${result.blockReason} ����� ������. ����� ${result.retryAfter} ����� ��� ���� ����.`
            : `����� ������ʝ��� ��� ��� �� �� ���� ���. ����� ${result.retryAfter} ����� ��� ���� ����.`,
          retryAfter: result.retryAfter || result.resetIn,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  /**
   * Get rate limit tier based on request context
   */
  private getTierForRequest(request: AuthenticatedRequest): RateLimitTier {
    // Check if user is authenticated
    if (request.user) {
      const role = request.user.role?.toUpperCase();

      // Premium users get higher limits
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        return RATE_LIMIT_TIERS.API;
      }

      if (role === 'SELLER' || role === 'EXECUTOR') {
        return RATE_LIMIT_TIERS.PREMIUM;
      }

      return RATE_LIMIT_TIERS.AUTHENTICATED;
    }

    // Anonymous users get strictest limits
    return RATE_LIMIT_TIERS.ANONYMOUS;
  }

  /**
   * Get identifier for rate limiting
   * Uses user ID for authenticated requests, IP for anonymous
   */
  private getIdentifier(request: AuthenticatedRequest): string {
    // Prefer user ID for authenticated requests
    if (request.user?.sub) {
      return `user:${request.user.sub}`;
    }

    // Fall back to IP address
    return `ip:${this.extractClientIP(request)}`;
  }

  /**
   * Extract client IP address from request
   */
  private extractClientIP(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIP = request.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Set rate limit headers in response
   */
  private setRateLimitHeaders(
    response: Response,
    limit: number,
    remaining: number,
    resetIn: number
  ): void {
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetIn);
  }

  /**
   * Log rate limit exceeded for monitoring
   */
  private logRateLimitExceeded(
    request: AuthenticatedRequest,
    identifier: string,
    tierName: string
  ): void {
    const logData = {
      event: 'RATE_LIMIT_EXCEEDED',
      identifier,
      tier: tierName,
      path: request.path,
      method: request.method,
      ip: this.extractClientIP(request),
      userId: request.user?.sub,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Rate limit exceeded: ${JSON.stringify(logData)}`);
  }
}

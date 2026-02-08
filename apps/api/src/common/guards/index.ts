import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { FeatureFlagService } from '../../feature-flag/feature-flag.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Tenant Isolation Guard
 * Ensures all requests are scoped to a specific tenant
 * Prevents cross-tenant data access
 */
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get tenant ID from JWT payload or header
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new ForbiddenException(
        'Missing tenant context. Provide tenant ID in JWT or X-Tenant-ID header',
      );
    }

    // Attach tenant ID to request for use in controllers/services
    request.tenantId = tenantId;
    request.tenant = { id: tenantId };

    return true;
  }
}

/**
 * Feature Flag Guard
 * Checks if a feature is enabled for the tenant before allowing access
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required feature from decorator
    const requiredFeature = this.reflector.get<string>(
      'requiredFeature',
      context.getHandler(),
    );

    if (!requiredFeature) {
      return true; // No feature requirement
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId || request.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const isEnabled = await this.featureFlagService.isFeatureEnabled(
      tenantId,
      requiredFeature,
    );

    if (!isEnabled) {
      throw new ForbiddenException(
        `Feature "${requiredFeature}" is not enabled for this tenant`,
      );
    }

    return true;
  }
}

/**
 * RBAC Guard
 * Checks if user has required role(s) for the endpoint
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role requirement
    }

    const request = context.switchToHttp().getRequest();
    const userRoles = request.user?.roles || [];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

/**
 * Permission Guard
 * Fine-grained permission checking
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userPermissions = request.user?.permissions || [];

    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}

/**
 * API Key Guard
 * Authenticates requests using API keys
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.query.api_key;

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const key = String(apiKey);

    const record = await this.prisma.apiKey.findUnique({
      where: { key },
      select: {
        id: true,
        tenantId: true,
        isActive: true,
        expiresAt: true,
      },
    });

    if (!record || !record.isActive) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('API key expired');
    }

    request.tenantId = record.tenantId;
    request.tenant = { id: record.tenantId };

    // Best-effort: update lastUsed
    void this.prisma.apiKey.update({
      where: { key },
      data: { lastUsed: new Date() },
    });

    return true;
  }
}

/**
 * Rate Limit Guard
 * Enforces rate limiting per tenant/user using Redis-based sliding window algorithm.
 * 
 * Features:
 * - Sliding window rate limiting for accurate request counting
 * - Per-tenant and per-endpoint limits
 * - Returns 429 with Retry-After header when limit exceeded
 * - Persian error messages for Iranian market
 * 
 * Requirements: 1.5
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private redis: Redis | null = null;

  // Default rate limits per endpoint type
  private readonly RATE_LIMITS: Record<string, { maxRequests: number; windowSeconds: number }> = {
    default: { maxRequests: 100, windowSeconds: 60 },
    login: { maxRequests: 5, windowSeconds: 900 },
    sensitive: { maxRequests: 10, windowSeconds: 3600 },
    api: { maxRequests: 1000, windowSeconds: 60 },
  };

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    const redisUrl = process.env['REDIS_URL'];
    const redisHost = process.env['REDIS_HOST'];

    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else if (redisHost) {
      this.redis = new Redis({
        host: redisHost,
        port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
        password: process.env['REDIS_PASSWORD'] || undefined,
        db: parseInt(process.env['REDIS_DB'] || '0', 10),
      });
    }

    if (this.redis) {
      this.redis.on('error', (err) => {
        this.logger.error('Redis connection error:', err);
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'];
    const userId = request.user?.sub || request.user?.id;

    // Build identifier for rate limiting
    const identifier = this.buildIdentifier(tenantId, userId, request);
    const endpoint = this.detectEndpointType(request);
    const limits = this.RATE_LIMITS[endpoint] || this.RATE_LIMITS.default;

    // Check rate limit using sliding window algorithm
    const result = await this.checkSlidingWindowLimit(
      identifier,
      limits.maxRequests,
      limits.windowSeconds,
    );

    // Set rate limit headers
    this.setRateLimitHeaders(response, limits.maxRequests, result.remaining, result.resetIn);

    if (!result.allowed) {
      // Set Retry-After header
      response.setHeader('Retry-After', result.retryAfter);

      this.logRateLimitExceeded(request, identifier, endpoint);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: ` ⁄œ«œ œ—ŒÊ«” ùÂ«Ì ‘„« »Ì‘ «“ Õœ „Ã«“ «” . ·ÿ›« ${result.retryAfter} À«‰ÌÂ œÌê—  ·«‘ ò‰Ìœ.`,
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Build identifier for rate limiting
   * Combines tenant, user, and IP for unique identification
   */
  private buildIdentifier(
    tenantId: string | undefined,
    userId: string | undefined,
    request: any,
  ): string {
    const parts: string[] = [];

    if (tenantId) {
      parts.push(`tenant:${tenantId}`);
    }

    if (userId) {
      parts.push(`user:${userId}`);
    }

    // Always include IP as fallback
    const ip = this.extractClientIP(request);
    parts.push(`ip:${ip}`);

    // Include endpoint path for per-endpoint limiting
    const path = request.path || request.url || '/';
    parts.push(`path:${this.normalizePath(path)}`);

    return parts.join(':');
  }

  /**
   * Extract client IP from request
   */
  private extractClientIP(request: any): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIP = request.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Normalize path for rate limiting key
   */
  private normalizePath(path: string): string {
    // Remove query params and normalize
    const cleanPath = path.split('?')[0];
    // Replace dynamic segments (UUIDs, IDs) with placeholders
    return cleanPath
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Detect endpoint type for rate limit tier selection
   */
  private detectEndpointType(request: any): string {
    const path = (request.path || request.url || '').toLowerCase();

    if (path.includes('/login') || path.includes('/auth') || path.includes('/signin')) {
      return 'login';
    }

    if (
      path.includes('/password') ||
      path.includes('/2fa') ||
      path.includes('/mfa') ||
      path.includes('/admin')
    ) {
      return 'sensitive';
    }

    if (path.startsWith('/api/')) {
      return 'api';
    }

    return 'default';
  }

  /**
   * Check rate limit using sliding window algorithm
   * Uses Redis for distributed rate limiting
   */
  private async checkSlidingWindowLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
    retryAfter: number;
  }> {
    // If Redis is not available, use in-memory fallback (fail open)
    if (!this.redis) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetIn: windowSeconds,
        retryAfter: 0,
      };
    }

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;
    const key = `ratelimit:${identifier}`;

    try {
      // Use Redis sorted set for sliding window
      // Score = timestamp, Member = unique request ID
      const requestId = `${now}:${Math.random().toString(36).substring(7)}`;

      // Execute atomic operations
      const pipeline = this.redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, now, requestId);

      // Set expiry on the key
      pipeline.expire(key, windowSeconds * 2);

      const results = await pipeline.exec();

      if (!results) {
        // Pipeline failed, fail open
        return {
          allowed: true,
          remaining: maxRequests,
          resetIn: windowSeconds,
          retryAfter: 0,
        };
      }

      // Get count from zcard result (index 1)
      const currentCount = (results[1]?.[1] as number) || 0;

      // Calculate remaining requests
      const remaining = Math.max(0, maxRequests - currentCount - 1);

      // Calculate reset time
      const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldestEntry.length >= 2 ? parseInt(oldestEntry[1], 10) : now;
      const resetIn = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

      if (currentCount >= maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.max(1, resetIn);

        return {
          allowed: false,
          remaining: 0,
          resetIn: Math.max(1, resetIn),
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining,
        resetIn: Math.max(1, resetIn),
        retryAfter: 0,
      };
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      // Fail open on Redis errors
      return {
        allowed: true,
        remaining: maxRequests,
        resetIn: windowSeconds,
        retryAfter: 0,
      };
    }
  }

  /**
   * Set rate limit headers in response
   */
  private setRateLimitHeaders(
    response: any,
    limit: number,
    remaining: number,
    resetIn: number,
  ): void {
    if (response.setHeader) {
      response.setHeader('X-RateLimit-Limit', limit);
      response.setHeader('X-RateLimit-Remaining', remaining);
      response.setHeader('X-RateLimit-Reset', resetIn);
    }
  }

  /**
   * Log rate limit exceeded for monitoring
   */
  private logRateLimitExceeded(request: any, identifier: string, endpoint: string): void {
    const logData = {
      event: 'RATE_LIMIT_EXCEEDED',
      identifier,
      endpoint,
      path: request.path || request.url,
      method: request.method,
      ip: this.extractClientIP(request),
      userId: request.user?.sub || request.user?.id,
      tenantId: request.user?.tenantId || request.headers['x-tenant-id'],
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Rate limit exceeded: ${JSON.stringify(logData)}`);
  }
}

/**
 * Vendor Access Guard
 * Ensures vendors can only access their own data
 */
@Injectable()
export class VendorAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { vendorId } = request.params;
    const userVendorId = request.user?.vendorId;

    // Admins can access all vendors
    if (request.user?.roles?.includes('admin')) {
      return true;
    }

    // Vendors can only access their own data
    if (userVendorId !== vendorId) {
      throw new ForbiddenException('Cannot access other vendors data');
    }

    return true;
  }
}

/**
 * Audit Logging Interceptor
 * Logs all create/update/delete operations
 */
import { NestInterceptor, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, path, user } = request;

    // Log before execution
    const startTime = Date.now();

    return next.handle().pipe(
      tap((_response) => {
        const duration = Date.now() - startTime;

        // Only log write operations (without sensitive body data)
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          this.logger.log(
            `${method} ${path} - ${duration}ms - User: ${user?.email || 'anonymous'}`,
            'AuditInterceptor'
          );
        }
      }),
    );
  }
}

/**
 * Request Context Middleware
 * Attaches correlation ID and tenant context to all requests
 */
import { NestMiddleware } from '@nestjs/common';

interface MiddlewareRequest {
  headers: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

interface MiddlewareResponse {
  setHeader(name: string, value: string): void;
}

type NextFunction = () => void;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: MiddlewareRequest, res: MiddlewareResponse, next: NextFunction) {
    // Add correlation ID for tracing
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    req['correlationId'] = correlationId;

    // Add tenant context
    const tenantId = req.headers['x-tenant-id'];
    if (tenantId) {
      req['tenantId'] = tenantId;
    }

    // Pass correlation ID in response
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}

// Export Roles decorator
export { Roles, ROLES_KEY } from '../../auth/roles.guard';

// Export ownership and role guards
export { ProductOwnershipGuard } from './product-ownership.guard';
export { OrderOwnershipGuard } from './order-ownership.guard';
export { AdminRoleGuard } from './admin-role.guard';

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limit Service - Redis-based Rate Limiting
// ═══════════════════════════════════════════════════════════════════════════
// Implements sliding window rate limiting for auth endpoints
// - Login: 5 attempts per minute
// - Register: 3 attempts per hour
// - Password Reset: 3 attempts per hour
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { RateLimitConfig, RateLimitResult, AuthConfig } from '../types';

export type RateLimitAction = 'login' | 'register' | 'password_reset' | 'totp_verify';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis;
  private readonly configs: Record<RateLimitAction, RateLimitConfig>;

  private readonly RATE_LIMIT_PREFIX = 'auth:ratelimit:';
  private readonly BLOCK_PREFIX = 'auth:blocked:';

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_AUTH_DB', 1),
      keyPrefix: 'nextgen:',
    });

    const authConfig = this.configService.get<AuthConfig['rate_limit']>('auth.rate_limit');

    this.configs = {
      login: authConfig?.login || {
        max_attempts: 5,
        window_seconds: 60,
        block_seconds: 900, // 15 minutes
      },
      register: authConfig?.register || {
        max_attempts: 3,
        window_seconds: 3600,
        block_seconds: 86400, // 24 hours
      },
      password_reset: authConfig?.password_reset || {
        max_attempts: 3,
        window_seconds: 3600,
        block_seconds: 3600,
      },
      totp_verify: {
        max_attempts: 5,
        window_seconds: 300, // 5 minutes
        block_seconds: 1800, // 30 minutes
      },
    };
  }

  /**
   * Check if action is allowed and increment counter
   */
  async checkAndIncrement(
    action: RateLimitAction,
    identifier: string,
  ): Promise<RateLimitResult> {
    const config = this.configs[action];
    const key = `${this.RATE_LIMIT_PREFIX}${action}:${identifier}`;
    const blockKey = `${this.BLOCK_PREFIX}${action}:${identifier}`;

    // Check if blocked
    const blocked = await this.redis.get(blockKey);
    if (blocked) {
      const ttl = await this.redis.ttl(blockKey);
      return {
        allowed: false,
        remaining: 0,
        reset_at: new Date(Date.now() + ttl * 1000),
        retry_after: ttl,
      };
    }

    const now = Date.now();
    const windowStart = now - config.window_seconds * 1000;

    // Use Redis transaction for atomic operations
    const multi = this.redis.multi();
    
    // Remove old entries outside the window
    multi.zremrangebyscore(key, 0, windowStart);
    
    // Count current attempts
    multi.zcard(key);
    
    // Add current attempt
    multi.zadd(key, now, `${now}`);
    
    // Set expiry on the key
    multi.expire(key, config.window_seconds);

    const results = await multi.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    // Check if limit exceeded
    if (currentCount >= config.max_attempts) {
      // Block the identifier
      await this.redis.setex(blockKey, config.block_seconds, '1');
      
      this.logger.warn('Rate limit exceeded', {
        action,
        identifier: this.maskIdentifier(identifier),
        attempts: currentCount + 1,
      });

      return {
        allowed: false,
        remaining: 0,
        reset_at: new Date(now + config.block_seconds * 1000),
        retry_after: config.block_seconds,
      };
    }

    return {
      allowed: true,
      remaining: config.max_attempts - currentCount - 1,
      reset_at: new Date(now + config.window_seconds * 1000),
    };
  }

  /**
   * Check rate limit without incrementing
   */
  async check(action: RateLimitAction, identifier: string): Promise<RateLimitResult> {
    const config = this.configs[action];
    const key = `${this.RATE_LIMIT_PREFIX}${action}:${identifier}`;
    const blockKey = `${this.BLOCK_PREFIX}${action}:${identifier}`;

    // Check if blocked
    const blocked = await this.redis.get(blockKey);
    if (blocked) {
      const ttl = await this.redis.ttl(blockKey);
      return {
        allowed: false,
        remaining: 0,
        reset_at: new Date(Date.now() + ttl * 1000),
        retry_after: ttl,
      };
    }

    const now = Date.now();
    const windowStart = now - config.window_seconds * 1000;

    // Count current attempts
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const currentCount = await this.redis.zcard(key);

    return {
      allowed: currentCount < config.max_attempts,
      remaining: Math.max(0, config.max_attempts - currentCount),
      reset_at: new Date(now + config.window_seconds * 1000),
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(action: RateLimitAction, identifier: string): Promise<void> {
    const key = `${this.RATE_LIMIT_PREFIX}${action}:${identifier}`;
    const blockKey = `${this.BLOCK_PREFIX}${action}:${identifier}`;

    await Promise.all([
      this.redis.del(key),
      this.redis.del(blockKey),
    ]);

    this.logger.debug('Rate limit reset', { action, identifier: this.maskIdentifier(identifier) });
  }

  /**
   * Get rate limit headers for response
   */
  async getHeaders(
    action: RateLimitAction,
    identifier: string,
  ): Promise<Record<string, string>> {
    const result = await this.check(action, identifier);
    const config = this.configs[action];

    return {
      'X-RateLimit-Limit': config.max_attempts.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(result.reset_at.getTime() / 1000).toString(),
      ...(result.retry_after ? { 'Retry-After': result.retry_after.toString() } : {}),
    };
  }

  /**
   * Mask identifier for logging (privacy)
   */
  private maskIdentifier(identifier: string): string {
    if (identifier.includes('@')) {
      // Email
      const [local, domain] = identifier.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    if (identifier.match(/^\d+$/)) {
      // Phone or IP
      return `${identifier.substring(0, 3)}***${identifier.substring(identifier.length - 2)}`;
    }
    return `${identifier.substring(0, 4)}***`;
  }
}

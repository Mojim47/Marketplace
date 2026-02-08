// ═══════════════════════════════════════════════════════════════════════════
// Cache Service - High-Level Caching Operations
// ═══════════════════════════════════════════════════════════════════════════
// Provides convenient methods for common caching patterns
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type {
  ICacheProvider,
  CacheSetOptions,
  CacheStats,
  CacheHealthCheck,
} from '../interfaces/cache.interface';
import { CacheFactory } from '../factory/cache.factory';

/**
 * Options for cached function wrapper
 */
export interface CachedOptions extends CacheSetOptions {
  /** Cache key (if not provided, will be generated from function name and args) */
  key?: string;
  /** Key generator function */
  keyGenerator?: (...args: unknown[]) => string;
  /** Skip cache condition */
  skipIf?: (result: unknown) => boolean;
  /** Force refresh (bypass cache read) */
  forceRefresh?: boolean;
}

/**
 * Lock options for distributed locking
 */
export interface LockOptions {
  /** Lock timeout in seconds */
  timeout?: number;
  /** Retry attempts */
  retries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Cache service providing high-level caching operations
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private provider!: ICacheProvider;

  constructor(private readonly factory: CacheFactory) {}

  async onModuleInit(): Promise<void> {
    try {
      this.provider = this.factory.createFromEnv('CACHE', 'default');
      this.logger.log(`Cache initialized: ${this.provider.providerType}`);
    } catch (error) {
      this.logger.warn(`Cache initialization skipped: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.provider) {
      await this.provider.close();
    }
  }

  /**
   * Set the active cache provider
   */
  setProvider(provider: ICacheProvider): void {
    this.provider = provider;
  }

  /**
   * Get the active cache provider
   */
  getProvider(): ICacheProvider {
    if (!this.provider) {
      throw new Error('Cache provider not initialized');
    }
    return this.provider;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Core Caching Methods
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    return this.provider.get<T>(key);
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<boolean> {
    return this.provider.set(key, value, options);
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    return this.provider.delete(key);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Cache-Aside Pattern
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get value from cache or compute and cache it
   * @param key - Cache key
   * @param fn - Function to compute value if not cached
   * @param options - Cache options
   * @returns Cached or computed value
   */
  async cached<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CachedOptions
  ): Promise<T> {
    // Check cache first (unless force refresh)
    if (!options?.forceRefresh) {
      const cached = await this.provider.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // Compute value
    const result = await fn();

    // Skip caching if condition met
    if (options?.skipIf && options.skipIf(result)) {
      return result;
    }

    // Cache the result
    await this.provider.set(key, result, options);

    return result;
  }

  /**
   * Decorator-style cached wrapper
   * @param keyPrefix - Key prefix
   * @param options - Cache options
   * @returns Wrapped function
   */
  wrap<TArgs extends unknown[], TResult>(
    keyPrefix: string,
    fn: (...args: TArgs) => Promise<TResult>,
    options?: CachedOptions
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const key = options?.keyGenerator
        ? options.keyGenerator(...args)
        : `${keyPrefix}:${JSON.stringify(args)}`;

      return this.cached(key, () => fn(...args), options);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Batch Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    return this.provider.mget<T>(keys);
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Map<string, T>, options?: CacheSetOptions): Promise<boolean> {
    return this.provider.mset(entries, options);
  }

  /**
   * Delete multiple keys from cache
   */
  async mdelete(keys: string[]): Promise<number> {
    return this.provider.mdelete(keys);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Pattern Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    return this.provider.keys(pattern);
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    return this.provider.deletePattern(pattern);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tag-Based Invalidation
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Invalidate all keys with a specific tag
   */
  async invalidateTag(tag: string): Promise<number> {
    return this.provider.invalidateTag(tag);
  }

  /**
   * Invalidate all keys with any of the specified tags
   */
  async invalidateTags(tags: string[]): Promise<number> {
    return this.provider.invalidateTags(tags);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Atomic Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Increment a numeric value
   */
  async increment(key: string, delta: number = 1): Promise<number> {
    return this.provider.increment(key, delta);
  }

  /**
   * Decrement a numeric value
   */
  async decrement(key: string, delta: number = 1): Promise<number> {
    return this.provider.decrement(key, delta);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Distributed Locking
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Acquire a distributed lock
   * @param lockKey - Lock key
   * @param options - Lock options
   * @returns Lock release function or null if lock not acquired
   */
  async acquireLock(
    lockKey: string,
    options?: LockOptions
  ): Promise<(() => Promise<void>) | null> {
    const timeout = options?.timeout || 30;
    const retries = options?.retries || 3;
    const retryDelay = options?.retryDelay || 100;

    const fullKey = `__lock__:${lockKey}`;
    const lockValue = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

    for (let attempt = 0; attempt < retries; attempt++) {
      const acquired = await this.provider.set(fullKey, lockValue, {
        ttl: timeout,
        nx: true,
      });

      if (acquired) {
        // Return release function
        return async () => {
          const currentValue = await this.provider.get<string>(fullKey);
          if (currentValue === lockValue) {
            await this.provider.delete(fullKey);
          }
        };
      }

      // Wait before retry
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return null;
  }

  /**
   * Execute function with distributed lock
   * @param lockKey - Lock key
   * @param fn - Function to execute
   * @param options - Lock options
   * @returns Function result or null if lock not acquired
   */
  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<T | null> {
    const release = await this.acquireLock(lockKey, options);
    
    if (!release) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Rate Limiting
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check and increment rate limit counter
   * @param key - Rate limit key (e.g., "rate:user:123")
   * @param limit - Maximum requests allowed
   * @param windowSeconds - Time window in seconds
   * @returns Object with allowed status and remaining requests
   */
  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const fullKey = `__rate__:${key}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowKey = `${fullKey}:${windowStart}`;

    const count = await this.provider.increment(windowKey);
    
    // Set TTL on first increment
    if (count === 1) {
      await this.provider.expire(windowKey, windowSeconds + 1);
    }

    const remaining = Math.max(0, limit - count);
    const resetAt = new Date(windowStart + windowMs);

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    return this.provider.clear();
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    return this.provider.stats();
  }

  /**
   * Check cache health
   */
  async healthCheck(): Promise<CacheHealthCheck> {
    return this.provider.healthCheck();
  }
}

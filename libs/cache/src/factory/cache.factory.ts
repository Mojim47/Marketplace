// ═══════════════════════════════════════════════════════════════════════════
// Cache Factory - Provider-Agnostic Cache Creation
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Switch providers without code changes
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { MemcachedCacheAdapter } from '../adapters/memcached.adapter';
import { MemoryCacheAdapter } from '../adapters/memory.adapter';
import { RedisCacheAdapter } from '../adapters/redis.adapter';
import type {
  CacheConfig,
  ICacheProvider,
  MemcachedCacheConfig,
  MemoryCacheConfig,
  RedisCacheConfig,
} from '../interfaces/cache.interface';
import { CacheProviderType } from '../interfaces/cache.interface';

/**
 * Cache factory for creating provider instances
 */
@Injectable()
export class CacheFactory {
  private readonly logger = new Logger(CacheFactory.name);
  private readonly providers: Map<string, ICacheProvider> = new Map();

  /**
   * Create a cache provider instance based on configuration
   * @param config - Cache configuration
   * @param name - Optional name for caching the provider instance
   * @returns Cache provider instance
   */
  create(config: CacheConfig, name?: string): ICacheProvider {
    const cacheKey = name || `${config.provider}:default`;

    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    let provider: ICacheProvider;

    switch (config.provider) {
      case CacheProviderType.MEMORY:
        provider = new MemoryCacheAdapter(config as MemoryCacheConfig);
        this.logger.log('Created MemoryCacheAdapter');
        break;

      case CacheProviderType.REDIS:
      case CacheProviderType.KEYDB:
        provider = new RedisCacheAdapter(config as RedisCacheConfig);
        this.logger.log(`Created RedisCacheAdapter for ${config.provider}`);
        break;

      case CacheProviderType.MEMCACHED:
        provider = new MemcachedCacheAdapter(config as MemcachedCacheConfig);
        this.logger.log('Created MemcachedCacheAdapter');
        break;

      default:
        throw new Error(`Unsupported cache provider: ${(config as CacheConfig).provider}`);
    }

    this.providers.set(cacheKey, provider);
    return provider;
  }

  /**
   * Create a cache provider from environment variables
   * @param prefix - Environment variable prefix
   * @param name - Optional name for caching
   * @returns Cache provider instance
   */
  createFromEnv(prefix = 'CACHE', name?: string): ICacheProvider {
    const provider = process.env[`${prefix}_PROVIDER`] as CacheProviderType;

    if (!provider) {
      throw new Error(`Missing environment variable: ${prefix}_PROVIDER`);
    }

    let config: CacheConfig;

    switch (provider) {
      case CacheProviderType.MEMORY:
        config = {
          provider: CacheProviderType.MEMORY,
          keyPrefix: process.env[`${prefix}_KEY_PREFIX`],
          defaultTtl: Number.parseInt(process.env[`${prefix}_DEFAULT_TTL`] || '0', 10),
          maxItems: Number.parseInt(process.env[`${prefix}_MAX_ITEMS`] || '10000', 10),
          maxMemory: Number.parseInt(process.env[`${prefix}_MAX_MEMORY`] || '104857600', 10),
        };
        break;

      case CacheProviderType.REDIS:
      case CacheProviderType.KEYDB:
        config = {
          provider,
          host: process.env[`${prefix}_HOST`] || 'localhost',
          port: Number.parseInt(process.env[`${prefix}_PORT`] || '6379', 10),
          password: process.env[`${prefix}_PASSWORD`],
          db: Number.parseInt(process.env[`${prefix}_DB`] || '0', 10),
          keyPrefix: process.env[`${prefix}_KEY_PREFIX`],
          defaultTtl: Number.parseInt(process.env[`${prefix}_DEFAULT_TTL`] || '0', 10),
          tls: process.env[`${prefix}_TLS`] === 'true',
          connectTimeout: Number.parseInt(process.env[`${prefix}_CONNECT_TIMEOUT`] || '10000', 10),
        };
        break;

      case CacheProviderType.MEMCACHED:
        config = {
          provider: CacheProviderType.MEMCACHED,
          servers: (process.env[`${prefix}_SERVERS`] || 'localhost:11211').split(','),
          keyPrefix: process.env[`${prefix}_KEY_PREFIX`],
          defaultTtl: Number.parseInt(process.env[`${prefix}_DEFAULT_TTL`] || '0', 10),
          timeout: Number.parseInt(process.env[`${prefix}_TIMEOUT`] || '5000', 10),
          retries: Number.parseInt(process.env[`${prefix}_RETRIES`] || '3', 10),
        };
        break;

      default:
        throw new Error(`Unsupported cache provider: ${provider}`);
    }

    return this.create(config, name);
  }

  /**
   * Get a cached provider instance by name
   */
  get(name: string): ICacheProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a provider is cached
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Remove a cached provider
   */
  async remove(name: string): Promise<boolean> {
    const provider = this.providers.get(name);
    if (provider) {
      await provider.close();
      this.providers.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Clear all cached providers
   */
  async clear(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.close();
    }
    this.providers.clear();
  }

  /**
   * Get all cached provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
}

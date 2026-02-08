// ═══════════════════════════════════════════════════════════════════════════
// @nextgen/cache - Vendor-Agnostic Cache Abstraction
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Supports Redis, Memcached, In-Memory, KeyDB
// ═══════════════════════════════════════════════════════════════════════════

// Interfaces
export { CacheProviderType } from './interfaces';

export type {
  ICacheProvider,
  CacheEntry,
  CacheSetOptions,
  CacheGetOptions,
  CacheScanOptions,
  CacheScanResult,
  CacheStats,
  CacheHealthCheck,
  CacheConfigBase,
  MemoryCacheConfig,
  RedisCacheConfig,
  MemcachedCacheConfig,
  CacheConfig,
} from './interfaces';

// Adapters
export { MemoryCacheAdapter } from './adapters/memory.adapter';
export { RedisCacheAdapter } from './adapters/redis.adapter';
export { MemcachedCacheAdapter } from './adapters/memcached.adapter';

// Factory
export { CacheFactory } from './factory';

// Services
export { CacheService } from './services';
export type { CachedOptions, LockOptions } from './services';
export { DistributedLockService } from './distributed-lock.service';

// Module
export { CacheModule } from './cache.module';
export type { CacheModuleOptions, CacheModuleAsyncOptions } from './cache.module';

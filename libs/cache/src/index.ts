// ═══════════════════════════════════════════════════════════════════════════
// @nextgen/cache - Vendor-Agnostic Cache Abstraction
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Supports Redis, Memcached, In-Memory, KeyDB
// ═══════════════════════════════════════════════════════════════════════════

export { MemcachedCacheAdapter } from './adapters/memcached.adapter';
// Adapters
export { MemoryCacheAdapter } from './adapters/memory.adapter';
export { RedisCacheAdapter } from './adapters/redis.adapter';
export type { CacheModuleAsyncOptions, CacheModuleOptions } from './cache.module';
// Module
export { CacheModule } from './cache.module';
export { DistributedLockService } from './distributed-lock.service';
// Factory
export { CacheFactory } from './factory';
export type {
  CacheConfig,
  CacheConfigBase,
  CacheEntry,
  CacheGetOptions,
  CacheHealthCheck,
  CacheScanOptions,
  CacheScanResult,
  CacheSetOptions,
  CacheStats,
  ICacheProvider,
  MemcachedCacheConfig,
  MemoryCacheConfig,
  RedisCacheConfig,
} from './interfaces';
// Interfaces
export { CacheProviderType } from './interfaces';
export type { CachedOptions, LockOptions } from './services';
// Services
export { CacheService } from './services';

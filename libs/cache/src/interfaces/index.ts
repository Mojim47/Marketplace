// ═══════════════════════════════════════════════════════════════════════════
// Cache Interfaces - Barrel Export
// ═══════════════════════════════════════════════════════════════════════════

export { CacheProviderType } from './cache.interface';

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
} from './cache.interface';

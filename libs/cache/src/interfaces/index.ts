// ═══════════════════════════════════════════════════════════════════════════
// Cache Interfaces - Barrel Export
// ═══════════════════════════════════════════════════════════════════════════

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
} from './cache.interface';
export { CacheProviderType } from './cache.interface';

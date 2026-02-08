// ═══════════════════════════════════════════════════════════════════════════
// Cache Provider Interface - Vendor Agnostic Caching
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Supports Redis, Memcached, In-Memory, KeyDB
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cache provider types supported by the abstraction layer
 */
export enum CacheProviderType {
  MEMORY = 'memory',
  REDIS = 'redis',
  MEMCACHED = 'memcached',
  KEYDB = 'keydb',
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T = unknown> {
  /** Cached value */
  value: T;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Custom tags for invalidation */
  tags?: string[];
}

/**
 * Options for setting cache values
 */
export interface CacheSetOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Tags for group invalidation */
  tags?: string[];
  /** Only set if key doesn't exist (NX) */
  nx?: boolean;
  /** Only set if key exists (XX) */
  xx?: boolean;
}

/**
 * Options for getting cache values
 */
export interface CacheGetOptions {
  /** Refresh TTL on access (sliding expiration) */
  touch?: boolean;
}

/**
 * Options for listing/scanning keys
 */
export interface CacheScanOptions {
  /** Pattern to match keys */
  pattern?: string;
  /** Maximum number of keys to return */
  count?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Result of scanning keys
 */
export interface CacheScanResult {
  /** Matched keys */
  keys: string[];
  /** Next cursor for pagination */
  cursor: string;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total number of keys */
  keyCount: number;
  /** Memory usage in bytes (if available) */
  memoryUsage?: number;
  /** Provider type */
  provider: CacheProviderType;
  /** Uptime in seconds */
  uptime?: number;
}

/**
 * Cache health check result
 */
export interface CacheHealthCheck {
  /** Whether the cache is healthy */
  healthy: boolean;
  /** Provider type */
  provider: CacheProviderType;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Error message if unhealthy */
  error?: string;
  /** Timestamp of the check */
  timestamp: Date;
}

/**
 * Cache provider interface - All adapters must implement this
 */
export interface ICacheProvider {
  /** Provider type identifier */
  readonly providerType: CacheProviderType;

  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a value from cache
   * @param key - Cache key
   * @param options - Get options
   * @returns Cached value or null if not found
   */
  get<T = unknown>(key: string, options?: CacheGetOptions): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Set options
   * @returns True if set successfully
   */
  set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<boolean>;

  /**
   * Delete a key from cache
   * @param key - Cache key
   * @returns True if key was deleted
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   * @param key - Cache key
   * @returns True if key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get remaining TTL for a key in seconds
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  ttl(key: string): Promise<number>;

  /**
   * Set/update TTL for a key
   * @param key - Cache key
   * @param ttl - New TTL in seconds
   * @returns True if TTL was set
   */
  expire(key: string, ttl: number): Promise<boolean>;

  // ═══════════════════════════════════════════════════════════════════════
  // Batch Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get multiple values from cache
   * @param keys - Array of cache keys
   * @returns Map of key to value (null for missing keys)
   */
  mget<T = unknown>(keys: string[]): Promise<Map<string, T | null>>;

  /**
   * Set multiple values in cache
   * @param entries - Map of key to value
   * @param options - Set options (applied to all)
   * @returns True if all set successfully
   */
  mset<T = unknown>(entries: Map<string, T>, options?: CacheSetOptions): Promise<boolean>;

  /**
   * Delete multiple keys from cache
   * @param keys - Array of cache keys
   * @returns Number of keys deleted
   */
  mdelete(keys: string[]): Promise<number>;

  // ═══════════════════════════════════════════════════════════════════════
  // Pattern Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all keys matching a pattern
   * @param pattern - Glob pattern (e.g., "user:*")
   * @returns Array of matching keys
   */
  keys(pattern: string): Promise<string[]>;

  /**
   * Scan keys with pagination
   * @param options - Scan options
   * @returns Scan result with keys and cursor
   */
  scan(options?: CacheScanOptions): Promise<CacheScanResult>;

  /**
   * Delete all keys matching a pattern
   * @param pattern - Glob pattern
   * @returns Number of keys deleted
   */
  deletePattern(pattern: string): Promise<number>;

  // ═══════════════════════════════════════════════════════════════════════
  // Tag Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Invalidate all keys with a specific tag
   * @param tag - Tag to invalidate
   * @returns Number of keys invalidated
   */
  invalidateTag(tag: string): Promise<number>;

  /**
   * Invalidate all keys with any of the specified tags
   * @param tags - Tags to invalidate
   * @returns Number of keys invalidated
   */
  invalidateTags(tags: string[]): Promise<number>;

  // ═══════════════════════════════════════════════════════════════════════
  // Atomic Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Increment a numeric value
   * @param key - Cache key
   * @param delta - Amount to increment (default: 1)
   * @returns New value after increment
   */
  increment(key: string, delta?: number): Promise<number>;

  /**
   * Decrement a numeric value
   * @param key - Cache key
   * @param delta - Amount to decrement (default: 1)
   * @returns New value after decrement
   */
  decrement(key: string, delta?: number): Promise<number>;

  /**
   * Get and delete a key atomically
   * @param key - Cache key
   * @returns Value before deletion or null
   */
  getDelete<T = unknown>(key: string): Promise<T | null>;

  /**
   * Get and set a key atomically
   * @param key - Cache key
   * @param value - New value
   * @returns Previous value or null
   */
  getSet<T = unknown>(key: string, value: T): Promise<T | null>;

  // ═══════════════════════════════════════════════════════════════════════
  // Hash Operations (for structured data)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a field from a hash
   * @param key - Hash key
   * @param field - Field name
   * @returns Field value or null
   */
  hget<T = unknown>(key: string, field: string): Promise<T | null>;

  /**
   * Set a field in a hash
   * @param key - Hash key
   * @param field - Field name
   * @param value - Field value
   * @returns True if field was created, false if updated
   */
  hset<T = unknown>(key: string, field: string, value: T): Promise<boolean>;

  /**
   * Get all fields from a hash
   * @param key - Hash key
   * @returns Map of field to value
   */
  hgetall<T = unknown>(key: string): Promise<Map<string, T>>;

  /**
   * Delete a field from a hash
   * @param key - Hash key
   * @param field - Field name
   * @returns True if field was deleted
   */
  hdel(key: string, field: string): Promise<boolean>;

  /**
   * Check if a field exists in a hash
   * @param key - Hash key
   * @param field - Field name
   * @returns True if field exists
   */
  hexists(key: string, field: string): Promise<boolean>;

  // ═══════════════════════════════════════════════════════════════════════
  // List Operations (for queues/stacks)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Push value to the end of a list
   * @param key - List key
   * @param value - Value to push
   * @returns New length of the list
   */
  rpush<T = unknown>(key: string, value: T): Promise<number>;

  /**
   * Push value to the beginning of a list
   * @param key - List key
   * @param value - Value to push
   * @returns New length of the list
   */
  lpush<T = unknown>(key: string, value: T): Promise<number>;

  /**
   * Pop value from the end of a list
   * @param key - List key
   * @returns Popped value or null
   */
  rpop<T = unknown>(key: string): Promise<T | null>;

  /**
   * Pop value from the beginning of a list
   * @param key - List key
   * @returns Popped value or null
   */
  lpop<T = unknown>(key: string): Promise<T | null>;

  /**
   * Get list length
   * @param key - List key
   * @returns List length
   */
  llen(key: string): Promise<number>;

  /**
   * Get range of list elements
   * @param key - List key
   * @param start - Start index
   * @param stop - Stop index (-1 for end)
   * @returns Array of values
   */
  lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;

  // ═══════════════════════════════════════════════════════════════════════
  // Set Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Add member to a set
   * @param key - Set key
   * @param member - Member to add
   * @returns True if member was added
   */
  sadd<T = unknown>(key: string, member: T): Promise<boolean>;

  /**
   * Remove member from a set
   * @param key - Set key
   * @param member - Member to remove
   * @returns True if member was removed
   */
  srem<T = unknown>(key: string, member: T): Promise<boolean>;

  /**
   * Check if member exists in a set
   * @param key - Set key
   * @param member - Member to check
   * @returns True if member exists
   */
  sismember<T = unknown>(key: string, member: T): Promise<boolean>;

  /**
   * Get all members of a set
   * @param key - Set key
   * @returns Array of members
   */
  smembers<T = unknown>(key: string): Promise<T[]>;

  /**
   * Get set cardinality (size)
   * @param key - Set key
   * @returns Number of members
   */
  scard(key: string): Promise<number>;

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Clear all keys (use with caution!)
   * @returns True if cleared successfully
   */
  clear(): Promise<boolean>;

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  stats(): Promise<CacheStats>;

  /**
   * Check cache health
   * @returns Health check result
   */
  healthCheck(): Promise<CacheHealthCheck>;

  /**
   * Close connection (cleanup)
   */
  close(): Promise<void>;
}

/**
 * Cache configuration base
 */
export interface CacheConfigBase {
  /** Provider type */
  provider: CacheProviderType;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Default TTL in seconds */
  defaultTtl?: number;
}

/**
 * In-memory cache configuration
 */
export interface MemoryCacheConfig extends CacheConfigBase {
  provider: CacheProviderType.MEMORY;
  /** Maximum number of items */
  maxItems?: number;
  /** Maximum memory in bytes */
  maxMemory?: number;
  /** Check period for expired items in ms */
  checkPeriod?: number;
}

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig extends CacheConfigBase {
  provider: CacheProviderType.REDIS | CacheProviderType.KEYDB;
  /** Redis host */
  host: string;
  /** Redis port */
  port: number;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** Connection timeout in ms */
  connectTimeout?: number;
  /** Enable TLS */
  tls?: boolean;
  /** Cluster mode */
  cluster?: boolean;
  /** Cluster nodes (if cluster mode) */
  clusterNodes?: Array<{ host: string; port: number }>;
  /** Sentinel configuration */
  sentinel?: {
    name: string;
    sentinels: Array<{ host: string; port: number }>;
  };
}

/**
 * Memcached cache configuration
 */
export interface MemcachedCacheConfig extends CacheConfigBase {
  provider: CacheProviderType.MEMCACHED;
  /** Memcached servers (host:port) */
  servers: string[];
  /** Connection timeout in ms */
  timeout?: number;
  /** Number of retries */
  retries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Connection pool size */
  poolSize?: number;
}

/**
 * Union type for all cache configurations
 */
export type CacheConfig = MemoryCacheConfig | RedisCacheConfig | MemcachedCacheConfig;

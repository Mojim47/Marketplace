// ═══════════════════════════════════════════════════════════════════════════
// In-Memory Cache Adapter
// ═══════════════════════════════════════════════════════════════════════════
// High-performance LRU cache for development and single-instance deployments
// ═══════════════════════════════════════════════════════════════════════════

import { LRUCache } from 'lru-cache';
import type {
  ICacheProvider,
  CacheSetOptions,
  CacheGetOptions,
  CacheScanOptions,
  CacheScanResult,
  CacheStats,
  CacheHealthCheck,
  MemoryCacheConfig,
} from '../interfaces/cache.interface';
import { CacheProviderType } from '../interfaces/cache.interface';

interface CacheItem<T = unknown> {
  value: T;
  tags?: string[];
  createdAt: number;
}

/**
 * In-memory cache adapter using LRU cache
 */
export class MemoryCacheAdapter implements ICacheProvider {
  readonly providerType = CacheProviderType.MEMORY;

  private readonly cache: LRUCache<string, CacheItem>;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;
  private readonly tagIndex: Map<string, Set<string>> = new Map();
  private hits = 0;
  private misses = 0;
  private readonly startTime = Date.now();

  constructor(config: MemoryCacheConfig) {
    this.keyPrefix = config.keyPrefix || '';
    this.defaultTtl = config.defaultTtl || 0;

    this.cache = new LRUCache<string, CacheItem>({
      max: config.maxItems || 10000,
      maxSize: config.maxMemory || 100 * 1024 * 1024, // 100MB default
      sizeCalculation: (item) => {
        return JSON.stringify(item).length;
      },
      ttl: this.defaultTtl * 1000,
      ttlAutopurge: true,
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
  }

  private prefixKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  private unprefixKey(key: string): string {
    if (this.keyPrefix && key.startsWith(`${this.keyPrefix}:`)) {
      return key.slice(this.keyPrefix.length + 1);
    }
    return key;
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(key);
  }

  private addToTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeFromTagIndex(key: string): void {
    for (const [, keys] of this.tagIndex) {
      keys.delete(key);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  async get<T = unknown>(key: string, options?: CacheGetOptions): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const item = this.cache.get(prefixedKey);

    if (item === undefined) {
      this.misses++;
      return null;
    }

    this.hits++;

    if (options?.touch) {
      // Refresh TTL by re-setting
      const ttl = this.cache.getRemainingTTL(prefixedKey);
      if (ttl > 0) {
        this.cache.set(prefixedKey, item, { ttl });
      }
    }

    return item.value as T;
  }

  async set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);

    // Handle NX (only if not exists)
    if (options?.nx && this.cache.has(prefixedKey)) {
      return false;
    }

    // Handle XX (only if exists)
    if (options?.xx && !this.cache.has(prefixedKey)) {
      return false;
    }

    const item: CacheItem<T> = {
      value,
      tags: options?.tags,
      createdAt: Date.now(),
    };

    const ttl = options?.ttl ?? this.defaultTtl;
    this.cache.set(prefixedKey, item, ttl > 0 ? { ttl: ttl * 1000 } : undefined);

    if (options?.tags) {
      this.addToTagIndex(prefixedKey, options.tags);
    }

    return true;
  }

  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const existed = this.cache.has(prefixedKey);
    this.cache.delete(prefixedKey);
    this.removeFromTagIndex(prefixedKey);
    return existed;
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(this.prefixKey(key));
  }

  async ttl(key: string): Promise<number> {
    const prefixedKey = this.prefixKey(key);
    if (!this.cache.has(prefixedKey)) {
      return -2;
    }
    const remaining = this.cache.getRemainingTTL(prefixedKey);
    return remaining === Infinity ? -1 : Math.ceil(remaining / 1000);
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const item = this.cache.get(prefixedKey);
    if (!item) {
      return false;
    }
    this.cache.set(prefixedKey, item, { ttl: ttl * 1000 });
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Batch Operations
  // ═══════════════════════════════════════════════════════════════════════

  async mget<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }
    return result;
  }

  async mset<T = unknown>(entries: Map<string, T>, options?: CacheSetOptions): Promise<boolean> {
    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
    return true;
  }

  async mdelete(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Pattern Operations
  // ═══════════════════════════════════════════════════════════════════════

  async keys(pattern: string): Promise<string[]> {
    const prefixedPattern = this.prefixKey(pattern);
    const result: string[] = [];

    for (const key of this.cache.keys()) {
      if (this.matchPattern(key, prefixedPattern)) {
        result.push(this.unprefixKey(key));
      }
    }

    return result;
  }

  async scan(options?: CacheScanOptions): Promise<CacheScanResult> {
    const pattern = options?.pattern || '*';
    const count = options?.count || 100;
    const cursor = parseInt(options?.cursor || '0', 10);

    const allKeys = await this.keys(pattern);
    const start = cursor;
    const end = Math.min(start + count, allKeys.length);
    const keys = allKeys.slice(start, end);

    return {
      keys,
      cursor: end.toString(),
      hasMore: end < allKeys.length,
    };
  }

  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    return this.mdelete(keys);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tag Operations
  // ═══════════════════════════════════════════════════════════════════════

  async invalidateTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) {
      return 0;
    }

    let count = 0;
    for (const key of keys) {
      this.cache.delete(key);
      count++;
    }

    this.tagIndex.delete(tag);
    return count;
  }

  async invalidateTags(tags: string[]): Promise<number> {
    let count = 0;
    for (const tag of tags) {
      count += await this.invalidateTag(tag);
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Atomic Operations
  // ═══════════════════════════════════════════════════════════════════════

  async increment(key: string, delta: number = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) + delta;
    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, delta: number = 1): Promise<number> {
    return this.increment(key, -delta);
  }

  async getDelete<T = unknown>(key: string): Promise<T | null> {
    const value = await this.get<T>(key);
    await this.delete(key);
    return value;
  }

  async getSet<T = unknown>(key: string, value: T): Promise<T | null> {
    const oldValue = await this.get<T>(key);
    await this.set(key, value);
    return oldValue;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Hash Operations
  // ═══════════════════════════════════════════════════════════════════════

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const hash = await this.get<Map<string, T>>(key);
    if (!hash) return null;
    return hash.get(field) ?? null;
  }

  async hset<T = unknown>(key: string, field: string, value: T): Promise<boolean> {
    let hash = await this.get<Map<string, T>>(key);
    const isNew = !hash || !hash.has(field);
    
    if (!hash) {
      hash = new Map();
    }
    hash.set(field, value);
    await this.set(key, hash);
    return isNew;
  }

  async hgetall<T = unknown>(key: string): Promise<Map<string, T>> {
    const hash = await this.get<Map<string, T>>(key);
    return hash || new Map();
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const hash = await this.get<Map<string, unknown>>(key);
    if (!hash) return false;
    
    const existed = hash.has(field);
    hash.delete(field);
    
    if (hash.size === 0) {
      await this.delete(key);
    } else {
      await this.set(key, hash);
    }
    
    return existed;
  }

  async hexists(key: string, field: string): Promise<boolean> {
    const hash = await this.get<Map<string, unknown>>(key);
    return hash?.has(field) ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // List Operations
  // ═══════════════════════════════════════════════════════════════════════

  async rpush<T = unknown>(key: string, value: T): Promise<number> {
    let list = await this.get<T[]>(key);
    if (!list) list = [];
    list.push(value);
    await this.set(key, list);
    return list.length;
  }

  async lpush<T = unknown>(key: string, value: T): Promise<number> {
    let list = await this.get<T[]>(key);
    if (!list) list = [];
    list.unshift(value);
    await this.set(key, list);
    return list.length;
  }

  async rpop<T = unknown>(key: string): Promise<T | null> {
    const list = await this.get<T[]>(key);
    if (!list || list.length === 0) return null;
    const value = list.pop()!;
    await this.set(key, list);
    return value;
  }

  async lpop<T = unknown>(key: string): Promise<T | null> {
    const list = await this.get<T[]>(key);
    if (!list || list.length === 0) return null;
    const value = list.shift()!;
    await this.set(key, list);
    return value;
  }

  async llen(key: string): Promise<number> {
    const list = await this.get<unknown[]>(key);
    return list?.length ?? 0;
  }

  async lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]> {
    const list = await this.get<T[]>(key);
    if (!list) return [];
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Set Operations
  // ═══════════════════════════════════════════════════════════════════════

  async sadd<T = unknown>(key: string, member: T): Promise<boolean> {
    let set = await this.get<Set<T>>(key);
    if (!set) set = new Set();
    const isNew = !set.has(member);
    set.add(member);
    await this.set(key, set);
    return isNew;
  }

  async srem<T = unknown>(key: string, member: T): Promise<boolean> {
    const set = await this.get<Set<T>>(key);
    if (!set) return false;
    const existed = set.delete(member);
    await this.set(key, set);
    return existed;
  }

  async sismember<T = unknown>(key: string, member: T): Promise<boolean> {
    const set = await this.get<Set<T>>(key);
    return set?.has(member) ?? false;
  }

  async smembers<T = unknown>(key: string): Promise<T[]> {
    const set = await this.get<Set<T>>(key);
    return set ? Array.from(set) : [];
  }

  async scard(key: string): Promise<number> {
    const set = await this.get<Set<unknown>>(key);
    return set?.size ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Operations
  // ═══════════════════════════════════════════════════════════════════════

  async clear(): Promise<boolean> {
    this.cache.clear();
    this.tagIndex.clear();
    this.hits = 0;
    this.misses = 0;
    return true;
  }

  async stats(): Promise<CacheStats> {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      keyCount: this.cache.size,
      memoryUsage: this.cache.calculatedSize,
      provider: this.providerType,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  async healthCheck(): Promise<CacheHealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple read/write test
      const testKey = '__health_check__';
      await this.set(testKey, 'ok', { ttl: 1 });
      const value = await this.get(testKey);
      await this.delete(testKey);

      return {
        healthy: value === 'ok',
        provider: this.providerType,
        latencyMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.providerType,
        latencyMs: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  async close(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }
}

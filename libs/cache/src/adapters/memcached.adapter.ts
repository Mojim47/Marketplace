// ═══════════════════════════════════════════════════════════════════════════
// Memcached Cache Adapter
// ═══════════════════════════════════════════════════════════════════════════
// High-performance distributed memory caching
// ═══════════════════════════════════════════════════════════════════════════

import Memcached from 'memcached';
import type {
  CacheGetOptions,
  CacheHealthCheck,
  CacheScanOptions,
  CacheScanResult,
  CacheSetOptions,
  CacheStats,
  ICacheProvider,
  MemcachedCacheConfig,
} from '../interfaces/cache.interface';
import { CacheProviderType } from '../interfaces/cache.interface';

/**
 * Memcached cache adapter
 * Note: Memcached has limited functionality compared to Redis
 */
export class MemcachedCacheAdapter implements ICacheProvider {
  readonly providerType = CacheProviderType.MEMCACHED;

  private readonly client: Memcached;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;
  private hits = 0;
  private misses = 0;
  private readonly trackedKeys: Set<string> = new Set();

  constructor(config: MemcachedCacheConfig) {
    this.keyPrefix = config.keyPrefix || '';
    this.defaultTtl = config.defaultTtl || 0;

    this.client = new Memcached(config.servers, {
      timeout: config.timeout || 5000,
      retries: config.retries || 3,
      retry: config.retryDelay || 1000,
      poolSize: config.poolSize || 10,
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

  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  private deserialize<T>(value: string | undefined): T | null {
    if (value === undefined) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  private promisify<T>(
    fn: (callback: (err: Error | undefined, result: T) => void) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      fn((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  async get<T = unknown>(key: string, _options?: CacheGetOptions): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);

    try {
      const value = await this.promisify<string | undefined>((cb) =>
        this.client.get(prefixedKey, cb)
      );

      if (value === undefined) {
        this.misses++;
        return null;
      }

      this.hits++;
      return this.deserialize<T>(value);
    } catch {
      this.misses++;
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const serialized = this.serialize(value);
    const ttl = options?.ttl ?? this.defaultTtl;

    try {
      if (options?.nx) {
        // Only set if not exists
        await this.promisify<boolean>((cb) => this.client.add(prefixedKey, serialized, ttl, cb));
      } else if (options?.xx) {
        // Only set if exists
        await this.promisify<boolean>((cb) =>
          this.client.replace(prefixedKey, serialized, ttl, cb)
        );
      } else {
        await this.promisify<boolean>((cb) => this.client.set(prefixedKey, serialized, ttl, cb));
      }

      this.trackedKeys.add(prefixedKey);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);

    try {
      await this.promisify<boolean>((cb) => this.client.del(prefixedKey, cb));
      this.trackedKeys.delete(prefixedKey);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async ttl(_key: string): Promise<number> {
    // Memcached doesn't support TTL retrieval
    return -1;
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);

    try {
      await this.promisify<boolean>((cb) => this.client.touch(prefixedKey, ttl, cb));
      return true;
    } catch {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Batch Operations
  // ═══════════════════════════════════════════════════════════════════════

  async mget<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    if (keys.length === 0) {
      return new Map();
    }

    const prefixedKeys = keys.map((k) => this.prefixKey(k));

    try {
      const values = await this.promisify<Record<string, string>>((cb) =>
        this.client.getMulti(prefixedKeys, cb)
      );

      const result = new Map<string, T | null>();
      for (const key of keys) {
        const prefixedKey = this.prefixKey(key);
        const value = values[prefixedKey];

        if (value === undefined) {
          this.misses++;
          result.set(key, null);
        } else {
          this.hits++;
          result.set(key, this.deserialize<T>(value));
        }
      }

      return result;
    } catch {
      const result = new Map<string, T | null>();
      for (const key of keys) {
        result.set(key, null);
      }
      return result;
    }
  }

  async mset<T = unknown>(entries: Map<string, T>, options?: CacheSetOptions): Promise<boolean> {
    const promises: Promise<boolean>[] = [];

    for (const [key, value] of entries) {
      promises.push(this.set(key, value, options));
    }

    const results = await Promise.all(promises);
    return results.every((r) => r);
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
  // Pattern Operations (Limited in Memcached)
  // ═══════════════════════════════════════════════════════════════════════

  async keys(pattern: string): Promise<string[]> {
    // Memcached doesn't support key listing
    // We use tracked keys as a workaround
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    const result: string[] = [];

    for (const key of this.trackedKeys) {
      const unprefixed = this.unprefixKey(key);
      if (regex.test(unprefixed)) {
        result.push(unprefixed);
      }
    }

    return result;
  }

  async scan(options?: CacheScanOptions): Promise<CacheScanResult> {
    const pattern = options?.pattern || '*';
    const count = options?.count || 100;
    const cursor = Number.parseInt(options?.cursor || '0', 10);

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
  // Tag Operations (Simulated)
  // ═══════════════════════════════════════════════════════════════════════

  async invalidateTag(tag: string): Promise<number> {
    const tagKey = this.prefixKey(`__tag__:${tag}`);
    const keysJson = await this.get<string[]>(tagKey);

    if (!keysJson || keysJson.length === 0) {
      return 0;
    }

    let count = 0;
    for (const key of keysJson) {
      if (await this.delete(this.unprefixKey(key))) {
        count++;
      }
    }

    await this.delete(`__tag__:${tag}`);
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

  async increment(key: string, delta = 1): Promise<number> {
    const prefixedKey = this.prefixKey(key);

    try {
      const result = await this.promisify<number | false>((cb) =>
        this.client.incr(prefixedKey, delta, cb)
      );

      if (result === false) {
        // Key doesn't exist, create it
        await this.set(key, delta);
        return delta;
      }

      return result;
    } catch {
      await this.set(key, delta);
      return delta;
    }
  }

  async decrement(key: string, delta = 1): Promise<number> {
    const prefixedKey = this.prefixKey(key);

    try {
      const result = await this.promisify<number | false>((cb) =>
        this.client.decr(prefixedKey, delta, cb)
      );

      if (result === false) {
        await this.set(key, 0);
        return 0;
      }

      return result;
    } catch {
      await this.set(key, 0);
      return 0;
    }
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
  // Hash Operations (Simulated with JSON)
  // ═══════════════════════════════════════════════════════════════════════

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const hash = await this.get<Record<string, T>>(key);
    if (!hash) {
      return null;
    }
    return hash[field] ?? null;
  }

  async hset<T = unknown>(key: string, field: string, value: T): Promise<boolean> {
    let hash = await this.get<Record<string, T>>(key);
    const isNew = !hash || !(field in hash);

    if (!hash) {
      hash = {};
    }
    hash[field] = value;
    await this.set(key, hash);
    return isNew;
  }

  async hgetall<T = unknown>(key: string): Promise<Map<string, T>> {
    const hash = await this.get<Record<string, T>>(key);
    const result = new Map<string, T>();

    if (hash) {
      for (const [field, value] of Object.entries(hash)) {
        result.set(field, value as T);
      }
    }

    return result;
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const hash = await this.get<Record<string, unknown>>(key);
    if (!hash || !(field in hash)) {
      return false;
    }

    delete hash[field];

    if (Object.keys(hash).length === 0) {
      await this.delete(key);
    } else {
      await this.set(key, hash);
    }

    return true;
  }

  async hexists(key: string, field: string): Promise<boolean> {
    const hash = await this.get<Record<string, unknown>>(key);
    return hash ? field in hash : false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // List Operations (Simulated with JSON)
  // ═══════════════════════════════════════════════════════════════════════

  async rpush<T = unknown>(key: string, value: T): Promise<number> {
    let list = await this.get<T[]>(key);
    if (!list) {
      list = [];
    }
    list.push(value);
    await this.set(key, list);
    return list.length;
  }

  async lpush<T = unknown>(key: string, value: T): Promise<number> {
    let list = await this.get<T[]>(key);
    if (!list) {
      list = [];
    }
    list.unshift(value);
    await this.set(key, list);
    return list.length;
  }

  async rpop<T = unknown>(key: string): Promise<T | null> {
    const list = await this.get<T[]>(key);
    if (!list || list.length === 0) {
      return null;
    }
    const value = list.pop()!;
    await this.set(key, list);
    return value;
  }

  async lpop<T = unknown>(key: string): Promise<T | null> {
    const list = await this.get<T[]>(key);
    if (!list || list.length === 0) {
      return null;
    }
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
    if (!list) {
      return [];
    }
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Set Operations (Simulated with JSON)
  // ═══════════════════════════════════════════════════════════════════════

  async sadd<T = unknown>(key: string, member: T): Promise<boolean> {
    let arr = await this.get<T[]>(key);
    if (!arr) {
      arr = [];
    }

    const serialized = JSON.stringify(member);
    const exists = arr.some((m) => JSON.stringify(m) === serialized);

    if (!exists) {
      arr.push(member);
      await this.set(key, arr);
      return true;
    }

    return false;
  }

  async srem<T = unknown>(key: string, member: T): Promise<boolean> {
    const arr = await this.get<T[]>(key);
    if (!arr) {
      return false;
    }

    const serialized = JSON.stringify(member);
    const index = arr.findIndex((m) => JSON.stringify(m) === serialized);

    if (index !== -1) {
      arr.splice(index, 1);
      await this.set(key, arr);
      return true;
    }

    return false;
  }

  async sismember<T = unknown>(key: string, member: T): Promise<boolean> {
    const arr = await this.get<T[]>(key);
    if (!arr) {
      return false;
    }

    const serialized = JSON.stringify(member);
    return arr.some((m) => JSON.stringify(m) === serialized);
  }

  async smembers<T = unknown>(key: string): Promise<T[]> {
    const arr = await this.get<T[]>(key);
    return arr || [];
  }

  async scard(key: string): Promise<number> {
    const arr = await this.get<unknown[]>(key);
    return arr?.length ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Operations
  // ═══════════════════════════════════════════════════════════════════════

  async clear(): Promise<boolean> {
    try {
      await this.promisify<boolean>((cb) => this.client.flush(cb));
      this.trackedKeys.clear();
      this.hits = 0;
      this.misses = 0;
      return true;
    } catch {
      return false;
    }
  }

  async stats(): Promise<CacheStats> {
    const total = this.hits + this.misses;

    try {
      const serverStats = await this.promisify<Record<string, Record<string, string>>>((cb) =>
        this.client.stats(cb)
      );

      let keyCount = 0;
      let memoryUsage = 0;
      let uptime = 0;

      for (const server of Object.values(serverStats)) {
        keyCount += Number.parseInt(server.curr_items || '0', 10);
        memoryUsage += Number.parseInt(server.bytes || '0', 10);
        uptime = Math.max(uptime, Number.parseInt(server.uptime || '0', 10));
      }

      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: total > 0 ? (this.hits / total) * 100 : 0,
        keyCount,
        memoryUsage,
        provider: this.providerType,
        uptime,
      };
    } catch {
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: total > 0 ? (this.hits / total) * 100 : 0,
        keyCount: this.trackedKeys.size,
        provider: this.providerType,
      };
    }
  }

  async healthCheck(): Promise<CacheHealthCheck> {
    const startTime = Date.now();

    try {
      const testKey = this.prefixKey('__health_check__');
      await this.promisify<boolean>((cb) => this.client.set(testKey, 'ok', 1, cb));
      const value = await this.promisify<string>((cb) => this.client.get(testKey, cb));

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
    this.client.end();
    this.trackedKeys.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Redis Cache Adapter
// ═══════════════════════════════════════════════════════════════════════════
// Production-ready Redis adapter with cluster and sentinel support
// ═══════════════════════════════════════════════════════════════════════════

import Redis, { Cluster } from 'ioredis';
import type {
  ICacheProvider,
  CacheSetOptions,
  CacheGetOptions,
  CacheScanOptions,
  CacheScanResult,
  CacheStats,
  CacheHealthCheck,
  RedisCacheConfig,
} from '../interfaces/cache.interface';
import { CacheProviderType } from '../interfaces/cache.interface';

/**
 * Redis cache adapter
 * Supports standalone, cluster, and sentinel modes
 */
export class RedisCacheAdapter implements ICacheProvider {
  readonly providerType: CacheProviderType;

  private readonly client: Redis | Cluster;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;
  private hits = 0;
  private misses = 0;

  constructor(config: RedisCacheConfig) {
    this.providerType = config.provider;
    this.keyPrefix = config.keyPrefix || '';
    this.defaultTtl = config.defaultTtl || 0;

    if (config.cluster && config.clusterNodes) {
      // Cluster mode
      this.client = new Cluster(config.clusterNodes, {
        redisOptions: {
          password: config.password,
          db: config.db,
          connectTimeout: config.connectTimeout,
          tls: config.tls ? {} : undefined,
        },
      });
    } else if (config.sentinel) {
      // Sentinel mode
      this.client = new Redis({
        sentinels: config.sentinel.sentinels,
        name: config.sentinel.name,
        password: config.password,
        db: config.db,
        connectTimeout: config.connectTimeout,
        tls: config.tls ? {} : undefined,
      });
    } else {
      // Standalone mode
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        connectTimeout: config.connectTimeout,
        tls: config.tls ? {} : undefined,
        lazyConnect: true,
      });
    }
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

  private tagKey(tag: string): string {
    return this.prefixKey(`__tag__:${tag}`);
  }

  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  private deserialize<T>(value: string | null): T | null {
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  async get<T = unknown>(key: string, options?: CacheGetOptions): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const value = await this.client.get(prefixedKey);

    if (value === null) {
      this.misses++;
      return null;
    }

    this.hits++;

    if (options?.touch) {
      const ttl = await this.client.ttl(prefixedKey);
      if (ttl > 0) {
        await this.client.expire(prefixedKey, ttl);
      }
    }

    return this.deserialize<T>(value);
  }

  async set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const serialized = this.serialize(value);
    const ttl = options?.ttl ?? this.defaultTtl;

    const args: string[] = [];
    if (ttl > 0) {
      args.push('EX', ttl.toString());
    }
    if (options?.nx) {
      args.push('NX');
    }
    if (options?.xx) {
      args.push('XX');
    }

    const result = await this.client.set(prefixedKey, serialized, ...args);

    if (result === 'OK' && options?.tags) {
      // Add key to tag sets
      for (const tag of options.tags) {
        await this.client.sadd(this.tagKey(tag), prefixedKey);
      }
    }

    return result === 'OK';
  }

  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const result = await this.client.del(prefixedKey);
    return result > 0;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(this.prefixKey(key));
    return result > 0;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(this.prefixKey(key));
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.client.expire(this.prefixKey(key), ttl);
    return result === 1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Batch Operations
  // ═══════════════════════════════════════════════════════════════════════

  async mget<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    if (keys.length === 0) return new Map();

    const prefixedKeys = keys.map(k => this.prefixKey(k));
    const values = await this.client.mget(...prefixedKeys);

    const result = new Map<string, T | null>();
    keys.forEach((key, index) => {
      const value = values[index];
      if (value === null) {
        this.misses++;
        result.set(key, null);
      } else {
        this.hits++;
        result.set(key, this.deserialize<T>(value));
      }
    });

    return result;
  }

  async mset<T = unknown>(entries: Map<string, T>, options?: CacheSetOptions): Promise<boolean> {
    if (entries.size === 0) return true;

    const pipeline = this.client.pipeline();
    const ttl = options?.ttl ?? this.defaultTtl;

    for (const [key, value] of entries) {
      const prefixedKey = this.prefixKey(key);
      const serialized = this.serialize(value);

      if (ttl > 0) {
        pipeline.setex(prefixedKey, ttl, serialized);
      } else {
        pipeline.set(prefixedKey, serialized);
      }

      if (options?.tags) {
        for (const tag of options.tags) {
          pipeline.sadd(this.tagKey(tag), prefixedKey);
        }
      }
    }

    await pipeline.exec();
    return true;
  }

  async mdelete(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const prefixedKeys = keys.map(k => this.prefixKey(k));
    return this.client.del(...prefixedKeys);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Pattern Operations
  // ═══════════════════════════════════════════════════════════════════════

  async keys(pattern: string): Promise<string[]> {
    const prefixedPattern = this.prefixKey(pattern);
    const keys = await this.client.keys(prefixedPattern);
    return keys.map(k => this.unprefixKey(k));
  }

  async scan(options?: CacheScanOptions): Promise<CacheScanResult> {
    const pattern = this.prefixKey(options?.pattern || '*');
    const count = options?.count || 100;
    const cursor = options?.cursor || '0';

    const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', count);

    return {
      keys: keys.map(k => this.unprefixKey(k)),
      cursor: nextCursor,
      hasMore: nextCursor !== '0',
    };
  }

  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    if (keys.length === 0) return 0;
    return this.mdelete(keys);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tag Operations
  // ═══════════════════════════════════════════════════════════════════════

  async invalidateTag(tag: string): Promise<number> {
    const tagSetKey = this.tagKey(tag);
    const keys = await this.client.smembers(tagSetKey);

    if (keys.length === 0) return 0;

    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }
    pipeline.del(tagSetKey);

    await pipeline.exec();
    return keys.length;
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
    const prefixedKey = this.prefixKey(key);
    if (delta === 1) {
      return this.client.incr(prefixedKey);
    }
    return this.client.incrby(prefixedKey, delta);
  }

  async decrement(key: string, delta: number = 1): Promise<number> {
    const prefixedKey = this.prefixKey(key);
    if (delta === 1) {
      return this.client.decr(prefixedKey);
    }
    return this.client.decrby(prefixedKey, delta);
  }

  async getDelete<T = unknown>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const value = await this.client.getdel(prefixedKey);
    return this.deserialize<T>(value);
  }

  async getSet<T = unknown>(key: string, value: T): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const oldValue = await this.client.getset(prefixedKey, this.serialize(value));
    return this.deserialize<T>(oldValue);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Hash Operations
  // ═══════════════════════════════════════════════════════════════════════

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(this.prefixKey(key), field);
    return this.deserialize<T>(value);
  }

  async hset<T = unknown>(key: string, field: string, value: T): Promise<boolean> {
    const result = await this.client.hset(this.prefixKey(key), field, this.serialize(value));
    return result === 1;
  }

  async hgetall<T = unknown>(key: string): Promise<Map<string, T>> {
    const hash = await this.client.hgetall(this.prefixKey(key));
    const result = new Map<string, T>();
    for (const [field, value] of Object.entries(hash)) {
      result.set(field, this.deserialize<T>(value)!);
    }
    return result;
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const result = await this.client.hdel(this.prefixKey(key), field);
    return result === 1;
  }

  async hexists(key: string, field: string): Promise<boolean> {
    const result = await this.client.hexists(this.prefixKey(key), field);
    return result === 1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // List Operations
  // ═══════════════════════════════════════════════════════════════════════

  async rpush<T = unknown>(key: string, value: T): Promise<number> {
    return this.client.rpush(this.prefixKey(key), this.serialize(value));
  }

  async lpush<T = unknown>(key: string, value: T): Promise<number> {
    return this.client.lpush(this.prefixKey(key), this.serialize(value));
  }

  async rpop<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.rpop(this.prefixKey(key));
    return this.deserialize<T>(value);
  }

  async lpop<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.lpop(this.prefixKey(key));
    return this.deserialize<T>(value);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(this.prefixKey(key));
  }

  async lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.client.lrange(this.prefixKey(key), start, stop);
    return values.map(v => this.deserialize<T>(v)!);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Set Operations
  // ═══════════════════════════════════════════════════════════════════════

  async sadd<T = unknown>(key: string, member: T): Promise<boolean> {
    const result = await this.client.sadd(this.prefixKey(key), this.serialize(member));
    return result === 1;
  }

  async srem<T = unknown>(key: string, member: T): Promise<boolean> {
    const result = await this.client.srem(this.prefixKey(key), this.serialize(member));
    return result === 1;
  }

  async sismember<T = unknown>(key: string, member: T): Promise<boolean> {
    const result = await this.client.sismember(this.prefixKey(key), this.serialize(member));
    return result === 1;
  }

  async smembers<T = unknown>(key: string): Promise<T[]> {
    const members = await this.client.smembers(this.prefixKey(key));
    return members.map(m => this.deserialize<T>(m)!);
  }

  async scard(key: string): Promise<number> {
    return this.client.scard(this.prefixKey(key));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Operations
  // ═══════════════════════════════════════════════════════════════════════

  async clear(): Promise<boolean> {
    if (this.keyPrefix) {
      // Only clear keys with our prefix
      const keys = await this.keys('*');
      if (keys.length > 0) {
        await this.mdelete(keys);
      }
    } else {
      await this.client.flushdb();
    }
    this.hits = 0;
    this.misses = 0;
    return true;
  }

  async stats(): Promise<CacheStats> {
    const info = await this.client.info('stats');
    const memory = await this.client.info('memory');
    const keyspace = await this.client.info('keyspace');

    // Parse Redis INFO output
    const parseInfo = (text: string, key: string): string | undefined => {
      const match = text.match(new RegExp(`${key}:([^\\r\\n]+)`));
      return match?.[1];
    };

    const keyspaceHits = parseInt(parseInfo(info, 'keyspace_hits') || '0', 10);
    const keyspaceMisses = parseInt(parseInfo(info, 'keyspace_misses') || '0', 10);
    const usedMemory = parseInt(parseInfo(memory, 'used_memory') || '0', 10);
    const uptimeSeconds = parseInt(parseInfo(info, 'uptime_in_seconds') || '0', 10);

    // Count keys in current db
    let keyCount = 0;
    const dbMatch = keyspace.match(/db\d+:keys=(\d+)/);
    if (dbMatch) {
      keyCount = parseInt(dbMatch[1], 10);
    }

    const total = keyspaceHits + keyspaceMisses;

    return {
      hits: this.hits || keyspaceHits,
      misses: this.misses || keyspaceMisses,
      hitRate: total > 0 ? (keyspaceHits / total) * 100 : 0,
      keyCount,
      memoryUsage: usedMemory,
      provider: this.providerType,
      uptime: uptimeSeconds,
    };
  }

  async healthCheck(): Promise<CacheHealthCheck> {
    const startTime = Date.now();

    try {
      const result = await this.client.ping();

      return {
        healthy: result === 'PONG',
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
    await this.client.quit();
  }

  getClient(): Redis | Cluster {
    return this.client;
  }
}

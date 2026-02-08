// ═══════════════════════════════════════════════════════════════════════════
// Redis Cluster Cache Adapter
// ═══════════════════════════════════════════════════════════════════════════
// High-availability Redis Cluster adapter with automatic failover
// ═══════════════════════════════════════════════════════════════════════════

import { Cluster, ClusterNode, ClusterOptions } from 'ioredis';
import type {
  ICacheProvider,
  CacheSetOptions,
  CacheGetOptions,
  CacheScanOptions,
  CacheScanResult,
  CacheStats,
  CacheHealthCheck,
  CacheConfigBase,
} from '../interfaces/cache.interface';
import { CacheProviderType } from '../interfaces/cache.interface';
import type { IPubSubProvider, PubSubSubscription, PubSubMessageHandler, CacheHealth, CacheHealthMetrics } from '../interfaces/pubsub.interface';

/**
 * Redis Cluster configuration
 */
export interface RedisClusterConfig extends CacheConfigBase {
  provider: CacheProviderType.REDIS;
  /** Cluster nodes */
  nodes: ClusterNode[];
  /** Redis password */
  password?: string;
  /** Enable TLS */
  tls?: boolean;
  /** Connection timeout in ms */
  connectTimeout?: number;
  /** Max redirections for MOVED/ASK */
  maxRedirections?: number;
  /** Retry delay for failed nodes */
  retryDelayOnFailover?: number;
  /** Scale reads to slaves */
  scaleReads?: 'master' | 'slave' | 'all';
  /** Enable read-only mode for slaves */
  enableReadyCheck?: boolean;
}

/**
 * Redis Cluster cache adapter with Pub/Sub support
 */
export class RedisClusterAdapter implements ICacheProvider, IPubSubProvider {
  readonly providerType = CacheProviderType.REDIS;

  private readonly cluster: Cluster;
  private readonly subscriber: Cluster;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;
  private hits = 0;
  private misses = 0;

  private readonly subscriptions: Map<string, PubSubSubscription> = new Map();
  private readonly handlers: Map<string, Set<PubSubMessageHandler>> = new Map();
  private subscriptionCounter = 0;

  constructor(config: RedisClusterConfig) {
    this.keyPrefix = config.keyPrefix || '';
    this.defaultTtl = config.defaultTtl || 0;

    const clusterOptions: ClusterOptions = {
      redisOptions: {
        password: config.password,
        connectTimeout: config.connectTimeout || 10000,
        tls: config.tls ? {} : undefined,
      },
      maxRedirections: config.maxRedirections || 16,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      scaleReads: config.scaleReads || 'master',
      enableReadyCheck: config.enableReadyCheck ?? true,
      lazyConnect: true,
    };

    this.cluster = new Cluster(config.nodes, clusterOptions);
    
    // Separate connection for subscriptions
    this.subscriber = new Cluster(config.nodes, {
      ...clusterOptions,
      lazyConnect: true,
    });

    this.setupSubscriberHandlers();
  }

  private setupSubscriberHandlers(): void {
    this.subscriber.on('message', (channel: string, message: string) => {
      const handlers = this.handlers.get(channel);
      if (handlers) {
        const parsed = this.deserialize(message);
        handlers.forEach(handler => handler(parsed, channel));
      }
    });

    this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      const handlers = this.handlers.get(`pattern:${pattern}`);
      if (handlers) {
        const parsed = this.deserialize(message);
        handlers.forEach(handler => handler(parsed, channel));
      }
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
    const value = await this.cluster.get(prefixedKey);

    if (value === null) {
      this.misses++;
      return null;
    }

    this.hits++;

    if (options?.touch) {
      const ttl = await this.cluster.ttl(prefixedKey);
      if (ttl > 0) {
        await this.cluster.expire(prefixedKey, ttl);
      }
    }

    return this.deserialize<T>(value);
  }

  async set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const serialized = this.serialize(value);
    const ttl = options?.ttl ?? this.defaultTtl;

    const args: string[] = [];
    if (ttl > 0) args.push('EX', ttl.toString());
    if (options?.nx) args.push('NX');
    if (options?.xx) args.push('XX');

    const result = await this.cluster.set(prefixedKey, serialized, ...args);

    if (result === 'OK' && options?.tags) {
      for (const tag of options.tags) {
        await this.cluster.sadd(this.tagKey(tag), prefixedKey);
      }
    }

    return result === 'OK';
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.cluster.del(this.prefixKey(key));
    return result > 0;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.cluster.exists(this.prefixKey(key));
    return result > 0;
  }

  async ttl(key: string): Promise<number> {
    return this.cluster.ttl(this.prefixKey(key));
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.cluster.expire(this.prefixKey(key), ttl);
    return result === 1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Batch Operations
  // ═══════════════════════════════════════════════════════════════════════

  async mget<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    if (keys.length === 0) return new Map();

    const result = new Map<string, T | null>();
    
    // Cluster mget requires keys on same slot, use pipeline instead
    const pipeline = this.cluster.pipeline();
    const prefixedKeys = keys.map(k => this.prefixKey(k));
    
    for (const key of prefixedKeys) {
      pipeline.get(key);
    }

    const values = await pipeline.exec();

    keys.forEach((key, index) => {
      const [err, value] = values?.[index] || [null, null];
      if (err || value === null) {
        this.misses++;
        result.set(key, null);
      } else {
        this.hits++;
        result.set(key, this.deserialize<T>(value as string));
      }
    });

    return result;
  }

  async mset<T = unknown>(entries: Map<string, T>, options?: CacheSetOptions): Promise<boolean> {
    if (entries.size === 0) return true;

    const pipeline = this.cluster.pipeline();
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
    
    const pipeline = this.cluster.pipeline();
    for (const key of keys) {
      pipeline.del(this.prefixKey(key));
    }
    
    const results = await pipeline.exec();
    return results?.filter(([err, val]) => !err && val === 1).length || 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Pattern Operations
  // ═══════════════════════════════════════════════════════════════════════

  async keys(pattern: string): Promise<string[]> {
    const prefixedPattern = this.prefixKey(pattern);
    const allKeys: string[] = [];

    // Scan all master nodes in cluster
    const nodes = this.cluster.nodes('master');
    
    for (const node of nodes) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await node.scan(cursor, 'MATCH', prefixedPattern, 'COUNT', 100);
        cursor = nextCursor;
        allKeys.push(...keys.map(k => this.unprefixKey(k)));
      } while (cursor !== '0');
    }

    return [...new Set(allKeys)]; // Dedupe
  }

  async scan(options?: CacheScanOptions): Promise<CacheScanResult> {
    // For cluster, scan is complex - use keys with limit
    const pattern = options?.pattern || '*';
    const count = options?.count || 100;
    
    const allKeys = await this.keys(pattern);
    const cursor = parseInt(options?.cursor || '0', 10);
    const end = Math.min(cursor + count, allKeys.length);

    return {
      keys: allKeys.slice(cursor, end),
      cursor: end.toString(),
      hasMore: end < allKeys.length,
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
    const keys = await this.cluster.smembers(tagSetKey);

    if (keys.length === 0) return 0;

    const pipeline = this.cluster.pipeline();
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
    if (delta === 1) return this.cluster.incr(prefixedKey);
    return this.cluster.incrby(prefixedKey, delta);
  }

  async decrement(key: string, delta: number = 1): Promise<number> {
    const prefixedKey = this.prefixKey(key);
    if (delta === 1) return this.cluster.decr(prefixedKey);
    return this.cluster.decrby(prefixedKey, delta);
  }

  async getDelete<T = unknown>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const value = await this.cluster.getdel(prefixedKey);
    return this.deserialize<T>(value);
  }

  async getSet<T = unknown>(key: string, value: T): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const oldValue = await this.cluster.getset(prefixedKey, this.serialize(value));
    return this.deserialize<T>(oldValue);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Hash Operations
  // ═══════════════════════════════════════════════════════════════════════

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const value = await this.cluster.hget(this.prefixKey(key), field);
    return this.deserialize<T>(value);
  }

  async hset<T = unknown>(key: string, field: string, value: T): Promise<boolean> {
    const result = await this.cluster.hset(this.prefixKey(key), field, this.serialize(value));
    return result === 1;
  }

  async hgetall<T = unknown>(key: string): Promise<Map<string, T>> {
    const hash = await this.cluster.hgetall(this.prefixKey(key));
    const result = new Map<string, T>();
    for (const [field, value] of Object.entries(hash)) {
      result.set(field, this.deserialize<T>(value)!);
    }
    return result;
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const result = await this.cluster.hdel(this.prefixKey(key), field);
    return result === 1;
  }

  async hexists(key: string, field: string): Promise<boolean> {
    const result = await this.cluster.hexists(this.prefixKey(key), field);
    return result === 1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // List Operations
  // ═══════════════════════════════════════════════════════════════════════

  async rpush<T = unknown>(key: string, value: T): Promise<number> {
    return this.cluster.rpush(this.prefixKey(key), this.serialize(value));
  }

  async lpush<T = unknown>(key: string, value: T): Promise<number> {
    return this.cluster.lpush(this.prefixKey(key), this.serialize(value));
  }

  async rpop<T = unknown>(key: string): Promise<T | null> {
    const value = await this.cluster.rpop(this.prefixKey(key));
    return this.deserialize<T>(value);
  }

  async lpop<T = unknown>(key: string): Promise<T | null> {
    const value = await this.cluster.lpop(this.prefixKey(key));
    return this.deserialize<T>(value);
  }

  async llen(key: string): Promise<number> {
    return this.cluster.llen(this.prefixKey(key));
  }

  async lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.cluster.lrange(this.prefixKey(key), start, stop);
    return values.map(v => this.deserialize<T>(v)!);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Set Operations
  // ═══════════════════════════════════════════════════════════════════════

  async sadd<T = unknown>(key: string, member: T): Promise<boolean> {
    const result = await this.cluster.sadd(this.prefixKey(key), this.serialize(member));
    return result === 1;
  }

  async srem<T = unknown>(key: string, member: T): Promise<boolean> {
    const result = await this.cluster.srem(this.prefixKey(key), this.serialize(member));
    return result === 1;
  }

  async sismember<T = unknown>(key: string, member: T): Promise<boolean> {
    const result = await this.cluster.sismember(this.prefixKey(key), this.serialize(member));
    return result === 1;
  }

  async smembers<T = unknown>(key: string): Promise<T[]> {
    const members = await this.cluster.smembers(this.prefixKey(key));
    return members.map(m => this.deserialize<T>(m)!);
  }

  async scard(key: string): Promise<number> {
    return this.cluster.scard(this.prefixKey(key));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Pub/Sub Operations
  // ═══════════════════════════════════════════════════════════════════════

  async publish<T = unknown>(channel: string, message: T): Promise<number> {
    return this.cluster.publish(channel, this.serialize(message));
  }

  async subscribe<T = unknown>(
    channel: string,
    handler: PubSubMessageHandler<T>
  ): Promise<PubSubSubscription> {
    const id = `sub_${++this.subscriptionCounter}`;

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }

    this.handlers.get(channel)!.add(handler as PubSubMessageHandler);

    const subscription: PubSubSubscription = {
      id,
      channel,
      unsubscribe: async () => {
        const handlers = this.handlers.get(channel);
        if (handlers) {
          handlers.delete(handler as PubSubMessageHandler);
          if (handlers.size === 0) {
            this.handlers.delete(channel);
            await this.subscriber.unsubscribe(channel);
          }
        }
        this.subscriptions.delete(id);
      },
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async psubscribe<T = unknown>(
    pattern: string,
    handler: PubSubMessageHandler<T>
  ): Promise<PubSubSubscription> {
    const id = `psub_${++this.subscriptionCounter}`;
    const handlerKey = `pattern:${pattern}`;

    if (!this.handlers.has(handlerKey)) {
      this.handlers.set(handlerKey, new Set());
      await this.subscriber.psubscribe(pattern);
    }

    this.handlers.get(handlerKey)!.add(handler as PubSubMessageHandler);

    const subscription: PubSubSubscription = {
      id,
      channel: pattern,
      pattern,
      unsubscribe: async () => {
        const handlers = this.handlers.get(handlerKey);
        if (handlers) {
          handlers.delete(handler as PubSubMessageHandler);
          if (handlers.size === 0) {
            this.handlers.delete(handlerKey);
            await this.subscriber.punsubscribe(pattern);
          }
        }
        this.subscriptions.delete(id);
      },
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  async punsubscribe(pattern: string): Promise<void> {
    this.handlers.delete(`pattern:${pattern}`);
    await this.subscriber.punsubscribe(pattern);
  }

  getSubscriptions(): PubSubSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  async closeAll(): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      await sub.unsubscribe();
    }
    this.subscriptions.clear();
    this.handlers.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Operations
  // ═══════════════════════════════════════════════════════════════════════

  async clear(): Promise<boolean> {
    if (this.keyPrefix) {
      const keys = await this.keys('*');
      if (keys.length > 0) {
        await this.mdelete(keys);
      }
    } else {
      // Flush all nodes
      const nodes = this.cluster.nodes('master');
      for (const node of nodes) {
        await node.flushdb();
      }
    }
    this.hits = 0;
    this.misses = 0;
    return true;
  }

  async stats(): Promise<CacheStats> {
    const nodes = this.cluster.nodes('master');
    let totalKeys = 0;
    let totalMemory = 0;
    let totalHits = 0;
    let totalMisses = 0;

    for (const node of nodes) {
      const info = await node.info('stats');
      const memory = await node.info('memory');
      const keyspace = await node.info('keyspace');

      const parseInfo = (text: string, key: string): string | undefined => {
        const match = text.match(new RegExp(`${key}:([^\\r\\n]+)`));
        return match?.[1];
      };

      totalHits += parseInt(parseInfo(info, 'keyspace_hits') || '0', 10);
      totalMisses += parseInt(parseInfo(info, 'keyspace_misses') || '0', 10);
      totalMemory += parseInt(parseInfo(memory, 'used_memory') || '0', 10);

      const dbMatch = keyspace.match(/db\d+:keys=(\d+)/);
      if (dbMatch) {
        totalKeys += parseInt(dbMatch[1], 10);
      }
    }

    const total = totalHits + totalMisses;

    return {
      hits: this.hits || totalHits,
      misses: this.misses || totalMisses,
      hitRate: total > 0 ? (totalHits / total) * 100 : 0,
      keyCount: totalKeys,
      memoryUsage: totalMemory,
      provider: this.providerType,
    };
  }

  async healthCheck(): Promise<CacheHealthCheck> {
    const startTime = Date.now();

    try {
      const nodes = this.cluster.nodes('master');
      const results = await Promise.all(nodes.map(node => node.ping()));
      const allHealthy = results.every(r => r === 'PONG');

      return {
        healthy: allHealthy,
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

  /**
   * Extended health check with detailed metrics
   */
  async health(): Promise<CacheHealth> {
    const startTime = Date.now();

    try {
      const nodes = this.cluster.nodes('master');
      const slaveNodes = this.cluster.nodes('slave');
      
      let totalMemory = 0;
      let peakMemory = 0;
      let totalKeys = 0;
      let totalExpires = 0;
      let opsPerSecond = 0;

      for (const node of nodes) {
        const memory = await node.info('memory');
        const stats = await node.info('stats');
        const keyspace = await node.info('keyspace');

        const parseInfo = (text: string, key: string): number => {
          const match = text.match(new RegExp(`${key}:([^\\r\\n]+)`));
          return parseInt(match?.[1] || '0', 10);
        };

        totalMemory += parseInfo(memory, 'used_memory');
        peakMemory += parseInfo(memory, 'used_memory_peak');
        opsPerSecond += parseInfo(stats, 'instantaneous_ops_per_sec');

        const dbMatch = keyspace.match(/db\d+:keys=(\d+),expires=(\d+)/);
        if (dbMatch) {
          totalKeys += parseInt(dbMatch[1], 10);
          totalExpires += parseInt(dbMatch[2], 10);
        }
      }

      const clusterInfo = await this.cluster.cluster('INFO');
      const slotsOk = (clusterInfo.match(/cluster_slots_ok:(\d+)/)?.[1]) || '0';
      const slotsFail = (clusterInfo.match(/cluster_slots_fail:(\d+)/)?.[1]) || '0';

      const metrics: CacheHealthMetrics = {
        connections: {
          active: nodes.length,
          idle: 0,
          total: nodes.length + slaveNodes.length,
        },
        memory: {
          used: totalMemory,
          peak: peakMemory,
        },
        cluster: {
          enabled: true,
          nodes: nodes.length + slaveNodes.length,
          slotsOk: parseInt(slotsOk, 10),
          slotsFail: parseInt(slotsFail, 10),
        },
        opsPerSecond,
        keyspace: {
          keys: totalKeys,
          expires: totalExpires,
        },
      };

      return {
        healthy: true,
        provider: 'redis-cluster',
        latencyMs: Date.now() - startTime,
        timestamp: new Date(),
        metrics,
      };
    } catch (error) {
      return {
        healthy: false,
        provider: 'redis-cluster',
        latencyMs: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date(),
        metrics: {},
      };
    }
  }

  async close(): Promise<void> {
    await this.closeAll();
    await this.subscriber.quit();
    await this.cluster.quit();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cloudflare KV Cache Adapter
// ═══════════════════════════════════════════════════════════════════════════
// Edge-compatible KV storage adapter for Cloudflare Workers
// ═══════════════════════════════════════════════════════════════════════════

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

/**
 * Cloudflare KV configuration
 */
export interface CloudflareKVConfig extends CacheConfigBase {
  provider: CacheProviderType;
  /** Cloudflare Account ID */
  accountId: string;
  /** KV Namespace ID */
  namespaceId: string;
  /** API Token with KV permissions */
  apiToken: string;
  /** Base URL for API (optional, for testing) */
  baseUrl?: string;
}

/**
 * Cloudflare KV API response types
 */
interface KVListResponse {
  result: Array<{ name: string; expiration?: number }>;
  result_info: { cursor?: string; count: number };
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

interface KVBulkResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

/**
 * Cloudflare KV cache adapter
 * Uses Cloudflare's REST API for KV operations
 */
export class CloudflareKVAdapter implements ICacheProvider {
  readonly providerType = CacheProviderType.MEMORY; // Closest match

  private readonly accountId: string;
  private readonly namespaceId: string;
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;
  private hits = 0;
  private misses = 0;
  private readonly startTime = Date.now();

  // Tag index stored in KV itself
  private readonly tagIndexPrefix = '__tag_index__:';

  constructor(config: CloudflareKVConfig) {
    this.accountId = config.accountId;
    this.namespaceId = config.namespaceId;
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || 'https://api.cloudflare.com/client/v4';
    this.keyPrefix = config.keyPrefix || '';
    this.defaultTtl = config.defaultTtl || 0;
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

  private get apiBase(): string {
    return `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Cloudflare KV API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  async get<T = unknown>(key: string, _options?: CacheGetOptions): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    
    try {
      const response = await fetch(`${this.apiBase}/values/${encodeURIComponent(prefixedKey)}`, {
        headers: { 'Authorization': `Bearer ${this.apiToken}` },
      });

      if (response.status === 404) {
        this.misses++;
        return null;
      }

      if (!response.ok) {
        throw new Error(`KV get error: ${response.status}`);
      }

      this.hits++;
      const text = await response.text();
      
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } catch {
      this.misses++;
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const ttl = options?.ttl ?? this.defaultTtl;

    // Handle NX/XX conditions
    if (options?.nx || options?.xx) {
      const exists = await this.exists(key);
      if (options.nx && exists) return false;
      if (options.xx && !exists) return false;
    }

    const params = new URLSearchParams();
    if (ttl > 0) {
      params.set('expiration_ttl', ttl.toString());
    }

    const url = `${this.apiBase}/values/${encodeURIComponent(prefixedKey)}${params.toString() ? '?' + params : ''}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(value),
    });

    if (response.ok && options?.tags) {
      await this.addToTagIndex(prefixedKey, options.tags);
    }

    return response.ok;
  }

  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    
    const response = await fetch(`${this.apiBase}/values/${encodeURIComponent(prefixedKey)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.apiToken}` },
    });

    return response.ok;
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async ttl(_key: string): Promise<number> {
    // Cloudflare KV doesn't expose TTL via API
    return -1;
  }

  async expire(_key: string, _ttl: number): Promise<boolean> {
    // Cloudflare KV doesn't support updating TTL without re-setting
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tag Index Management
  // ═══════════════════════════════════════════════════════════════════════

  private async addToTagIndex(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.tagIndexPrefix}${tag}`;
      const existing = await this.get<string[]>(tagKey) || [];
      if (!existing.includes(key)) {
        existing.push(key);
        await this.set(tagKey, existing);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Batch Operations
  // ═══════════════════════════════════════════════════════════════════════

  async mget<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    
    // Cloudflare KV doesn't have native mget, parallel fetch
    await Promise.all(
      keys.map(async (key) => {
        result.set(key, await this.get<T>(key));
      })
    );

    return result;
  }

  async mset<T = unknown>(entries: Map<string, T>, options?: CacheSetOptions): Promise<boolean> {
    const ttl = options?.ttl ?? this.defaultTtl;
    
    const bulkData = Array.from(entries).map(([key, value]) => ({
      key: this.prefixKey(key),
      value: JSON.stringify(value),
      ...(ttl > 0 ? { expiration_ttl: ttl } : {}),
    }));

    const response = await this.request<KVBulkResponse>('/bulk', {
      method: 'PUT',
      body: JSON.stringify(bulkData),
    });

    return response.success;
  }

  async mdelete(keys: string[]): Promise<number> {
    const prefixedKeys = keys.map(k => this.prefixKey(k));
    
    const response = await this.request<KVBulkResponse>('/bulk', {
      method: 'DELETE',
      body: JSON.stringify(prefixedKeys),
    });

    return response.success ? keys.length : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Pattern Operations
  // ═══════════════════════════════════════════════════════════════════════

  async keys(pattern: string): Promise<string[]> {
    const prefixedPattern = this.prefixKey(pattern);
    const allKeys: string[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (prefixedPattern !== '*') {
        params.set('prefix', prefixedPattern.replace(/\*/g, ''));
      }

      const response = await this.request<KVListResponse>(`/keys?${params}`);
      
      for (const item of response.result) {
        if (this.matchPattern(item.name, prefixedPattern)) {
          allKeys.push(this.unprefixKey(item.name));
        }
      }

      cursor = response.result_info.cursor;
    } while (cursor);

    return allKeys;
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(key);
  }

  async scan(options?: CacheScanOptions): Promise<CacheScanResult> {
    const pattern = options?.pattern || '*';
    const count = options?.count || 100;
    const cursor = options?.cursor || '';

    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', count.toString());
    
    const prefixedPattern = this.prefixKey(pattern);
    if (prefixedPattern !== '*') {
      params.set('prefix', prefixedPattern.replace(/\*/g, ''));
    }

    const response = await this.request<KVListResponse>(`/keys?${params}`);

    return {
      keys: response.result.map(item => this.unprefixKey(item.name)),
      cursor: response.result_info.cursor || '',
      hasMore: !!response.result_info.cursor,
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
    const tagKey = `${this.tagIndexPrefix}${tag}`;
    const keys = await this.get<string[]>(tagKey);
    
    if (!keys || keys.length === 0) return 0;

    await this.mdelete(keys.map(k => this.unprefixKey(k)));
    await this.delete(tagKey);
    
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
  // Atomic Operations (Simulated - KV doesn't support true atomics)
  // ═══════════════════════════════════════════════════════════════════════

  async increment(key: string, delta: number = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + delta;
    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, delta: number = 1): Promise<number> {
    return this.increment(key, -delta);
  }

  async getDelete<T = unknown>(key: string): Promise<T | null> {
    const value = await this.get<T>(key);
    if (value !== null) {
      await this.delete(key);
    }
    return value;
  }

  async getSet<T = unknown>(key: string, value: T): Promise<T | null> {
    const oldValue = await this.get<T>(key);
    await this.set(key, value);
    return oldValue;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Hash Operations (Simulated using JSON)
  // ═══════════════════════════════════════════════════════════════════════

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const hash = await this.get<Record<string, T>>(key);
    return hash?.[field] ?? null;
  }

  async hset<T = unknown>(key: string, field: string, value: T): Promise<boolean> {
    const hash = await this.get<Record<string, T>>(key) || {};
    const isNew = !(field in hash);
    hash[field] = value;
    await this.set(key, hash);
    return isNew;
  }

  async hgetall<T = unknown>(key: string): Promise<Map<string, T>> {
    const hash = await this.get<Record<string, T>>(key) || {};
    return new Map(Object.entries(hash));
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const hash = await this.get<Record<string, unknown>>(key);
    if (!hash || !(field in hash)) return false;
    delete hash[field];
    await this.set(key, hash);
    return true;
  }

  async hexists(key: string, field: string): Promise<boolean> {
    const hash = await this.get<Record<string, unknown>>(key);
    return hash ? field in hash : false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // List Operations (Simulated using arrays)
  // ═══════════════════════════════════════════════════════════════════════

  async rpush<T = unknown>(key: string, value: T): Promise<number> {
    const list = await this.get<T[]>(key) || [];
    list.push(value);
    await this.set(key, list);
    return list.length;
  }

  async lpush<T = unknown>(key: string, value: T): Promise<number> {
    const list = await this.get<T[]>(key) || [];
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
  // Set Operations (Simulated using arrays with dedup)
  // ═══════════════════════════════════════════════════════════════════════

  async sadd<T = unknown>(key: string, member: T): Promise<boolean> {
    const set = await this.get<T[]>(key) || [];
    const serialized = JSON.stringify(member);
    const exists = set.some(m => JSON.stringify(m) === serialized);
    if (exists) return false;
    set.push(member);
    await this.set(key, set);
    return true;
  }

  async srem<T = unknown>(key: string, member: T): Promise<boolean> {
    const set = await this.get<T[]>(key);
    if (!set) return false;
    const serialized = JSON.stringify(member);
    const index = set.findIndex(m => JSON.stringify(m) === serialized);
    if (index === -1) return false;
    set.splice(index, 1);
    await this.set(key, set);
    return true;
  }

  async sismember<T = unknown>(key: string, member: T): Promise<boolean> {
    const set = await this.get<T[]>(key);
    if (!set) return false;
    const serialized = JSON.stringify(member);
    return set.some(m => JSON.stringify(m) === serialized);
  }

  async smembers<T = unknown>(key: string): Promise<T[]> {
    return await this.get<T[]>(key) || [];
  }

  async scard(key: string): Promise<number> {
    const set = await this.get<unknown[]>(key);
    return set?.length ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Operations
  // ═══════════════════════════════════════════════════════════════════════

  async clear(): Promise<boolean> {
    const keys = await this.keys('*');
    if (keys.length > 0) {
      await this.mdelete(keys);
    }
    this.hits = 0;
    this.misses = 0;
    return true;
  }

  async stats(): Promise<CacheStats> {
    const keys = await this.keys('*');
    const total = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      keyCount: keys.length,
      provider: this.providerType,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  async healthCheck(): Promise<CacheHealthCheck> {
    const startTime = Date.now();

    try {
      // Test with a simple list operation
      await this.request<KVListResponse>('/keys?limit=1');

      return {
        healthy: true,
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
    // No persistent connection to close
  }
}

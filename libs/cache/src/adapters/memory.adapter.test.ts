// ═══════════════════════════════════════════════════════════════════════════
// Memory Cache Adapter Tests
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CacheProviderType } from '../interfaces/cache.interface';
import { MemoryCacheAdapter } from './memory.adapter';

describe('MemoryCacheAdapter', () => {
  let cache: MemoryCacheAdapter;

  beforeEach(() => {
    cache = new MemoryCacheAdapter({
      provider: CacheProviderType.MEMORY,
      keyPrefix: 'test',
      defaultTtl: 60,
      maxItems: 1000,
    });
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('constructor', () => {
    it('should create adapter with correct provider type', () => {
      expect(cache.providerType).toBe(CacheProviderType.MEMORY);
    });
  });

  describe('basic operations', () => {
    it('should set and get a value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);
      expect(await cache.get('key1')).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.exists('key1')).toBe(true);
      expect(await cache.exists('non-existent')).toBe(false);
    });

    it('should handle complex objects', async () => {
      const obj = { name: 'test', nested: { value: 123 } };
      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');
      expect(result).toEqual(obj);
    });

    it('should respect NX option (only set if not exists)', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.set('key1', 'value2', { nx: true });
      expect(result).toBe(false);
      expect(await cache.get('key1')).toBe('value1');
    });

    it('should respect XX option (only set if exists)', async () => {
      const result = await cache.set('new-key', 'value', { xx: true });
      expect(result).toBe(false);
      expect(await cache.get('new-key')).toBeNull();
    });
  });

  describe('TTL operations', () => {
    it('should expire key after TTL', async () => {
      await cache.set('ttl-key', 'value', { ttl: 1 });
      expect(await cache.get('ttl-key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(await cache.get('ttl-key')).toBeNull();
    });

    it('should return TTL for key', async () => {
      await cache.set('ttl-key', 'value', { ttl: 60 });
      const ttl = await cache.ttl('ttl-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should return -2 for non-existent key TTL', async () => {
      const ttl = await cache.ttl('non-existent');
      expect(ttl).toBe(-2);
    });

    it('should update TTL with expire', async () => {
      await cache.set('key1', 'value', { ttl: 10 });
      await cache.expire('key1', 120);
      const ttl = await cache.ttl('key1');
      expect(ttl).toBeGreaterThan(10);
    });
  });

  describe('batch operations', () => {
    it('should get multiple values', async () => {
      await cache.set('k1', 'v1');
      await cache.set('k2', 'v2');

      const result = await cache.mget<string>(['k1', 'k2', 'k3']);
      expect(result.get('k1')).toBe('v1');
      expect(result.get('k2')).toBe('v2');
      expect(result.get('k3')).toBeNull();
    });

    it('should set multiple values', async () => {
      const entries = new Map([
        ['m1', 'v1'],
        ['m2', 'v2'],
      ]);
      await cache.mset(entries);

      expect(await cache.get('m1')).toBe('v1');
      expect(await cache.get('m2')).toBe('v2');
    });

    it('should delete multiple keys', async () => {
      await cache.set('d1', 'v1');
      await cache.set('d2', 'v2');

      const count = await cache.mdelete(['d1', 'd2', 'd3']);
      expect(count).toBe(2);
    });
  });

  describe('pattern operations', () => {
    beforeEach(async () => {
      await cache.set('user:1', 'u1');
      await cache.set('user:2', 'u2');
      await cache.set('product:1', 'p1');
    });

    it('should find keys by pattern', async () => {
      const keys = await cache.keys('user:*');
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('product:1');
    });

    it('should delete keys by pattern', async () => {
      const count = await cache.deletePattern('user:*');
      expect(count).toBe(2);
      expect(await cache.exists('user:1')).toBe(false);
      expect(await cache.exists('product:1')).toBe(true);
    });

    it('should scan keys with pagination', async () => {
      const result = await cache.scan({ pattern: '*', count: 2 });
      expect(result.keys.length).toBeLessThanOrEqual(2);
      expect(typeof result.cursor).toBe('string');
    });
  });

  describe('tag operations', () => {
    it('should invalidate keys by tag', async () => {
      await cache.set('t1', 'v1', { tags: ['group1'] });
      await cache.set('t2', 'v2', { tags: ['group1'] });
      await cache.set('t3', 'v3', { tags: ['group2'] });

      const count = await cache.invalidateTag('group1');
      expect(count).toBe(2);
      expect(await cache.exists('t1')).toBe(false);
      expect(await cache.exists('t2')).toBe(false);
      expect(await cache.exists('t3')).toBe(true);
    });

    it('should invalidate multiple tags', async () => {
      await cache.set('t1', 'v1', { tags: ['g1'] });
      await cache.set('t2', 'v2', { tags: ['g2'] });

      const count = await cache.invalidateTags(['g1', 'g2']);
      expect(count).toBe(2);
    });
  });

  describe('atomic operations', () => {
    it('should increment value', async () => {
      const result1 = await cache.increment('counter');
      expect(result1).toBe(1);

      const result2 = await cache.increment('counter', 5);
      expect(result2).toBe(6);
    });

    it('should decrement value', async () => {
      await cache.set('counter', 10);
      const result = await cache.decrement('counter', 3);
      expect(result).toBe(7);
    });

    it('should get and delete atomically', async () => {
      await cache.set('gd', 'value');
      const result = await cache.getDelete<string>('gd');
      expect(result).toBe('value');
      expect(await cache.exists('gd')).toBe(false);
    });

    it('should get and set atomically', async () => {
      await cache.set('gs', 'old');
      const result = await cache.getSet<string>('gs', 'new');
      expect(result).toBe('old');
      expect(await cache.get('gs')).toBe('new');
    });
  });

  describe('hash operations', () => {
    it('should set and get hash field', async () => {
      await cache.hset('hash1', 'field1', 'value1');
      const result = await cache.hget<string>('hash1', 'field1');
      expect(result).toBe('value1');
    });

    it('should get all hash fields', async () => {
      await cache.hset('hash2', 'f1', 'v1');
      await cache.hset('hash2', 'f2', 'v2');

      const result = await cache.hgetall<string>('hash2');
      expect(result.get('f1')).toBe('v1');
      expect(result.get('f2')).toBe('v2');
    });

    it('should delete hash field', async () => {
      await cache.hset('hash3', 'f1', 'v1');
      const deleted = await cache.hdel('hash3', 'f1');
      expect(deleted).toBe(true);
      expect(await cache.hget('hash3', 'f1')).toBeNull();
    });

    it('should check hash field exists', async () => {
      await cache.hset('hash4', 'f1', 'v1');
      expect(await cache.hexists('hash4', 'f1')).toBe(true);
      expect(await cache.hexists('hash4', 'f2')).toBe(false);
    });
  });

  describe('list operations', () => {
    it('should push and pop from right', async () => {
      await cache.rpush('list1', 'a');
      await cache.rpush('list1', 'b');

      const result = await cache.rpop<string>('list1');
      expect(result).toBe('b');
    });

    it('should push and pop from left', async () => {
      await cache.lpush('list2', 'a');
      await cache.lpush('list2', 'b');

      const result = await cache.lpop<string>('list2');
      expect(result).toBe('b');
    });

    it('should get list length', async () => {
      await cache.rpush('list3', 'a');
      await cache.rpush('list3', 'b');
      await cache.rpush('list3', 'c');

      const len = await cache.llen('list3');
      expect(len).toBe(3);
    });

    it('should get list range', async () => {
      await cache.rpush('list4', 'a');
      await cache.rpush('list4', 'b');
      await cache.rpush('list4', 'c');

      const range = await cache.lrange<string>('list4', 0, 1);
      expect(range).toEqual(['a', 'b']);
    });
  });

  describe('set operations', () => {
    it('should add and check member', async () => {
      const added = await cache.sadd('set1', 'member1');
      expect(added).toBe(true);

      const exists = await cache.sismember('set1', 'member1');
      expect(exists).toBe(true);
    });

    it('should not add duplicate member', async () => {
      await cache.sadd('set2', 'member1');
      const added = await cache.sadd('set2', 'member1');
      expect(added).toBe(false);
    });

    it('should remove member', async () => {
      await cache.sadd('set3', 'member1');
      const removed = await cache.srem('set3', 'member1');
      expect(removed).toBe(true);
      expect(await cache.sismember('set3', 'member1')).toBe(false);
    });

    it('should get all members', async () => {
      await cache.sadd('set4', 'a');
      await cache.sadd('set4', 'b');

      const members = await cache.smembers<string>('set4');
      expect(members).toContain('a');
      expect(members).toContain('b');
    });

    it('should get set cardinality', async () => {
      await cache.sadd('set5', 'a');
      await cache.sadd('set5', 'b');
      await cache.sadd('set5', 'c');

      const card = await cache.scard('set5');
      expect(card).toBe(3);
    });
  });

  describe('utility operations', () => {
    it('should clear all keys', async () => {
      await cache.set('c1', 'v1');
      await cache.set('c2', 'v2');

      await cache.clear();

      expect(await cache.exists('c1')).toBe(false);
      expect(await cache.exists('c2')).toBe(false);
    });

    it('should return stats', async () => {
      await cache.set('s1', 'v1');
      await cache.get('s1');
      await cache.get('non-existent');

      const stats = await cache.stats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.provider).toBe(CacheProviderType.MEMORY);
    });

    it('should pass health check', async () => {
      const health = await cache.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe(CacheProviderType.MEMORY);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});

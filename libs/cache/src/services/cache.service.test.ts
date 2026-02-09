// ═══════════════════════════════════════════════════════════════════════════
// Cache Service Tests
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheAdapter } from '../adapters/memory.adapter';
import { CacheFactory } from '../factory/cache.factory';
import { CacheProviderType } from '../interfaces/cache.interface';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let factory: CacheFactory;
  let adapter: MemoryCacheAdapter;

  beforeEach(async () => {
    factory = new CacheFactory();
    service = new CacheService(factory);

    adapter = new MemoryCacheAdapter({
      provider: CacheProviderType.MEMORY,
      keyPrefix: 'test',
      defaultTtl: 60,
    });

    service.setProvider(adapter);
  });

  afterEach(async () => {
    await adapter.close();
    await factory.clear();
  });

  describe('setProvider / getProvider', () => {
    it('should set and get provider', () => {
      expect(service.getProvider()).toBe(adapter);
    });

    it('should throw when provider not initialized', () => {
      const newService = new CacheService(factory);
      expect(() => newService.getProvider()).toThrow('not initialized');
    });
  });

  describe('basic operations', () => {
    it('should get and set values', async () => {
      await service.set('key1', 'value1');
      const result = await service.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('should delete values', async () => {
      await service.set('key1', 'value1');
      await service.delete('key1');
      expect(await service.exists('key1')).toBe(false);
    });
  });

  describe('cached (cache-aside pattern)', () => {
    it('should return cached value on hit', async () => {
      await service.set('cached-key', 'cached-value');

      const fn = vi.fn().mockResolvedValue('computed-value');
      const result = await service.cached('cached-key', fn);

      expect(result).toBe('cached-value');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should compute and cache on miss', async () => {
      const fn = vi.fn().mockResolvedValue('computed-value');
      const result = await service.cached('new-key', fn);

      expect(result).toBe('computed-value');
      expect(fn).toHaveBeenCalledOnce();
      expect(await service.get('new-key')).toBe('computed-value');
    });

    it('should force refresh when requested', async () => {
      await service.set('refresh-key', 'old-value');

      const fn = vi.fn().mockResolvedValue('new-value');
      const result = await service.cached('refresh-key', fn, { forceRefresh: true });

      expect(result).toBe('new-value');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should skip caching when condition met', async () => {
      const fn = vi.fn().mockResolvedValue(null);
      await service.cached('skip-key', fn, { skipIf: (r) => r === null });

      expect(await service.exists('skip-key')).toBe(false);
    });
  });

  describe('wrap', () => {
    it('should wrap function with caching', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const wrapped = service.wrap('prefix', fn);

      const r1 = await wrapped('arg1');
      const r2 = await wrapped('arg1');

      expect(r1).toBe('result');
      expect(r2).toBe('result');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should use custom key generator', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const wrapped = service.wrap('prefix', fn, {
        keyGenerator: (arg) => `custom:${arg}`,
      });

      await wrapped('test');
      expect(await service.exists('custom:test')).toBe(true);
    });
  });

  describe('batch operations', () => {
    it('should mget multiple values', async () => {
      await service.set('b1', 'v1');
      await service.set('b2', 'v2');

      const result = await service.mget<string>(['b1', 'b2', 'b3']);
      expect(result.get('b1')).toBe('v1');
      expect(result.get('b2')).toBe('v2');
      expect(result.get('b3')).toBeNull();
    });

    it('should mset multiple values', async () => {
      await service.mset(
        new Map([
          ['m1', 'v1'],
          ['m2', 'v2'],
        ])
      );
      expect(await service.get('m1')).toBe('v1');
      expect(await service.get('m2')).toBe('v2');
    });

    it('should mdelete multiple keys', async () => {
      await service.set('d1', 'v1');
      await service.set('d2', 'v2');

      const count = await service.mdelete(['d1', 'd2']);
      expect(count).toBe(2);
    });
  });

  describe('pattern operations', () => {
    it('should find keys by pattern', async () => {
      await service.set('user:1', 'u1');
      await service.set('user:2', 'u2');

      const keys = await service.keys('user:*');
      expect(keys.length).toBe(2);
    });

    it('should delete by pattern', async () => {
      await service.set('temp:1', 't1');
      await service.set('temp:2', 't2');

      const count = await service.deletePattern('temp:*');
      expect(count).toBe(2);
    });
  });

  describe('tag operations', () => {
    it('should invalidate by tag', async () => {
      await service.set('t1', 'v1', { tags: ['group'] });
      await service.set('t2', 'v2', { tags: ['group'] });

      const count = await service.invalidateTag('group');
      expect(count).toBe(2);
    });

    it('should invalidate multiple tags', async () => {
      await service.set('t1', 'v1', { tags: ['g1'] });
      await service.set('t2', 'v2', { tags: ['g2'] });

      const count = await service.invalidateTags(['g1', 'g2']);
      expect(count).toBe(2);
    });
  });

  describe('atomic operations', () => {
    it('should increment value', async () => {
      const r1 = await service.increment('counter');
      expect(r1).toBe(1);

      const r2 = await service.increment('counter', 5);
      expect(r2).toBe(6);
    });

    it('should decrement value', async () => {
      await service.set('counter', 10);
      const result = await service.decrement('counter', 3);
      expect(result).toBe(7);
    });
  });

  describe('distributed locking', () => {
    it('should acquire and release lock', async () => {
      const release = await service.acquireLock('test-lock');
      expect(release).not.toBeNull();

      // Lock should be held
      const release2 = await service.acquireLock('test-lock', { retries: 1 });
      expect(release2).toBeNull();

      // Release lock
      await release?.();

      // Now should be able to acquire
      const release3 = await service.acquireLock('test-lock');
      expect(release3).not.toBeNull();
      await release3?.();
    });

    it('should execute with lock', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await service.withLock('exec-lock', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should return null when lock not acquired', async () => {
      const release = await service.acquireLock('busy-lock');

      const fn = vi.fn().mockResolvedValue('result');
      const result = await service.withLock('busy-lock', fn, { retries: 1 });

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();

      await release?.();
    });
  });

  describe('rate limiting', () => {
    it('should allow requests within limit', async () => {
      const r1 = await service.rateLimit('api:user:1', 5, 60);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(4);
    });

    it('should block requests over limit', async () => {
      for (let i = 0; i < 5; i++) {
        await service.rateLimit('api:user:2', 5, 60);
      }

      const result = await service.rateLimit('api:user:2', 5, 60);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return reset time', async () => {
      const result = await service.rateLimit('api:user:3', 10, 60);
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('utility operations', () => {
    it('should clear all cache', async () => {
      await service.set('c1', 'v1');
      await service.set('c2', 'v2');

      await service.clear();

      expect(await service.exists('c1')).toBe(false);
      expect(await service.exists('c2')).toBe(false);
    });

    it('should return stats', async () => {
      await service.set('s1', 'v1');
      await service.get('s1');

      const stats = await service.stats();
      expect(stats.provider).toBe(CacheProviderType.MEMORY);
      expect(stats.hits).toBeGreaterThanOrEqual(0);
    });

    it('should pass health check', async () => {
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});

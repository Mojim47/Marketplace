// ═══════════════════════════════════════════════════════════════════════════
// Cache Factory Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheFactory } from './cache.factory';
import { CacheProviderType } from '../interfaces/cache.interface';
import { MemoryCacheAdapter } from '../adapters/memory.adapter';

describe('CacheFactory', () => {
  let factory: CacheFactory;

  beforeEach(() => {
    factory = new CacheFactory();
  });

  afterEach(async () => {
    await factory.clear();
    vi.unstubAllEnvs();
  });

  describe('create', () => {
    it('should create MemoryCacheAdapter', () => {
      const provider = factory.create({
        provider: CacheProviderType.MEMORY,
        maxItems: 100,
      });

      expect(provider).toBeInstanceOf(MemoryCacheAdapter);
      expect(provider.providerType).toBe(CacheProviderType.MEMORY);
    });

    it('should cache provider instances', () => {
      const config = { provider: CacheProviderType.MEMORY as const };
      const p1 = factory.create(config, 'cached');
      const p2 = factory.create(config, 'cached');
      expect(p1).toBe(p2);
    });

    it('should create different instances for different names', () => {
      const config = { provider: CacheProviderType.MEMORY as const };
      const p1 = factory.create(config, 'inst1');
      const p2 = factory.create(config, 'inst2');
      expect(p1).not.toBe(p2);
    });

    it('should throw for unsupported provider', () => {
      expect(() => factory.create({ provider: 'invalid' as any }))
        .toThrow('Unsupported cache provider');
    });
  });

  describe('createFromEnv', () => {
    it('should create MemoryCacheAdapter from env', () => {
      vi.stubEnv('TEST_PROVIDER', 'memory');
      vi.stubEnv('TEST_KEY_PREFIX', 'test');
      vi.stubEnv('TEST_DEFAULT_TTL', '300');

      const provider = factory.createFromEnv('TEST');
      expect(provider).toBeInstanceOf(MemoryCacheAdapter);
    });

    it('should throw when provider env is missing', () => {
      expect(() => factory.createFromEnv('MISSING'))
        .toThrow('Missing environment variable');
    });
  });

  describe('get', () => {
    it('should return cached provider', () => {
      factory.create({ provider: CacheProviderType.MEMORY }, 'test');
      const provider = factory.get('test');
      expect(provider).toBeDefined();
    });

    it('should return undefined for non-existent', () => {
      expect(factory.get('non-existent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for cached provider', () => {
      factory.create({ provider: CacheProviderType.MEMORY }, 'test');
      expect(factory.has('test')).toBe(true);
    });

    it('should return false for non-existent', () => {
      expect(factory.has('non-existent')).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove cached provider', async () => {
      factory.create({ provider: CacheProviderType.MEMORY }, 'test');
      const removed = await factory.remove('test');
      expect(removed).toBe(true);
      expect(factory.has('test')).toBe(false);
    });

    it('should return false for non-existent', async () => {
      const removed = await factory.remove('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all providers', async () => {
      factory.create({ provider: CacheProviderType.MEMORY }, 'p1');
      factory.create({ provider: CacheProviderType.MEMORY }, 'p2');
      
      await factory.clear();
      
      expect(factory.has('p1')).toBe(false);
      expect(factory.has('p2')).toBe(false);
    });
  });

  describe('getProviderNames', () => {
    it('should return all provider names', () => {
      factory.create({ provider: CacheProviderType.MEMORY }, 'n1');
      factory.create({ provider: CacheProviderType.MEMORY }, 'n2');
      
      const names = factory.getProviderNames();
      expect(names).toContain('n1');
      expect(names).toContain('n2');
    });
  });
});

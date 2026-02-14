// ═══════════════════════════════════════════════════════════════════════════
// Storage Factory Tests
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter } from '../adapters/local.adapter';
import { MinioStorageAdapter } from '../adapters/minio.adapter';
import { S3StorageAdapter } from '../adapters/s3.adapter';
import { StorageProviderType } from '../interfaces/storage.interface';
import { StorageFactory } from './storage.factory';

describe('StorageFactory', () => {
  let factory: StorageFactory;

  beforeEach(() => {
    factory = new StorageFactory();
  });

  afterEach(() => {
    factory.clear();
    vi.unstubAllEnvs();
  });

  describe('create', () => {
    it('should create LocalStorageAdapter', () => {
      const provider = factory.create({
        provider: StorageProviderType.LOCAL,
        bucket: 'test-bucket',
        rootDir: './test-storage',
      });

      expect(provider).toBeInstanceOf(LocalStorageAdapter);
      expect(provider.providerType).toBe(StorageProviderType.LOCAL);
      expect(provider.bucket).toBe('test-bucket');
    });

    it('should create S3StorageAdapter', () => {
      const provider = factory.create({
        provider: StorageProviderType.S3,
        bucket: 's3-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });

      expect(provider).toBeInstanceOf(S3StorageAdapter);
      expect(provider.providerType).toBe(StorageProviderType.S3);
      expect(provider.bucket).toBe('s3-bucket');
    });

    it('should create MinioStorageAdapter', () => {
      const provider = factory.create({
        provider: StorageProviderType.MINIO,
        bucket: 'minio-bucket',
        endPoint: 'localhost',
        port: 9000,
        useSSL: false,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
      });

      expect(provider).toBeInstanceOf(MinioStorageAdapter);
      expect(provider.providerType).toBe(StorageProviderType.MINIO);
      expect(provider.bucket).toBe('minio-bucket');
    });

    it('should cache provider instances', () => {
      const config = {
        provider: StorageProviderType.LOCAL as const,
        bucket: 'cached-bucket',
        rootDir: './test-storage',
      };

      const provider1 = factory.create(config, 'cached');
      const provider2 = factory.create(config, 'cached');

      expect(provider1).toBe(provider2);
    });

    it('should create different instances for different names', () => {
      const config = {
        provider: StorageProviderType.LOCAL as const,
        bucket: 'test-bucket',
        rootDir: './test-storage',
      };

      const provider1 = factory.create(config, 'instance1');
      const provider2 = factory.create(config, 'instance2');

      expect(provider1).not.toBe(provider2);
    });

    it('should throw error for unsupported provider', () => {
      expect(() =>
        factory.create({
          provider: 'unsupported' as StorageProviderType,
          bucket: 'test',
        } as any)
      ).toThrow('Unsupported storage provider');
    });
  });

  describe('createFromEnv', () => {
    it('should create LocalStorageAdapter from env', () => {
      vi.stubEnv('TEST_PROVIDER', 'local');
      vi.stubEnv('TEST_BUCKET', 'env-bucket');
      vi.stubEnv('TEST_ROOT_DIR', './env-storage');

      const provider = factory.createFromEnv('TEST');

      expect(provider).toBeInstanceOf(LocalStorageAdapter);
      expect(provider.bucket).toBe('env-bucket');
    });

    it('should create S3StorageAdapter from env', () => {
      vi.stubEnv('S3_PROVIDER', 's3');
      vi.stubEnv('S3_BUCKET', 's3-env-bucket');
      vi.stubEnv('S3_REGION', 'eu-west-1');
      vi.stubEnv('S3_ACCESS_KEY_ID', 'env-key');
      vi.stubEnv('S3_SECRET_ACCESS_KEY', 'env-secret');

      const provider = factory.createFromEnv('S3');

      expect(provider).toBeInstanceOf(S3StorageAdapter);
      expect(provider.bucket).toBe('s3-env-bucket');
    });

    it('should create MinioStorageAdapter from env', () => {
      vi.stubEnv('MINIO_PROVIDER', 'minio');
      vi.stubEnv('MINIO_BUCKET', 'minio-env-bucket');
      vi.stubEnv('MINIO_ENDPOINT', 'minio.local');
      vi.stubEnv('MINIO_PORT', '9000');
      vi.stubEnv('MINIO_USE_SSL', 'false');
      vi.stubEnv('MINIO_ACCESS_KEY', 'minio-key');
      vi.stubEnv('MINIO_SECRET_KEY', 'minio-secret');

      const provider = factory.createFromEnv('MINIO');

      expect(provider).toBeInstanceOf(MinioStorageAdapter);
      expect(provider.bucket).toBe('minio-env-bucket');
    });

    it('should throw error when provider env is missing', () => {
      expect(() => factory.createFromEnv('MISSING')).toThrow('Missing environment variable');
    });

    it('should use default bucket when not specified', () => {
      vi.stubEnv('DEFAULT_PROVIDER', 'local');
      vi.stubEnv('DEFAULT_ROOT_DIR', './storage');

      const provider = factory.createFromEnv('DEFAULT');

      expect(provider.bucket).toBe('default');
    });
  });

  describe('get', () => {
    it('should return cached provider', () => {
      const config = {
        provider: StorageProviderType.LOCAL as const,
        bucket: 'get-test',
        rootDir: './test-storage',
      };
      factory.create(config, 'get-test');

      const provider = factory.get('get-test');

      expect(provider).toBeDefined();
      expect(provider?.bucket).toBe('get-test');
    });

    it('should return undefined for non-existent provider', () => {
      expect(factory.get('non-existent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for cached provider', () => {
      factory.create(
        {
          provider: StorageProviderType.LOCAL,
          bucket: 'has-test',
          rootDir: './test-storage',
        },
        'has-test'
      );

      expect(factory.has('has-test')).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      expect(factory.has('non-existent')).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove cached provider', () => {
      factory.create(
        {
          provider: StorageProviderType.LOCAL,
          bucket: 'remove-test',
          rootDir: './test-storage',
        },
        'remove-test'
      );

      const removed = factory.remove('remove-test');

      expect(removed).toBe(true);
      expect(factory.has('remove-test')).toBe(false);
    });

    it('should return false for non-existent provider', () => {
      expect(factory.remove('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cached providers', () => {
      factory.create(
        {
          provider: StorageProviderType.LOCAL,
          bucket: 'clear-test-1',
          rootDir: './test-storage',
        },
        'clear-1'
      );
      factory.create(
        {
          provider: StorageProviderType.LOCAL,
          bucket: 'clear-test-2',
          rootDir: './test-storage',
        },
        'clear-2'
      );

      factory.clear();

      expect(factory.has('clear-1')).toBe(false);
      expect(factory.has('clear-2')).toBe(false);
    });
  });

  describe('getProviderNames', () => {
    it('should return all cached provider names', () => {
      factory.create(
        {
          provider: StorageProviderType.LOCAL,
          bucket: 'names-test-1',
          rootDir: './test-storage',
        },
        'names-1'
      );
      factory.create(
        {
          provider: StorageProviderType.LOCAL,
          bucket: 'names-test-2',
          rootDir: './test-storage',
        },
        'names-2'
      );

      const names = factory.getProviderNames();

      expect(names).toContain('names-1');
      expect(names).toContain('names-2');
    });

    it('should return empty array when no providers cached', () => {
      expect(factory.getProviderNames()).toEqual([]);
    });
  });
});

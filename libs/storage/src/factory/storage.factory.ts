// ═══════════════════════════════════════════════════════════════════════════
// Storage Factory - Provider-Agnostic Storage Creation
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Switch providers without code changes
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { LocalStorageAdapter } from '../adapters/local.adapter';
import { MinioStorageAdapter } from '../adapters/minio.adapter';
import { S3StorageAdapter } from '../adapters/s3.adapter';
import type {
  IStorageProvider,
  LocalStorageConfig,
  MinioStorageConfig,
  S3StorageConfig,
  StorageConfig,
} from '../interfaces/storage.interface';
import { StorageProviderType } from '../interfaces/storage.interface';

/**
 * Storage factory for creating provider instances
 * Supports runtime provider switching via configuration
 */
@Injectable()
export class StorageFactory {
  private readonly logger = new Logger(StorageFactory.name);
  private readonly providers: Map<string, IStorageProvider> = new Map();

  /**
   * Create a storage provider instance based on configuration
   * @param config - Storage configuration
   * @param name - Optional name for caching the provider instance
   * @returns Storage provider instance
   */
  create(config: StorageConfig, name?: string): IStorageProvider {
    const cacheKey = name || `${config.provider}:${config.bucket}`;

    // Return cached instance if available
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    let provider: IStorageProvider;

    switch (config.provider) {
      case StorageProviderType.LOCAL:
        provider = new LocalStorageAdapter(config as LocalStorageConfig);
        this.logger.log(`Created LocalStorageAdapter for bucket: ${config.bucket}`);
        break;

      case StorageProviderType.S3:
        provider = new S3StorageAdapter(config as S3StorageConfig);
        this.logger.log(`Created S3StorageAdapter for bucket: ${config.bucket}`);
        break;

      case StorageProviderType.MINIO:
        provider = new MinioStorageAdapter(config as MinioStorageConfig);
        this.logger.log(`Created MinioStorageAdapter for bucket: ${config.bucket}`);
        break;

      default:
        throw new Error(`Unsupported storage provider: ${(config as StorageConfig).provider}`);
    }

    // Cache the provider instance
    this.providers.set(cacheKey, provider);

    return provider;
  }

  /**
   * Create a storage provider from environment variables
   * @param prefix - Environment variable prefix (e.g., 'STORAGE' for STORAGE_PROVIDER, STORAGE_BUCKET, etc.)
   * @param name - Optional name for caching
   * @returns Storage provider instance
   */
  createFromEnv(prefix = 'STORAGE', name?: string): IStorageProvider {
    const provider = process.env[`${prefix}_PROVIDER`] as StorageProviderType;
    const bucket = process.env[`${prefix}_BUCKET`] || 'default';

    if (!provider) {
      throw new Error(`Missing environment variable: ${prefix}_PROVIDER`);
    }

    let config: StorageConfig;

    switch (provider) {
      case StorageProviderType.LOCAL:
        config = {
          provider: StorageProviderType.LOCAL,
          bucket,
          rootDir: process.env[`${prefix}_ROOT_DIR`] || './storage',
          baseUrl: process.env[`${prefix}_BASE_URL`],
          basePath: process.env[`${prefix}_BASE_PATH`],
        };
        break;

      case StorageProviderType.S3:
        config = {
          provider: StorageProviderType.S3,
          bucket,
          region: process.env[`${prefix}_REGION`] || 'us-east-1',
          accessKeyId: process.env[`${prefix}_ACCESS_KEY_ID`],
          secretAccessKey: process.env[`${prefix}_SECRET_ACCESS_KEY`],
          endpoint: process.env[`${prefix}_ENDPOINT`],
          forcePathStyle: process.env[`${prefix}_FORCE_PATH_STYLE`] === 'true',
          basePath: process.env[`${prefix}_BASE_PATH`],
        };
        break;

      case StorageProviderType.MINIO:
        config = {
          provider: StorageProviderType.MINIO,
          bucket,
          endPoint: process.env[`${prefix}_ENDPOINT`] || 'localhost',
          port: Number.parseInt(process.env[`${prefix}_PORT`] || '9000', 10),
          useSSL: process.env[`${prefix}_USE_SSL`] === 'true',
          accessKey: process.env[`${prefix}_ACCESS_KEY`] || '',
          secretKey: process.env[`${prefix}_SECRET_KEY`] || '',
          region: process.env[`${prefix}_REGION`],
          basePath: process.env[`${prefix}_BASE_PATH`],
        };
        break;

      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }

    return this.create(config, name);
  }

  /**
   * Get a cached provider instance by name
   * @param name - Provider cache name
   * @returns Storage provider or undefined
   */
  get(name: string): IStorageProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a provider is cached
   * @param name - Provider cache name
   * @returns True if provider exists
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Remove a cached provider
   * @param name - Provider cache name
   * @returns True if provider was removed
   */
  remove(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Clear all cached providers
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * Get all cached provider names
   * @returns Array of provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
}

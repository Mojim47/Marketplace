/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Shared Storage Module
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Central storage module that integrates MinIO/S3-compatible storage service
 * from libs/storage for file uploads and management.
 *
 * Features:
 * - File upload with validation
 * - Presigned URL generation for secure access
 * - Multipart upload support for large files
 * - File deletion and management
 *
 * @module @nextgen/api/shared/storage
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Import storage service from libs/storage
import { StorageService } from '@nextgen/storage';

// Import controller
import { StorageController } from './storage.controller';

// Import tokens
import { STORAGE_TOKENS } from './tokens';

// Storage module configuration interface
export interface StorageModuleConfig {
  endpoint?: string;
  port?: number;
  accessKey?: string;
  secretKey?: string;
  useSSL?: boolean;
  defaultBucket?: string;
  publicUrl?: string;
}

@Global()
@Module({})
export class StorageModule {
  /**
   * Register the storage module with default configuration
   */
  static forRoot(config?: Partial<StorageModuleConfig>): DynamicModule {
    return {
      module: StorageModule,
      imports: [ConfigModule],
      controllers: [StorageController],
      providers: [
        // Storage Service Provider
        {
          provide: STORAGE_TOKENS.STORAGE_SERVICE,
          useFactory: (_configService: ConfigService) => {
            // Set environment variables if config is provided
            if (config?.endpoint) {
              process.env.MINIO_ENDPOINT = config.endpoint;
            }
            if (config?.port) {
              process.env.MINIO_API_PORT = String(config.port);
            }
            if (config?.accessKey) {
              process.env.MINIO_ROOT_USER = config.accessKey;
            }
            if (config?.secretKey) {
              process.env.MINIO_ROOT_PASSWORD = config.secretKey;
            }
            if (config?.useSSL !== undefined) {
              process.env.MINIO_USE_SSL = String(config.useSSL);
            }
            if (config?.defaultBucket) {
              process.env.MINIO_BUCKET_UPLOADS = config.defaultBucket;
            }
            if (config?.publicUrl) {
              process.env.MINIO_PUBLIC_URL = config.publicUrl;
            }

            return new StorageService();
          },
          inject: [ConfigService],
        },

        // Also provide StorageService directly for injection
        {
          provide: StorageService,
          useFactory: (storageService: StorageService) => storageService,
          inject: [STORAGE_TOKENS.STORAGE_SERVICE],
        },
      ],
      exports: [STORAGE_TOKENS.STORAGE_SERVICE, StorageService],
    };
  }

  /**
   * Register the storage module asynchronously with configuration factory
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<StorageModuleConfig> | StorageModuleConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: StorageModule,
      imports: [ConfigModule],
      controllers: [StorageController],
      providers: [
        {
          provide: 'STORAGE_MODULE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        // Storage Service Provider
        {
          provide: STORAGE_TOKENS.STORAGE_SERVICE,
          useFactory: (config: StorageModuleConfig) => {
            // Set environment variables from config
            if (config.endpoint) {
              process.env.MINIO_ENDPOINT = config.endpoint;
            }
            if (config.port) {
              process.env.MINIO_API_PORT = String(config.port);
            }
            if (config.accessKey) {
              process.env.MINIO_ROOT_USER = config.accessKey;
            }
            if (config.secretKey) {
              process.env.MINIO_ROOT_PASSWORD = config.secretKey;
            }
            if (config.useSSL !== undefined) {
              process.env.MINIO_USE_SSL = String(config.useSSL);
            }
            if (config.defaultBucket) {
              process.env.MINIO_BUCKET_UPLOADS = config.defaultBucket;
            }
            if (config.publicUrl) {
              process.env.MINIO_PUBLIC_URL = config.publicUrl;
            }

            return new StorageService();
          },
          inject: ['STORAGE_MODULE_CONFIG'],
        },

        // Also provide StorageService directly for injection
        {
          provide: StorageService,
          useFactory: (storageService: StorageService) => storageService,
          inject: [STORAGE_TOKENS.STORAGE_SERVICE],
        },
      ],
      exports: [STORAGE_TOKENS.STORAGE_SERVICE, StorageService],
    };
  }
}

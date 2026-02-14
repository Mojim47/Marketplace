// ═══════════════════════════════════════════════════════════════════════════
// Cache Module - NestJS Module for Cache Abstraction
// ═══════════════════════════════════════════════════════════════════════════

import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CacheFactory } from './factory/cache.factory';
import type { CacheConfig } from './interfaces/cache.interface';
import { CacheService } from './services/cache.service';

/**
 * Cache module options
 */
export interface CacheModuleOptions {
  /** Default cache configuration */
  config?: CacheConfig;
  /** Use environment variables for configuration */
  useEnv?: boolean;
  /** Environment variable prefix (default: CACHE) */
  envPrefix?: string;
  /** Make module global */
  isGlobal?: boolean;
}

/**
 * Async cache module options
 */
export interface CacheModuleAsyncOptions {
  /** Make module global */
  isGlobal?: boolean;
  /** Imports for dependency injection */
  imports?: any[];
  /** Factory function to create options */
  useFactory: (...args: any[]) => Promise<CacheModuleOptions> | CacheModuleOptions;
  /** Dependencies to inject into factory */
  inject?: any[];
}

/**
 * Cache module for NestJS applications
 */
@Module({})
export class CacheModule {
  /**
   * Register cache module with static configuration
   */
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      CacheFactory,
      {
        provide: CacheService,
        useFactory: (factory: CacheFactory) => {
          const service = new CacheService(factory);

          if (options.config) {
            const provider = factory.create(options.config, 'default');
            service.setProvider(provider);
          }

          return service;
        },
        inject: [CacheFactory],
      },
    ];

    return {
      module: CacheModule,
      global: options.isGlobal ?? false,
      providers,
      exports: [CacheFactory, CacheService],
    };
  }

  /**
   * Register cache module with async configuration
   */
  static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      CacheFactory,
      {
        provide: 'CACHE_MODULE_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: CacheService,
        useFactory: async (factory: CacheFactory, moduleOptions: CacheModuleOptions) => {
          const service = new CacheService(factory);

          if (moduleOptions.config) {
            const provider = factory.create(moduleOptions.config, 'default');
            service.setProvider(provider);
          }

          return service;
        },
        inject: [CacheFactory, 'CACHE_MODULE_OPTIONS'],
      },
    ];

    return {
      module: CacheModule,
      global: options.isGlobal ?? false,
      imports: options.imports || [],
      providers,
      exports: [CacheFactory, CacheService],
    };
  }

  /**
   * Register cache module for feature modules
   */
  static forFeature(): DynamicModule {
    return {
      module: CacheModule,
      providers: [],
      exports: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage Module - NestJS Module for Storage Abstraction
// ═══════════════════════════════════════════════════════════════════════════

import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import type { StorageConfig } from './interfaces/storage.interface';
import { StorageFactory } from './factory/storage.factory';
import { StorageService } from './services/storage.service';

/**
 * Storage module options
 */
export interface StorageModuleOptions {
  /** Default storage configuration */
  config?: StorageConfig;
  /** Use environment variables for configuration */
  useEnv?: boolean;
  /** Environment variable prefix (default: STORAGE) */
  envPrefix?: string;
  /** Make module global */
  isGlobal?: boolean;
}

/**
 * Async storage module options
 */
export interface StorageModuleAsyncOptions {
  /** Make module global */
  isGlobal?: boolean;
  /** Imports for dependency injection */
  imports?: any[];
  /** Factory function to create options */
  useFactory: (...args: any[]) => Promise<StorageModuleOptions> | StorageModuleOptions;
  /** Dependencies to inject into factory */
  inject?: any[];
}

/**
 * Storage module for NestJS applications
 * Provides vendor-agnostic file storage capabilities
 */
@Module({})
export class StorageModule {
  /**
   * Register storage module with static configuration
   * @param options - Module options
   * @returns Dynamic module
   */
  static forRoot(options: StorageModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      StorageFactory,
      {
        provide: StorageService,
        useFactory: (factory: StorageFactory) => {
          const service = new StorageService(factory);
          
          if (options.config) {
            const provider = factory.create(options.config, 'default');
            service.setProvider(provider);
          }
          
          return service;
        },
        inject: [StorageFactory],
      },
    ];

    return {
      module: StorageModule,
      global: options.isGlobal ?? false,
      providers,
      exports: [StorageFactory, StorageService],
    };
  }

  /**
   * Register storage module with async configuration
   * @param options - Async module options
   * @returns Dynamic module
   */
  static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      StorageFactory,
      {
        provide: 'STORAGE_MODULE_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: StorageService,
        useFactory: async (factory: StorageFactory, moduleOptions: StorageModuleOptions) => {
          const service = new StorageService(factory);
          
          if (moduleOptions.config) {
            const provider = factory.create(moduleOptions.config, 'default');
            service.setProvider(provider);
          }
          
          return service;
        },
        inject: [StorageFactory, 'STORAGE_MODULE_OPTIONS'],
      },
    ];

    return {
      module: StorageModule,
      global: options.isGlobal ?? false,
      imports: options.imports || [],
      providers,
      exports: [StorageFactory, StorageService],
    };
  }

  /**
   * Register storage module for feature modules
   * Uses the global StorageFactory and StorageService
   * @returns Dynamic module
   */
  static forFeature(): DynamicModule {
    return {
      module: StorageModule,
      providers: [],
      exports: [],
    };
  }
}

/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Shared Tax Module
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Central tax module that integrates with Iranian tax authority (Moodian/SENA)
 * for electronic invoice submission and VAT reporting.
 *
 * Features:
 * - Submit invoices to Moodian/SENA
 * - Poll invoice status
 * - Generate VAT reports
 * - Store submission history
 *
 * @module @nextgen/api/shared/tax
 * Requirements: 9.1, 9.2, 9.3
 */

import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaxController } from './tax.controller';
import { DatabaseSenaRepo, HttpSenaClient, TAX_TOKENS, TaxService } from './tax.service';

// Module configuration interface
export interface TaxModuleConfig {
  moodianApiUrl?: string;
  moodianApiKey?: string;
}

@Global()
@Module({})
export class TaxModule {
  /**
   * Register the tax module with default configuration
   */
  static forRoot(config?: Partial<TaxModuleConfig>): DynamicModule {
    return {
      module: TaxModule,
      imports: [ConfigModule],
      controllers: [TaxController],
      providers: [
        // SENA Client Provider
        {
          provide: TAX_TOKENS.SENA_CLIENT,
          useFactory: (configService: ConfigService) => {
            // Override config if provided
            if (config?.moodianApiUrl) {
              process.env.MOODIAN_API_URL = config.moodianApiUrl;
            }
            if (config?.moodianApiKey) {
              process.env.MOODIAN_API_KEY = config.moodianApiKey;
            }
            return new HttpSenaClient(configService);
          },
          inject: [ConfigService],
        },

        // SENA Repository Provider
        {
          provide: TAX_TOKENS.SENA_REPO,
          useClass: DatabaseSenaRepo,
        },

        // Tax Service
        TaxService,

        // Also provide HttpSenaClient directly for injection
        {
          provide: HttpSenaClient,
          useFactory: (client: HttpSenaClient) => client,
          inject: [TAX_TOKENS.SENA_CLIENT],
        },
      ],
      exports: [TAX_TOKENS.SENA_CLIENT, TAX_TOKENS.SENA_REPO, TaxService, HttpSenaClient],
    };
  }

  /**
   * Register the tax module asynchronously with configuration factory
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<TaxModuleConfig> | TaxModuleConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: TaxModule,
      imports: [ConfigModule],
      controllers: [TaxController],
      providers: [
        {
          provide: 'TAX_MODULE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },

        // SENA Client Provider
        {
          provide: TAX_TOKENS.SENA_CLIENT,
          useFactory: (config: TaxModuleConfig, configService: ConfigService) => {
            if (config.moodianApiUrl) {
              process.env.MOODIAN_API_URL = config.moodianApiUrl;
            }
            if (config.moodianApiKey) {
              process.env.MOODIAN_API_KEY = config.moodianApiKey;
            }
            return new HttpSenaClient(configService);
          },
          inject: ['TAX_MODULE_CONFIG', ConfigService],
        },

        // SENA Repository Provider
        {
          provide: TAX_TOKENS.SENA_REPO,
          useClass: DatabaseSenaRepo,
        },

        // Tax Service
        TaxService,

        // Also provide HttpSenaClient directly for injection
        {
          provide: HttpSenaClient,
          useFactory: (client: HttpSenaClient) => client,
          inject: [TAX_TOKENS.SENA_CLIENT],
        },
      ],
      exports: [TAX_TOKENS.SENA_CLIENT, TAX_TOKENS.SENA_REPO, TaxService, HttpSenaClient],
    };
  }
}

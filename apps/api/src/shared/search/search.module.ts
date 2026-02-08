/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Shared Search Module
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Central search module that integrates Persian tokenizer and MeiliSearch
 * from libs/search for full-text product search with Persian language support.
 * 
 * Features:
 * - Persian text tokenization with stemming
 * - Fuzzy search with typo tolerance
 * - Stop word removal
 * - Text normalization (Arabic to Persian)
 * - Search suggestions (autocomplete)
 * - Text highlighting
 * 
 * @module @nextgen/api/shared/search
 * Requirements: 8.1, 8.2, 8.3
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Import from libs/search
import { PersianTokenizer, SearchService } from '@nextgen/search';

// Import controller
import { SearchController } from './search.controller';

// Import tokens
import { SEARCH_TOKENS } from './tokens';

// Search module configuration interface
export interface SearchModuleConfig {
  meiliHost?: string;
  meiliApiKey?: string;
  tokenizerOptions?: {
    removeStopWords?: boolean;
    normalize?: boolean;
    stem?: boolean;
    lowercase?: boolean;
    minLength?: number;
    maxLength?: number;
  };
}

@Global()
@Module({})
export class SharedSearchModule {
  /**
   * Register the search module with default configuration
   */
  static forRoot(config?: Partial<SearchModuleConfig>): DynamicModule {
    return {
      module: SharedSearchModule,
      imports: [ConfigModule],
      controllers: [SearchController],
      providers: [
        // Persian Tokenizer Provider
        {
          provide: SEARCH_TOKENS.PERSIAN_TOKENIZER,
          useFactory: () => {
            return PersianTokenizer.getInstance(config?.tokenizerOptions);
          },
        },

        // Search Service Provider (MeiliSearch)
        {
          provide: SEARCH_TOKENS.SEARCH_SERVICE,
          useFactory: (configService: ConfigService) => {
            // Set environment variables if config is provided
            if (config?.meiliHost) {
              process.env.MEILI_HOST = config.meiliHost;
            }
            if (config?.meiliApiKey) {
              process.env.MEILI_MASTER_KEY = config.meiliApiKey;
            }

            return new SearchService();
          },
          inject: [ConfigService],
        },

        // Also provide PersianTokenizer directly for injection
        {
          provide: PersianTokenizer,
          useFactory: (tokenizer: PersianTokenizer) => tokenizer,
          inject: [SEARCH_TOKENS.PERSIAN_TOKENIZER],
        },

        // Also provide SearchService directly for injection
        {
          provide: SearchService,
          useFactory: (searchService: SearchService) => searchService,
          inject: [SEARCH_TOKENS.SEARCH_SERVICE],
        },
      ],
      exports: [
        SEARCH_TOKENS.PERSIAN_TOKENIZER,
        SEARCH_TOKENS.SEARCH_SERVICE,
        PersianTokenizer,
        SearchService,
      ],
    };
  }

  /**
   * Register the search module asynchronously with configuration factory
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<SearchModuleConfig> | SearchModuleConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: SharedSearchModule,
      imports: [ConfigModule],
      controllers: [SearchController],
      providers: [
        {
          provide: 'SEARCH_MODULE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        // Persian Tokenizer Provider
        {
          provide: SEARCH_TOKENS.PERSIAN_TOKENIZER,
          useFactory: (config: SearchModuleConfig) => {
            return PersianTokenizer.getInstance(config.tokenizerOptions);
          },
          inject: ['SEARCH_MODULE_CONFIG'],
        },

        // Search Service Provider (MeiliSearch)
        {
          provide: SEARCH_TOKENS.SEARCH_SERVICE,
          useFactory: (config: SearchModuleConfig) => {
            // Set environment variables from config
            if (config.meiliHost) {
              process.env.MEILI_HOST = config.meiliHost;
            }
            if (config.meiliApiKey) {
              process.env.MEILI_MASTER_KEY = config.meiliApiKey;
            }

            return new SearchService();
          },
          inject: ['SEARCH_MODULE_CONFIG'],
        },

        // Also provide PersianTokenizer directly for injection
        {
          provide: PersianTokenizer,
          useFactory: (tokenizer: PersianTokenizer) => tokenizer,
          inject: [SEARCH_TOKENS.PERSIAN_TOKENIZER],
        },

        // Also provide SearchService directly for injection
        {
          provide: SearchService,
          useFactory: (searchService: SearchService) => searchService,
          inject: [SEARCH_TOKENS.SEARCH_SERVICE],
        },
      ],
      exports: [
        SEARCH_TOKENS.PERSIAN_TOKENIZER,
        SEARCH_TOKENS.SEARCH_SERVICE,
        PersianTokenizer,
        SearchService,
      ],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Search Factory - Provider-Agnostic Search Creation
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchAdapter } from '../adapters/elasticsearch.adapter';
import { MeilisearchAdapter } from '../adapters/meilisearch.adapter';
import { MemorySearchAdapter } from '../adapters/memory.adapter';
import type {
  ElasticsearchConfig,
  ISearchProvider,
  MeilisearchConfig,
  MemorySearchConfig,
  SearchConfig,
} from '../interfaces/search.interface';
import { SearchProviderType } from '../interfaces/search.interface';

@Injectable()
export class SearchFactory {
  private readonly logger = new Logger(SearchFactory.name);
  private readonly providers: Map<string, ISearchProvider> = new Map();

  create(config: SearchConfig, name?: string): ISearchProvider {
    const cacheKey = name || `${config.provider}:default`;

    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    let provider: ISearchProvider;

    switch (config.provider) {
      case SearchProviderType.MEMORY:
        provider = new MemorySearchAdapter(config as MemorySearchConfig);
        this.logger.log('Created MemorySearchAdapter');
        break;

      case SearchProviderType.ELASTICSEARCH:
        provider = new ElasticsearchAdapter(config as ElasticsearchConfig);
        this.logger.log('Created ElasticsearchAdapter');
        break;

      case SearchProviderType.MEILISEARCH:
        provider = new MeilisearchAdapter(config as MeilisearchConfig);
        this.logger.log('Created MeilisearchAdapter');
        break;

      default:
        throw new Error(`Unsupported search provider: ${(config as SearchConfig).provider}`);
    }

    this.providers.set(cacheKey, provider);
    return provider;
  }

  createFromEnv(prefix = 'SEARCH', name?: string): ISearchProvider {
    const provider = process.env[`${prefix}_PROVIDER`] as SearchProviderType;

    if (!provider) {
      throw new Error(`Missing environment variable: ${prefix}_PROVIDER`);
    }

    let config: SearchConfig;

    switch (provider) {
      case SearchProviderType.MEMORY:
        config = {
          provider: SearchProviderType.MEMORY,
          indexPrefix: process.env[`${prefix}_INDEX_PREFIX`],
        };
        break;

      case SearchProviderType.ELASTICSEARCH:
        config = {
          provider: SearchProviderType.ELASTICSEARCH,
          node: process.env[`${prefix}_NODE`] || 'http://localhost:9200',
          indexPrefix: process.env[`${prefix}_INDEX_PREFIX`],
          auth: process.env[`${prefix}_API_KEY`]
            ? { apiKey: process.env[`${prefix}_API_KEY`] }
            : process.env[`${prefix}_USERNAME`]
              ? {
                  username: process.env[`${prefix}_USERNAME`],
                  password: process.env[`${prefix}_PASSWORD`] || '',
                }
              : undefined,
        };
        break;

      case SearchProviderType.MEILISEARCH:
        config = {
          provider: SearchProviderType.MEILISEARCH,
          host: process.env[`${prefix}_HOST`] || 'http://localhost:7700',
          apiKey: process.env[`${prefix}_API_KEY`],
          indexPrefix: process.env[`${prefix}_INDEX_PREFIX`],
        };
        break;

      default:
        throw new Error(`Unsupported search provider: ${provider}`);
    }

    return this.create(config, name);
  }

  get(name: string): ISearchProvider | undefined {
    return this.providers.get(name);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  async remove(name: string): Promise<boolean> {
    const provider = this.providers.get(name);
    if (provider) {
      await provider.close();
      this.providers.delete(name);
      return true;
    }
    return false;
  }

  async clear(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.close();
    }
    this.providers.clear();
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
}

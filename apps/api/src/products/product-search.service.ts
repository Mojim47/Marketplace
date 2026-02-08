/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Product Search Service
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Service for Persian product search with tokenization, fuzzy matching,
 * and stemming support.
 * 
 * Features:
 * - Persian text tokenization
 * - Fuzzy search with typo tolerance
 * - Stop word removal
 * - Text normalization
 * - Search suggestions
 * 
 * @module @nextgen/api/products
 * Requirements: 8.1, 8.2, 8.3
 */

import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PersianTokenizer, SearchService } from '@nextgen/search';
import { SEARCH_TOKENS } from '../shared/search/tokens';

export interface ProductSearchFilters {
  categoryId?: string;
  brandId?: string;
  vendorId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  status?: string;
}

export interface ProductSearchOptions {
  query: string;
  filters?: ProductSearchFilters;
  limit?: number;
  offset?: number;
  sort?: string;
  facets?: string[];
}

export interface ProductSearchResult {
  id: string;
  name: string;
  nameHighlighted?: string;
  description?: string;
  descriptionHighlighted?: string;
  price: number;
  salePrice?: number;
  category?: { id: string; name: string };
  vendor?: { id: string; businessName: string };
  inStock: boolean;
  stock: number;
  rating?: number;
  images?: string[];
  score?: number;
}

export interface SearchResponse {
  hits: ProductSearchResult[];
  totalHits: number;
  processingTimeMs: number;
  query: string;
  normalizedQuery: string;
  tokens: string[];
  facetDistribution?: Record<string, Record<string, number>>;
  suggestions?: string[];
}

@Injectable()
export class ProductSearchService implements OnModuleInit {
  private productNamesCache: string[] = [];
  private lastCacheUpdate: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEARCH_TOKENS.PERSIAN_TOKENIZER)
    private readonly persianTokenizer: PersianTokenizer,
    @Inject(SEARCH_TOKENS.SEARCH_SERVICE)
    private readonly searchService: SearchService,
  ) {}

  async onModuleInit() {
    // Initialize product names cache on startup
    await this.refreshProductNamesCache();
  }

  /**
   * Ã” ÃÊÌ „Õ’Ê·«  »« Å‘ Ì»«‰Ì ›«—”Ì
   * Requirements: 8.1, 8.2, 8.3
   */
  async search(options: ProductSearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    const { query, filters, limit = 20, offset = 0, sort, facets } = options;

    // Normalize and tokenize the query
    const normalizedQuery = this.persianTokenizer.normalize(query);
    const tokenizeResult = this.persianTokenizer.tokenize(query);
    const tokens = tokenizeResult.tokens;

    // Try MeiliSearch first if available
    try {
      const meiliHealthy = await this.searchService.isHealthy();
      if (meiliHealthy) {
        return this.searchWithMeili(options, normalizedQuery, tokens, startTime);
      }
    } catch {
      // Fall back to database search
    }

    // Fallback to database search with Persian support
    return this.searchWithDatabase(options, normalizedQuery, tokens, startTime);
  }

  /**
   * Ã” ÃÊ »« MeiliSearch
   */
  private async searchWithMeili(
    options: ProductSearchOptions,
    normalizedQuery: string,
    tokens: string[],
    startTime: number,
  ): Promise<SearchResponse> {
    const { filters, limit = 20, offset = 0, sort, facets } = options;

    // Build MeiliSearch filters
    const meiliFilters: Record<string, string | string[] | number | number[]> = {};
    if (filters?.categoryId) meiliFilters.categoryId = filters.categoryId;
    if (filters?.brandId) meiliFilters.brandId = filters.brandId;
    if (filters?.vendorId) meiliFilters.vendorId = filters.vendorId;
    if (filters?.inStockOnly) meiliFilters.inStock = 1;
    if (filters?.status) meiliFilters.status = filters.status;

    const result = await this.searchService.search('products', {
      q: normalizedQuery,
      filters: Object.keys(meiliFilters).length > 0 ? meiliFilters : undefined,
      facets,
      sort,
      limit,
      offset,
      attributesToHighlight: ['name', 'description'],
    });

    const hits: ProductSearchResult[] = result.hits.map(hit => {
      const doc = hit.document as Record<string, unknown>;
      const formatted = hit._formatted as Record<string, string> | undefined;
      
      return {
        id: doc.id as string,
        name: doc.name as string,
        nameHighlighted: formatted?.name,
        description: doc.description as string | undefined,
        descriptionHighlighted: formatted?.description,
        price: doc.price as number,
        salePrice: doc.salePrice as number | undefined,
        category: doc.category as { id: string; name: string } | undefined,
        vendor: doc.vendor as { id: string; businessName: string } | undefined,
        inStock: (doc.stock as number) > 0,
        stock: doc.stock as number,
        rating: doc.rating as number | undefined,
        images: doc.images as string[] | undefined,
      };
    });

    // Generate suggestions if few results
    let suggestions: string[] | undefined;
    if (hits.length < 3) {
      suggestions = await this.getSuggestions(normalizedQuery, 5);
    }

    return {
      hits,
      totalHits: result.totalHits,
      processingTimeMs: Date.now() - startTime,
      query: options.query,
      normalizedQuery,
      tokens,
      facetDistribution: result.facetDistribution,
      suggestions,
    };
  }

  /**
   * Ã” ÃÊ »« œÌ «»Ì” (fallback)
   * Requirements: 8.1, 8.2, 8.3
   */
  private async searchWithDatabase(
    options: ProductSearchOptions,
    normalizedQuery: string,
    tokens: string[],
    startTime: number,
  ): Promise<SearchResponse> {
    const { filters, limit = 20, offset = 0 } = options;

    // Build database where clause
    const where: Record<string, unknown> = {
      status: filters?.status || 'ACTIVE',
    };

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.vendorId) where.vendorId = filters.vendorId;
    if (filters?.inStockOnly) where.stock = { gt: 0 };
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters?.minPrice !== undefined) (where.price as Record<string, number>).gte = filters.minPrice;
      if (filters?.maxPrice !== undefined) (where.price as Record<string, number>).lte = filters.maxPrice;
    }

    // Build search conditions using tokens
    if (tokens.length > 0) {
      where.OR = [
        // Search in name
        ...tokens.map(token => ({
          name: { contains: token, mode: 'insensitive' as const },
        })),
        // Search in description
        ...tokens.map(token => ({
          description: { contains: token, mode: 'insensitive' as const },
        })),
        // Search with normalized query
        { name: { contains: normalizedQuery, mode: 'insensitive' as const } },
        { description: { contains: normalizedQuery, mode: 'insensitive' as const } },
      ];
    }

    // Execute search
    const [products, totalCount] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          vendor: { select: { id: true, businessName: true } },
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Highlight search terms in results
    const hits: ProductSearchResult[] = products.map(product => ({
      id: product.id,
      name: product.name,
      nameHighlighted: this.persianTokenizer.highlight(product.name, tokens, 'mark'),
      description: product.description || undefined,
      descriptionHighlighted: product.description 
        ? this.persianTokenizer.highlight(product.description, tokens, 'mark')
        : undefined,
      price: product.price.toNumber(),
      salePrice: product.salePrice?.toNumber(),
      category: product.category ? { id: product.category.id, name: product.category.name } : undefined,
      vendor: product.vendor ? { id: product.vendor.id, businessName: product.vendor.businessName } : undefined,
      inStock: product.stock > 0,
      stock: product.stock,
      rating: product.rating?.toNumber(),
      images: product.images as string[] | undefined,
    }));

    // Generate suggestions if few results
    let suggestions: string[] | undefined;
    if (hits.length < 3) {
      suggestions = await this.getSuggestions(normalizedQuery, 5);
    }

    return {
      hits,
      totalHits: totalCount,
      processingTimeMs: Date.now() - startTime,
      query: options.query,
      normalizedQuery,
      tokens,
      suggestions,
    };
  }

  /**
   * ÅÌ‘‰Â«œ Ã” ÃÊ (autocomplete)
   * Requirements: 8.2
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    await this.ensureCacheIsFresh();
    
    const normalizedPrefix = this.persianTokenizer.normalize(prefix);
    return this.persianTokenizer.generateSuggestions(
      normalizedPrefix,
      this.productNamesCache,
      limit,
    );
  }

  /**
   * Ã” ÃÊÌ fuzzy
   * Requirements: 8.2
   */
  async fuzzySearch(query: string, threshold: number = 0.6, limit: number = 10): Promise<string[]> {
    await this.ensureCacheIsFresh();
    
    const normalizedQuery = this.persianTokenizer.normalize(query);
    return this.persianTokenizer.fuzzySearch(
      normalizedQuery,
      this.productNamesCache,
      threshold,
    ).slice(0, limit);
  }

  /**
   * «Ì‰œò” ò—œ‰ „Õ’Ê· œ— MeiliSearch
   */
  async indexProduct(product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    salePrice?: number;
    categoryId?: string;
    vendorId?: string;
    stock: number;
    status: string;
    images?: string[];
    rating?: number;
  }): Promise<void> {
    try {
      const meiliHealthy = await this.searchService.isHealthy();
      if (!meiliHealthy) return;

      // Tokenize name and description for better search
      const nameTokens = this.persianTokenizer.tokenize(product.name).tokens;
      const descTokens = product.description 
        ? this.persianTokenizer.tokenize(product.description).tokens 
        : [];

      await this.searchService.indexDocuments('products', [{
        id: product.id,
        name: product.name,
        nameTokens,
        description: product.description,
        descTokens,
        price: product.price,
        salePrice: product.salePrice,
        categoryId: product.categoryId,
        vendorId: product.vendorId,
        stock: product.stock,
        inStock: product.stock > 0 ? 1 : 0,
        status: product.status,
        images: product.images,
        rating: product.rating,
      }]);

      // Invalidate cache
      this.lastCacheUpdate = null;
    } catch (error) {
      console.error('Failed to index product:', error);
    }
  }

  /**
   * Õ–› „Õ’Ê· «“ «Ì‰œò”
   */
  async removeFromIndex(productId: string): Promise<void> {
    try {
      const meiliHealthy = await this.searchService.isHealthy();
      if (!meiliHealthy) return;

      await this.searchService.deleteDocuments('products', [productId]);
      
      // Invalidate cache
      this.lastCacheUpdate = null;
    } catch (error) {
      console.error('Failed to remove product from index:', error);
    }
  }

  /**
   * »Âù—Ê“—”«‰Ì ò‘ ‰«„ „Õ’Ê·« 
   */
  private async refreshProductNamesCache(): Promise<void> {
    try {
      const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { name: true },
        take: 10000, // Limit for performance
      });

      this.productNamesCache = products.map(p => p.name);
      this.lastCacheUpdate = new Date();
    } catch (error) {
      console.error('Failed to refresh product names cache:', error);
    }
  }

  /**
   * «ÿ„Ì‰«‰ «“  «“Â »Êœ‰ ò‘
   */
  private async ensureCacheIsFresh(): Promise<void> {
    const now = new Date();
    if (
      !this.lastCacheUpdate ||
      now.getTime() - this.lastCacheUpdate.getTime() > this.CACHE_TTL_MS
    ) {
      await this.refreshProductNamesCache();
    }
  }

  /**
   * «Ì‰œò” ò—œ‰ Â„Â „Õ’Ê·«  (»—«Ì —«Âù«‰œ«“Ì «Ê·ÌÂ)
   */
  async reindexAllProducts(): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;

    const batchSize = 100;
    let skip = 0;

    while (true) {
      const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        include: {
          category: { select: { id: true, name: true } },
          vendor: { select: { id: true, businessName: true } },
        },
        take: batchSize,
        skip,
      });

      if (products.length === 0) break;

      for (const product of products) {
        try {
          await this.indexProduct({
            id: product.id,
            name: product.name,
            description: product.description || undefined,
            price: product.price.toNumber(),
            salePrice: product.salePrice?.toNumber(),
            categoryId: product.categoryId || undefined,
            vendorId: product.vendorId,
            stock: product.stock,
            status: product.status,
            images: product.images as string[] | undefined,
            rating: product.rating?.toNumber(),
          });
          indexed++;
        } catch {
          failed++;
        }
      }

      skip += batchSize;
    }

    // Refresh cache after reindexing
    await this.refreshProductNamesCache();

    return { indexed, failed };
  }
}

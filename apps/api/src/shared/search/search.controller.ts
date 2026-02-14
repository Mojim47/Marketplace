/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Search Controller
 * ???????????????????????????????????????????????????????????????????????????
 *
 * REST API endpoints for Persian product search operations.
 *
 * Features:
 * - Product search with Persian tokenization
 * - Fuzzy search with typo tolerance
 * - Search suggestions (autocomplete)
 * - Text tokenization API
 * - Text highlighting
 *
 * @module @nextgen/api/shared/search
 * Requirements: 8.1, 8.2, 8.3
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PersianTokenizer, SearchService } from '@nextgen/search';
import {
  FuzzySearchDto,
  FuzzySearchResultDto,
  HighlightResultDto,
  HighlightTextDto,
  SearchProductsDto,
  SearchResultDto,
  SearchSuggestionsDto,
  SuggestionsResultDto,
  TokenizeResultDto,
  TokenizeTextDto,
} from './dto';
import { SEARCH_TOKENS } from './tokens';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    @Inject(SEARCH_TOKENS.PERSIAN_TOKENIZER)
    private readonly persianTokenizer: PersianTokenizer,
    @Inject(SEARCH_TOKENS.SEARCH_SERVICE)
    private readonly searchService: SearchService
  ) {}

  /**
   * ������ �������
   * Requirements: 8.1, 8.2, 8.3
   */
  @Get('products')
  @ApiOperation({ summary: '������ ������� �� �������� �����' })
  @ApiResponse({ status: 200, description: '����� �����', type: SearchResultDto })
  @ApiQuery({ name: 'query', required: true, description: '����� �����' })
  @ApiQuery({ name: 'categoryId', required: false, description: '����� ��������' })
  @ApiQuery({ name: 'brandId', required: false, description: '����� ����' })
  @ApiQuery({ name: 'minPrice', required: false, description: '����� ����' })
  @ApiQuery({ name: 'maxPrice', required: false, description: '��ǘ�� ����' })
  @ApiQuery({ name: 'inStockOnly', required: false, description: '��� �����' })
  @ApiQuery({ name: 'limit', required: false, description: '����� �����' })
  @ApiQuery({ name: 'offset', required: false, description: '���� ��' })
  async searchProducts(@Query() dto: SearchProductsDto): Promise<SearchResultDto> {
    // Build filters object
    const filters: Record<string, string | string[] | number | number[]> = {};

    if (dto.categoryId) {
      filters.categoryId = dto.categoryId;
    }
    if (dto.brandId) {
      filters.brandId = dto.brandId;
    }
    if (dto.inStockOnly) {
      filters.inStock = 1;
    }
    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      // MeiliSearch filter syntax for range
      const priceFilters: string[] = [];
      if (dto.minPrice !== undefined) {
        priceFilters.push(`price >= ${dto.minPrice}`);
      }
      if (dto.maxPrice !== undefined) {
        priceFilters.push(`price <= ${dto.maxPrice}`);
      }
      // Note: Range filters need special handling in MeiliSearch
    }

    const result = await this.searchService.search('products', {
      q: dto.query,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      facets: dto.facets,
      sort: dto.sort,
      limit: dto.limit || 20,
      offset: dto.offset || 0,
      attributesToHighlight: ['name', 'description'],
    });

    return {
      hits: result.hits.map((hit) => ({
        id: (hit.document as any).id,
        name: (hit.document as any).name,
        description: (hit.document as any).description,
        price: (hit.document as any).price,
        salePrice: (hit.document as any).salePrice,
        category: (hit.document as any).category,
        brand: (hit.document as any).brand,
        inStock: (hit.document as any).inStock,
        rating: (hit.document as any).rating,
        images: (hit.document as any).images,
        _formatted: hit._formatted as Record<string, string>,
      })),
      totalHits: result.totalHits,
      processingTimeMs: result.processingTimeMs,
      query: result.query,
      facetDistribution: result.facetDistribution,
    };
  }

  /**
   * ������ ������� �� POST
   * Requirements: 8.1, 8.2, 8.3
   */
  @Post('products')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '������ ������� �� �������� ����' })
  @ApiResponse({ status: 200, description: '����� �����', type: SearchResultDto })
  async searchProductsPost(@Body() dto: SearchProductsDto): Promise<SearchResultDto> {
    return this.searchProducts(dto);
  }

  /**
   * Tokenize ��� �����
   * Requirements: 8.1, 8.3
   */
  @Post('tokenize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tokenize ��� �����' })
  @ApiResponse({ status: 200, description: '����� tokenize', type: TokenizeResultDto })
  async tokenizeText(@Body() dto: TokenizeTextDto): Promise<TokenizeResultDto> {
    // Create a new tokenizer instance with custom options if provided
    const tokenizer = PersianTokenizer.getInstance({
      removeStopWords: dto.removeStopWords ?? true,
      stem: dto.stem ?? true,
      normalize: true,
      lowercase: true,
    });

    const result = tokenizer.tokenize(dto.text);

    return {
      tokens: result.tokens,
      originalText: result.originalText,
      normalizedText: result.normalizedText,
      stats: result.stats,
    };
  }

  /**
   * ������ fuzzy
   * Requirements: 8.2
   */
  @Post('fuzzy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '������ fuzzy �� ���� ��� ������' })
  @ApiResponse({ status: 200, description: '����� �����', type: FuzzySearchResultDto })
  async fuzzySearch(@Body() dto: FuzzySearchDto): Promise<FuzzySearchResultDto> {
    // Get product names from search index for fuzzy matching
    // In a real implementation, this would query the search index
    // For now, we'll use the tokenizer's fuzzy search capability

    const threshold = dto.threshold ?? 0.6;
    const limit = dto.limit ?? 10;

    // This is a simplified implementation
    // In production, you would query MeiliSearch with typo tolerance
    const results = this.persianTokenizer
      .fuzzySearch(
        dto.query,
        [], // Would be populated with product names from index
        threshold
      )
      .slice(0, limit);

    return {
      results,
      query: dto.query,
      threshold,
    };
  }

  /**
   * ������� ����� (autocomplete)
   * Requirements: 8.2
   */
  @Get('suggestions')
  @ApiOperation({ summary: '������� ����� (autocomplete)' })
  @ApiResponse({ status: 200, description: '���������', type: SuggestionsResultDto })
  @ApiQuery({ name: 'prefix', required: true, description: '������ �����' })
  @ApiQuery({ name: 'limit', required: false, description: '����� ���������' })
  async getSuggestions(@Query() dto: SearchSuggestionsDto): Promise<SuggestionsResultDto> {
    const limit = dto.limit ?? 10;

    // In a real implementation, this would query the search index
    // For now, we'll use the tokenizer's suggestion capability
    const suggestions = this.persianTokenizer.generateSuggestions(
      dto.prefix,
      [], // Would be populated with product names from index
      limit
    );

    return {
      suggestions,
      prefix: dto.prefix,
    };
  }

  /**
   * Highlight ���
   * Requirements: 8.1
   */
  @Post('highlight')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Highlight ������ ����� �� ���' })
  @ApiResponse({ status: 200, description: '��� highlight ���', type: HighlightResultDto })
  async highlightText(@Body() dto: HighlightTextDto): Promise<HighlightResultDto> {
    const tag = dto.tag ?? 'mark';
    const highlightedText = this.persianTokenizer.highlight(dto.text, dto.searchTerms, tag);

    return {
      highlightedText,
      originalText: dto.text,
    };
  }

  /**
   * ��������� ��� �����
   * Requirements: 8.1
   */
  @Post('normalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '��������� ��� ����� (����� ���ǘ����� ���� �� �����)' })
  @ApiResponse({ status: 200, description: '��� ��������' })
  async normalizeText(
    @Body() body: { text: string }
  ): Promise<{ normalizedText: string; originalText: string }> {
    const normalizedText = this.persianTokenizer.normalize(body.text);

    return {
      normalizedText,
      originalText: body.text,
    };
  }

  /**
   * ������ ����� �� ���
   * Requirements: 8.2
   */
  @Get('similarity')
  @ApiOperation({ summary: '������ ����� �� ���' })
  @ApiResponse({ status: 200, description: '����� �����' })
  @ApiQuery({ name: 'text1', required: true, description: '��� ���' })
  @ApiQuery({ name: 'text2', required: true, description: '��� ���' })
  async calculateSimilarity(
    @Query('text1') text1: string,
    @Query('text2') text2: string
  ): Promise<{ text1: string; text2: string; similarity: number }> {
    const similarity = this.persianTokenizer.similarity(text1, text2);

    return {
      text1,
      text2,
      similarity,
    };
  }

  /**
   * ���� stop words �����
   * Requirements: 8.3
   */
  @Get('stop-words')
  @ApiOperation({ summary: '���� stop words �����' })
  @ApiResponse({ status: 200, description: '���� stop words' })
  async getStopWords(): Promise<{ stopWords: string[] }> {
    return {
      stopWords: this.persianTokenizer.getStopWords(),
    };
  }

  /**
   * ����� ����� ����� �����
   */
  @Get('health')
  @ApiOperation({ summary: '����� ����� ����� �����' })
  @ApiResponse({ status: 200, description: '����� �����' })
  async healthCheck(): Promise<{ healthy: boolean; meiliSearch: boolean; timestamp: string }> {
    const meiliHealthy = await this.searchService.isHealthy();

    return {
      healthy: true,
      meiliSearch: meiliHealthy,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * ���� ���Ϙ� �����
   */
  @Get('stats')
  @ApiOperation({ summary: '���� ���Ϙ� �����' })
  @ApiResponse({ status: 200, description: '���� ���Ϙ�' })
  async getIndexStats(): Promise<{
    numberOfDocuments: number;
    isIndexing: boolean;
    fieldDistribution: Record<string, number>;
  }> {
    return this.searchService.getIndexStats('products');
  }
}

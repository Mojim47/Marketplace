/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Search DTOs
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Data Transfer Objects for Persian search operations.
 *
 * @module @nextgen/api/shared/search
 * Requirements: 8.1, 8.2, 8.3
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * ������ �������
 */
export class SearchProductsDto {
  @ApiProperty({ description: '����� ����� (����� �� ������)' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: '����� �������� ���� �����' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '����� ���� ���� �����' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: '����� ����' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ description: '��ǘ�� ����' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ description: '��� ������� �����', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  inStockOnly?: boolean;

  @ApiPropertyOptional({ description: '����� �����', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: '���� ��', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiPropertyOptional({ description: '���ȝ����', example: ['price:asc', 'rating:desc'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sort?: string[];

  @ApiPropertyOptional({
    description: '������� facet ���� �����',
    example: ['categoryId', 'brandId'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facets?: string[];
}

/**
 * ������ fuzzy
 */
export class FuzzySearchDto {
  @ApiProperty({ description: '����� �����' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: '������ ����� (0 �� 1)', default: 0.6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  threshold?: number;

  @ApiPropertyOptional({ description: '��ǘ�� ����� �����', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

/**
 * ������� ����� (autocomplete)
 */
export class SearchSuggestionsDto {
  @ApiProperty({ description: '������ �����' })
  @IsString()
  prefix: string;

  @ApiPropertyOptional({ description: '��ǘ�� ����� ���������', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number;
}

/**
 * Tokenize ��� �����
 */
export class TokenizeTextDto {
  @ApiProperty({ description: '��� ���� tokenize' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: '��� stop words', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  removeStopWords?: boolean;

  @ApiPropertyOptional({ description: '����� stemming', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  stem?: boolean;
}

/**
 * Highlight ���
 */
export class HighlightTextDto {
  @ApiProperty({ description: '��� ����' })
  @IsString()
  text: string;

  @ApiProperty({ description: '������ ����� ���� highlight' })
  @IsArray()
  @IsString({ each: true })
  searchTerms: string[];

  @ApiPropertyOptional({ description: 'ʐ HTML ���� highlight', default: 'mark' })
  @IsOptional()
  @IsString()
  tag?: string;
}

// ???????????????????????????????????????????????????????????????????????????
// Response DTOs
// ???????????????????????????????????????????????????????????????????????????

/**
 * ����� ������ �����
 */
export class ProductSearchHitDto {
  @ApiProperty({ description: '����� �����' })
  id: string;

  @ApiProperty({ description: '��� �����' })
  name: string;

  @ApiPropertyOptional({ description: '�������' })
  description?: string;

  @ApiProperty({ description: '����' })
  price: number;

  @ApiPropertyOptional({ description: '���� ����ݝ�����' })
  salePrice?: number;

  @ApiPropertyOptional({ description: '��������' })
  category?: string;

  @ApiPropertyOptional({ description: '����' })
  brand?: string;

  @ApiProperty({ description: '������' })
  inStock: boolean;

  @ApiPropertyOptional({ description: '������' })
  rating?: number;

  @ApiPropertyOptional({ description: '������' })
  images?: string[];

  @ApiPropertyOptional({ description: '��� highlight ���' })
  _formatted?: Record<string, string>;
}

/**
 * ����� �����
 */
export class SearchResultDto {
  @ApiProperty({ description: '����� �����', type: [ProductSearchHitDto] })
  hits: ProductSearchHitDto[];

  @ApiProperty({ description: '����� �� �����' })
  totalHits: number;

  @ApiProperty({ description: '���� ������ �� ���������' })
  processingTimeMs: number;

  @ApiProperty({ description: '����� �����' })
  query: string;

  @ApiPropertyOptional({ description: '����� facet���' })
  facetDistribution?: Record<string, Record<string, number>>;
}

/**
 * ����� tokenize
 */
export class TokenizeResultDto {
  @ApiProperty({ description: '������ ������� ���' })
  tokens: Array<{
    text: string;
    position: number;
    startOffset: number;
    endOffset: number;
    type: 'word' | 'number' | 'mixed';
  }>;

  @ApiProperty({ description: '��� ����' })
  originalText: string;

  @ApiProperty({ description: '��� ��������' })
  normalizedText: string;

  @ApiProperty({ description: '����' })
  stats: {
    totalTokens: number;
    uniqueTokens: number;
    removedStopWords: number;
  };
}

/**
 * ����� �������
 */
export class SuggestionsResultDto {
  @ApiProperty({ description: '���������' })
  suggestions: string[];

  @ApiProperty({ description: '������ �����' })
  prefix: string;
}

/**
 * ����� highlight
 */
export class HighlightResultDto {
  @ApiProperty({ description: '��� highlight ���' })
  highlightedText: string;

  @ApiProperty({ description: '��� ����' })
  originalText: string;
}

/**
 * ����� fuzzy search
 */
export class FuzzySearchResultDto {
  @ApiProperty({ description: '����� �����' })
  results: string[];

  @ApiProperty({ description: '����� �����' })
  query: string;

  @ApiProperty({ description: '������ �����' })
  threshold: number;
}

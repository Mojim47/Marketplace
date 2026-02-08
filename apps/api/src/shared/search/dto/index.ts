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

import { IsString, IsOptional, IsNumber, Min, Max, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Ã” ÃÊÌ „Õ’Ê·« 
 */
export class SearchProductsDto {
  @ApiProperty({ description: '⁄»«—  Ã” ÃÊ (›«—”Ì Ì« «‰ê·Ì”Ì)' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: '‘‰«”Â œ” Âù»‰œÌ »—«Ì ›Ì· —' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '‘‰«”Â »—‰œ »—«Ì ›Ì· —' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Õœ«ﬁ· ﬁÌ„ ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Õœ«òÀ— ﬁÌ„ ' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ description: '›ﬁÿ „Õ’Ê·«  „ÊÃÊœ', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  inStockOnly?: boolean;

  @ApiPropertyOptional({ description: ' ⁄œ«œ ‰ «ÌÃ', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: '‘—Ê⁄ «“', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiPropertyOptional({ description: '„— »ù”«“Ì', example: ['price:asc', 'rating:desc'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sort?: string[];

  @ApiPropertyOptional({ description: '›Ì·œÂ«Ì facet »—«Ì ›Ì· —', example: ['categoryId', 'brandId'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facets?: string[];
}

/**
 * Ã” ÃÊÌ fuzzy
 */
export class FuzzySearchDto {
  @ApiProperty({ description: '⁄»«—  Ã” ÃÊ' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: '¬” «‰Â ‘»«Â  (0  « 1)', default: 0.6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  threshold?: number;

  @ApiPropertyOptional({ description: 'Õœ«òÀ—  ⁄œ«œ ‰ «ÌÃ', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

/**
 * ÅÌ‘‰Â«œ Ã” ÃÊ (autocomplete)
 */
export class SearchSuggestionsDto {
  @ApiProperty({ description: 'ÅÌ‘Ê‰œ Ã” ÃÊ' })
  @IsString()
  prefix: string;

  @ApiPropertyOptional({ description: 'Õœ«òÀ—  ⁄œ«œ ÅÌ‘‰Â«œ« ', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number;
}

/**
 * Tokenize „ ‰ ›«—”Ì
 */
export class TokenizeTextDto {
  @ApiProperty({ description: '„ ‰ »—«Ì tokenize' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Õ–› stop words', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  removeStopWords?: boolean;

  @ApiPropertyOptional({ description: '«⁄„«· stemming', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  stem?: boolean;
}

/**
 * Highlight „ ‰
 */
export class HighlightTextDto {
  @ApiProperty({ description: '„ ‰ «’·Ì' })
  @IsString()
  text: string;

  @ApiProperty({ description: '⁄»«—«  Ã” ÃÊ »—«Ì highlight' })
  @IsArray()
  @IsString({ each: true })
  searchTerms: string[];

  @ApiPropertyOptional({ description: ' ê HTML »—«Ì highlight', default: 'mark' })
  @IsOptional()
  @IsString()
  tag?: string;
}

// ???????????????????????????????????????????????????????????????????????????
// Response DTOs
// ???????????????????????????????????????????????????????????????????????????

/**
 * ‰ ÌÃÂ Ã” ÃÊÌ „Õ’Ê·
 */
export class ProductSearchHitDto {
  @ApiProperty({ description: '‘‰«”Â „Õ’Ê·' })
  id: string;

  @ApiProperty({ description: '‰«„ „Õ’Ê·' })
  name: string;

  @ApiPropertyOptional({ description: ' Ê÷ÌÕ« ' })
  description?: string;

  @ApiProperty({ description: 'ﬁÌ„ ' })
  price: number;

  @ApiPropertyOptional({ description: 'ﬁÌ„   Œ›Ì›ùŒÊ—œÂ' })
  salePrice?: number;

  @ApiPropertyOptional({ description: 'œ” Âù»‰œÌ' })
  category?: string;

  @ApiPropertyOptional({ description: '»—‰œ' })
  brand?: string;

  @ApiProperty({ description: '„ÊÃÊœÌ' })
  inStock: boolean;

  @ApiPropertyOptional({ description: '«„ Ì«“' })
  rating?: number;

  @ApiPropertyOptional({ description: ' ’«ÊÌ—' })
  images?: string[];

  @ApiPropertyOptional({ description: '„ ‰ highlight ‘œÂ' })
  _formatted?: Record<string, string>;
}

/**
 * ‰ ÌÃÂ Ã” ÃÊ
 */
export class SearchResultDto {
  @ApiProperty({ description: '‰ «ÌÃ Ã” ÃÊ', type: [ProductSearchHitDto] })
  hits: ProductSearchHitDto[];

  @ApiProperty({ description: ' ⁄œ«œ ò· ‰ «ÌÃ' })
  totalHits: number;

  @ApiProperty({ description: '“„«‰ Å—œ«“‘ »Â „Ì·ÌùÀ«‰ÌÂ' })
  processingTimeMs: number;

  @ApiProperty({ description: '⁄»«—  Ã” ÃÊ' })
  query: string;

  @ApiPropertyOptional({ description: ' Ê“Ì⁄ facetùÂ«' })
  facetDistribution?: Record<string, Record<string, number>>;
}

/**
 * ‰ ÌÃÂ tokenize
 */
export class TokenizeResultDto {
  @ApiProperty({ description: ' Êò‰ùÂ«Ì «” Œ—«Ã ‘œÂ' })
  tokens: Array<{
    text: string;
    position: number;
    startOffset: number;
    endOffset: number;
    type: 'word' | 'number' | 'mixed';
  }>;

  @ApiProperty({ description: '„ ‰ «’·Ì' })
  originalText: string;

  @ApiProperty({ description: '„ ‰ ‰—„«·ù‘œÂ' })
  normalizedText: string;

  @ApiProperty({ description: '¬„«—' })
  stats: {
    totalTokens: number;
    uniqueTokens: number;
    removedStopWords: number;
  };
}

/**
 * ‰ ÌÃÂ ÅÌ‘‰Â«œ
 */
export class SuggestionsResultDto {
  @ApiProperty({ description: 'ÅÌ‘‰Â«œ« ' })
  suggestions: string[];

  @ApiProperty({ description: 'ÅÌ‘Ê‰œ Ã” ÃÊ' })
  prefix: string;
}

/**
 * ‰ ÌÃÂ highlight
 */
export class HighlightResultDto {
  @ApiProperty({ description: '„ ‰ highlight ‘œÂ' })
  highlightedText: string;

  @ApiProperty({ description: '„ ‰ «’·Ì' })
  originalText: string;
}

/**
 * ‰ ÌÃÂ fuzzy search
 */
export class FuzzySearchResultDto {
  @ApiProperty({ description: '‰ «ÌÃ „‘«»Â' })
  results: string[];

  @ApiProperty({ description: '⁄»«—  Ã” ÃÊ' })
  query: string;

  @ApiProperty({ description: '¬” «‰Â ‘»«Â ' })
  threshold: number;
}

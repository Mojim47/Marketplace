/**
 * DTO for product search with Persian support
 * Requirements: 8.1, 8.2, 8.3
 */

import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, IsInt } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchProductsDto {
  @ApiProperty({ description: '⁄»«—  Ã” ÃÊ', example: '‘Ì—¬·« ' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: '‘‰«”Â œ” Âù»‰œÌ' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '‘‰«”Â ›—Ê‘‰œÂ' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ description: '‘‰«”Â »—‰œ' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Õœ«ﬁ· ﬁÌ„ ', example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Õœ«òÀ— ﬁÌ„ ', example: 10000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: '›ﬁÿ „Õ’Ê·«  „ÊÃÊœ', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStockOnly?: boolean;

  @ApiPropertyOptional({ description: ' ⁄œ«œ ‰ «ÌÃ', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '‘—Ê⁄ «“', example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: '„— »ù”«“Ì', example: 'price:asc' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: '›Ì·œÂ«Ì facet', example: ['categoryId', 'brandId'] })
  @IsOptional()
  @IsString({ each: true })
  facets?: string[];
}

/**
 * DTO for product search with Persian support
 * Requirements: 8.1, 8.2, 8.3
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchProductsDto {
  @ApiProperty({ description: '����� �����', example: '�������' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: '����� ��������' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '����� �������' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ description: '����� ����' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: '����� ����', example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: '��ǘ�� ����', example: 10000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: '��� ������� �����', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStockOnly?: boolean;

  @ApiPropertyOptional({ description: '����� �����', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '���� ��', example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: '���ȝ����', example: 'price:asc' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: '������� facet', example: ['categoryId', 'brandId'] })
  @IsOptional()
  @IsString({ each: true })
  facets?: string[];
}

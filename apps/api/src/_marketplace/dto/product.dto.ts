import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: '��� �����' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'SKU �����' })
  @IsString()
  sku: string;

  @ApiProperty({ description: '����� ��������' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ description: '������� �����' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '������� �����' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiProperty({ description: '����' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: '���� ���� ���' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ description: '���� ��������' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ description: '������' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: '����' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'ʐ���' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '������' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: '�펐���� �����' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ description: '����� ���' })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ description: '������� ���' })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ description: '����� �����' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ description: '���ǐ' })
  @IsOptional()
  @IsString()
  slug?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductSearchDto {
  @ApiPropertyOptional({ description: '����� �����' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: '����� ��������' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

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

  @ApiPropertyOptional({ description: '��� �����' })
  @IsOptional()
  inStock?: boolean;

  @ApiPropertyOptional({
    description: '���ȝ���� �� ����',
    enum: ['createdAt', 'price', 'name', 'rating'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: '�����', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: '����' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: '����� �� ����' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class CreateVariantDto {
  @ApiProperty({ description: '��� �������' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'SKU �������' })
  @IsString()
  sku: string;

  @ApiPropertyOptional({ description: '����' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: '������' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: '�펐���� �������' })
  @IsOptional()
  @IsObject()
  variantAttributes?: Record<string, any>;
}

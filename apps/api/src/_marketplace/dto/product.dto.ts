import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: '‰«„ „Õ’Ê·' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'SKU „Õ’Ê·' })
  @IsString()
  sku: string;

  @ApiProperty({ description: '‘‰«”Â œ” Âù»‰œÌ' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ description: ' Ê÷ÌÕ«  „Õ’Ê·' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: ' Ê÷ÌÕ«  òÊ «Â' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiProperty({ description: 'ﬁÌ„ ' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'ﬁÌ„   „«„ ‘œÂ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ description: 'ﬁÌ„  „ﬁ«Ì”Âù«Ì' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ description: '„ÊÃÊœÌ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: '»—‰œ' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: ' êùÂ«' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: ' ’«ÊÌ—' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'ÊÌéêÌùÂ«Ì „Õ’Ê·' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ description: '⁄‰Ê«‰ „ «' })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ description: ' Ê÷ÌÕ«  „ «' })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'ò·„«  ò·ÌœÌ' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ description: '«”·«ê' })
  @IsOptional()
  @IsString()
  slug?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductSearchDto {
  @ApiPropertyOptional({ description: '⁄»«—  Ã” ÃÊ' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: '‘‰«”Â œ” Âù»‰œÌ' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

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

  @ApiPropertyOptional({ description: '›ﬁÿ „ÊÃÊœ' })
  @IsOptional()
  inStock?: boolean;

  @ApiPropertyOptional({ description: '„— »ù”«“Ì »— «”«”', enum: ['createdAt', 'price', 'name', 'rating'] })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: ' — Ì»', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: '’›ÕÂ' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: ' ⁄œ«œ œ— ’›ÕÂ' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class CreateVariantDto {
  @ApiProperty({ description: '‰«„ Ê«—Ì«‰ ' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'SKU Ê«—Ì«‰ ' })
  @IsString()
  sku: string;

  @ApiPropertyOptional({ description: 'ﬁÌ„ ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: '„ÊÃÊœÌ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: 'ÊÌéêÌùÂ«Ì Ê«—Ì«‰ ' })
  @IsOptional()
  @IsObject()
  variantAttributes?: Record<string, any>;
}

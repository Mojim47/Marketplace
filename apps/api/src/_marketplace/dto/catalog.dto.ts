import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class AttributeDefinitionDto {
  @ApiProperty({ description: '‰«„ ÊÌéêÌ' })
  @IsString()
  name: string;

  @ApiProperty({ description: '‰Ê⁄ ÊÌéêÌ', enum: ['string', 'number', 'boolean', 'select', 'multiselect'] })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: '«·“«„Ì' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'ê“Ì‰ÂùÂ« (»—«Ì select/multiselect)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ description: '„ﬁœ«— ÅÌ‘ù›—÷' })
  @IsOptional()
  defaultValue?: any;
}

export class CreateCategoryDto {
  @ApiProperty({ description: '‰«„ œ” Âù»‰œÌ' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '«”·«ê' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: ' Ê÷ÌÕ« ' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: ' ’ÊÌ—' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: '¬ÌòÊ‰' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '‘‰«”Â Ê«·œ' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: ' — Ì» ‰„«Ì‘' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: ' Œ›Ì› „Ã—Ì' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  executorDiscount?: number;

  @ApiPropertyOptional({ type: [AttributeDefinitionDto], description: '«”òÌ„«Ì ÊÌéêÌùÂ«' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeDefinitionDto)
  attributeSchema?: AttributeDefinitionDto[];

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
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({ description: '›⁄«·/€Ì—›⁄«·' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MoveCategoryDto {
  @ApiPropertyOptional({ description: '‘‰«”Â Ê«·œ ÃœÌœ (null »—«Ì —Ì‘Â)' })
  @IsOptional()
  @IsUUID()
  newParentId?: string;
}

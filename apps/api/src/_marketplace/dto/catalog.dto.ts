import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttributeDefinitionDto {
  @ApiProperty({ description: '��� �펐�' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '��� �펐�',
    enum: ['string', 'number', 'boolean', 'select', 'multiselect'],
  })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: '������' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: '������� (���� select/multiselect)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ description: '����� ��ԝ���' })
  @IsOptional()
  defaultValue?: any;
}

export class CreateCategoryDto {
  @ApiProperty({ description: '��� ��������' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '���ǐ' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: '�������' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '�����' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: '����' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '����� ����' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: '����� �����' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: '����� ����' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  executorDiscount?: number;

  @ApiPropertyOptional({ type: [AttributeDefinitionDto], description: '�Ә���� �펐���' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeDefinitionDto)
  attributeSchema?: AttributeDefinitionDto[];

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
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({ description: '����/�������' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MoveCategoryDto {
  @ApiPropertyOptional({ description: '����� ���� ���� (null ���� ����)' })
  @IsOptional()
  @IsUUID()
  newParentId?: string;
}

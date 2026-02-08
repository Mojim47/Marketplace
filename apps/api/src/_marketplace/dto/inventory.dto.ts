import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertInventoryDto {
  @ApiProperty({ description: 'ÔäÇÓå æÇÑíÇäÊ' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'ÊÚÏÇÏ ãæÌæÏí' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'ÔäÇÓå ÇäÈÇÑ' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'ÂÓÊÇäå ãæÌæÏí ˜ã' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ description: 'äÞØå ÓÝÇÑÔ ãÌÏÏ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;
}

export class UpdateStockDto {
  @ApiProperty({ description: 'ÊÚÏÇÏ ÌÏíÏ' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Ïáíá ÊÛííÑ' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReserveStockDto {
  @ApiProperty({ description: 'ÔäÇÓå ÂíÊã ãæÌæÏí' })
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty({ description: 'ÊÚÏÇÏ ÑÒÑæ' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'äæÚ ÑÒÑæ', enum: ['CART', 'ORDER'] })
  @IsString()
  type: 'CART' | 'ORDER';

  @ApiPropertyOptional({ description: 'ÔäÇÓå ÓÝÇÑÔ' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'ÔäÇÓå ÓÈÏ ÎÑíÏ' })
  @IsOptional()
  @IsUUID()
  cartId?: string;

  @ApiPropertyOptional({ description: 'ãÏÊ ÇäÞÖÇ (ÏÞíÞå)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expiresInMinutes?: number;
}

export class BulkStockCheckItemDto {
  @ApiProperty({ description: 'ÔäÇÓå æÇÑíÇäÊ' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'ÔäÇÓå ÝÑæÔäÏå' })
  @IsUUID()
  sellerId: string;

  @ApiProperty({ description: 'ÊÚÏÇÏ ÏÑÎæÇÓÊí' })
  @IsNumber()
  @Min(1)
  requestedQuantity: number;
}

export class BulkStockCheckDto {
  @ApiProperty({ type: [BulkStockCheckItemDto], description: 'ÂíÊãåÇ ÈÑÇí ÈÑÑÓí' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockCheckItemDto)
  items: BulkStockCheckItemDto[];
}

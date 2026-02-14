import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpsertInventoryDto {
  @ApiProperty({ description: '����� �������' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: '����� ������' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: '����� �����' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: '������ ������ ��' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ description: '���� ����� ����' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;
}

export class UpdateStockDto {
  @ApiProperty({ description: '����� ����' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: '���� �����' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReserveStockDto {
  @ApiProperty({ description: '����� ���� ������' })
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty({ description: '����� ����' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: '��� ����', enum: ['CART', 'ORDER'] })
  @IsString()
  type: 'CART' | 'ORDER';

  @ApiPropertyOptional({ description: '����� �����' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: '����� ��� ����' })
  @IsOptional()
  @IsUUID()
  cartId?: string;

  @ApiPropertyOptional({ description: '��� ����� (�����)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expiresInMinutes?: number;
}

export class BulkStockCheckItemDto {
  @ApiProperty({ description: '����� �������' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: '����� �������' })
  @IsUUID()
  sellerId: string;

  @ApiProperty({ description: '����� ��������' })
  @IsNumber()
  @Min(1)
  requestedQuantity: number;
}

export class BulkStockCheckDto {
  @ApiProperty({ type: [BulkStockCheckItemDto], description: '������ ���� �����' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockCheckItemDto)
  items: BulkStockCheckItemDto[];
}

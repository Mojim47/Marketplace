import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartItemDto {
  @ApiProperty({ description: '����� �����' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: '����� �������' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: '����� �������' })
  @IsUUID()
  sellerId: string;

  @ApiPropertyOptional({ description: '����� ������� �������' })
  @IsOptional()
  @IsUUID()
  sellerOfferId?: string;

  @ApiProperty({ description: '�����' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: '���� ����' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ description: '��� �����' })
  @IsString()
  productName: string;

  @ApiPropertyOptional({ description: 'SKU �����' })
  @IsOptional()
  @IsString()
  productSku?: string;

  @ApiPropertyOptional({ description: '��� �������' })
  @IsOptional()
  @IsString()
  variantName?: string;
}

export class AddressDto {
  @ApiProperty({ description: '�����' })
  @IsString()
  province: string;

  @ApiProperty({ description: '���' })
  @IsString()
  city: string;

  @ApiProperty({ description: '���� ����' })
  @IsString()
  address: string;

  @ApiProperty({ description: '�� ����' })
  @IsString()
  postalCode: string;

  @ApiPropertyOptional({ description: '��� ������' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ description: '���� ������' })
  @IsOptional()
  @IsString()
  recipientPhone?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [CartItemDto], description: '������� ��� ����' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiPropertyOptional({ description: '����� ����' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: '����� �����' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ description: '���� �����' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ type: AddressDto, description: '���� �����' })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiPropertyOptional({ type: AddressDto, description: '���� ��������' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ description: '��� �����' })
  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @ApiPropertyOptional({ description: '��� ������' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: '������� �����' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: '����� ����',
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: '������� �����' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class UpdateSubOrderStatusDto {
  @ApiProperty({
    description: '����� ����',
    enum: [
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'READY_TO_SHIP',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'RETURNED',
    ],
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: '����� �����' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: '��� �����' })
  @IsOptional()
  @IsString()
  shippingMethod?: string;
}

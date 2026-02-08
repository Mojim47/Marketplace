import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  Min,
  ValidateNested,
  IsEmail,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ description: '‘‰«”Â „Õ’Ê·' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: '‘‰«”Â Ê«—Ì«‰ ' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: '‘‰«”Â ›—Ê‘‰œÂ' })
  @IsUUID()
  sellerId: string;

  @ApiPropertyOptional({ description: '‘‰«”Â ÅÌ‘‰Â«œ ›—Ê‘‰œÂ' })
  @IsOptional()
  @IsUUID()
  sellerOfferId?: string;

  @ApiProperty({ description: ' ⁄œ«œ' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'ﬁÌ„  Ê«Õœ' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ description: '‰«„ „Õ’Ê·' })
  @IsString()
  productName: string;

  @ApiPropertyOptional({ description: 'SKU „Õ’Ê·' })
  @IsOptional()
  @IsString()
  productSku?: string;

  @ApiPropertyOptional({ description: '‰«„ Ê«—Ì«‰ ' })
  @IsOptional()
  @IsString()
  variantName?: string;
}

export class AddressDto {
  @ApiProperty({ description: '«” «‰' })
  @IsString()
  province: string;

  @ApiProperty({ description: '‘Â—' })
  @IsString()
  city: string;

  @ApiProperty({ description: '¬œ—” ò«„·' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'òœ Å” Ì' })
  @IsString()
  postalCode: string;

  @ApiPropertyOptional({ description: '‰«„ êÌ—‰œÂ' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ description: ' ·›‰ êÌ—‰œÂ' })
  @IsOptional()
  @IsString()
  recipientPhone?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [CartItemDto], description: '¬Ì „ùÂ«Ì ”»œ Œ—Ìœ' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiPropertyOptional({ description: '‘‰«”Â Å—ÊéÂ' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: '«Ì„Ì· „‘ —Ì' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ description: ' ·›‰ „‘ —Ì' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ type: AddressDto, description: '¬œ—” «—”«·' })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiPropertyOptional({ type: AddressDto, description: '¬œ—” ’Ê— Õ”«»' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ description: '—Ê‘ «—”«·' })
  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @ApiPropertyOptional({ description: '—Ê‘ Å—œ«Œ ' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Ì«œœ«‘  „‘ —Ì' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ 
    description: 'Ê÷⁄Ì  ÃœÌœ',
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Ì«œœ«‘  «œ„Ì‰' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class UpdateSubOrderStatusDto {
  @ApiProperty({ 
    description: 'Ê÷⁄Ì  ÃœÌœ',
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: '‘„«—Â ÅÌêÌ—Ì' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: '—Ê‘ «—”«·' })
  @IsOptional()
  @IsString()
  shippingMethod?: string;
}

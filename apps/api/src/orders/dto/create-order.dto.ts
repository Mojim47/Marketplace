import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber('IR')
  customerPhone?: string;
}

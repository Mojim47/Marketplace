/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Payment DTOs
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Data Transfer Objects for payment operations.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { IsString, IsNumber, IsOptional, IsUUID, Min, IsUrl, IsEmail, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new payment request
 */
export class CreatePaymentDto {
  @ApiProperty({ description: '‘‰«”Â ”›«—‘', example: 'clxyz123...' })
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({ description: '¬œ—” »«“ê‘  Å” «“ Å—œ«Œ ' })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: ' Ê÷ÌÕ«  Å—œ«Œ ' })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * DTO for verifying a payment callback
 */
export class VerifyPaymentDto {
  @ApiProperty({ description: 'òœ « Ê—Ì Ì “—Ì‰ùÅ«·' })
  @IsString()
  authority: string;

  @ApiProperty({ description: 'Ê÷⁄Ì  Å—œ«Œ  «“ “—Ì‰ùÅ«·', example: 'OK' })
  @IsString()
  status: string;
}

/**
 * DTO for refund request
 */
export class RefundPaymentDto {
  @ApiProperty({ description: '‘‰«”Â  —«ò‰‘' })
  @IsString()
  transactionId: string;

  @ApiPropertyOptional({ description: '„»·€ «” —œ«œ («Œ Ì«—Ì - ÅÌ‘ù›—÷ ò· „»·€)' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  amount?: number;

  @ApiPropertyOptional({ description: 'œ·Ì· «” —œ«œ' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Response for payment request
 */
export class PaymentRequestResponse {
  @ApiProperty({ description: '¬œ—” Å—œ«Œ ' })
  paymentUrl: string;

  @ApiProperty({ description: 'òœ « Ê—Ì Ì' })
  authority: string;

  @ApiProperty({ description: '‘‰«”Â  —«ò‰‘' })
  transactionId: string;
}

/**
 * Response for payment verification
 */
export class PaymentVerifyResponse {
  @ApiProperty({ description: '„Ê›ﬁÌ  Å—œ«Œ ' })
  success: boolean;

  @ApiPropertyOptional({ description: '‘„«—Â „—Ã⁄' })
  refId?: string;

  @ApiPropertyOptional({ description: '‘„«—Â ò«—  „«”ò ‘œÂ' })
  cardPan?: string;

  @ApiPropertyOptional({ description: 'ÅÌ«„ Œÿ«' })
  message?: string;
}

/**
 * Response for transaction details
 */
export class TransactionDetailsResponse {
  @ApiProperty({ description: '‘‰«”Â  —«ò‰‘' })
  id: string;

  @ApiProperty({ description: '„»·€' })
  amount: number;

  @ApiProperty({ description: 'Ê÷⁄Ì ' })
  status: string;

  @ApiProperty({ description: 'œ—ê«Â Å—œ«Œ ' })
  gateway: string;

  @ApiPropertyOptional({ description: '‘„«—Â „—Ã⁄' })
  refId?: string;

  @ApiProperty({ description: ' «—ÌŒ «ÌÃ«œ' })
  createdAt: Date;

  @ApiPropertyOptional({ description: ' «—ÌŒ Å—œ«Œ ' })
  paidAt?: Date;
}

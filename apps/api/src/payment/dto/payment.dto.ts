/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Payment DTOs
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Data Transfer Objects for payment operations.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Min,
} from 'class-validator';

/**
 * DTO for creating a new payment request
 */
export class CreatePaymentDto {
  @ApiProperty({ description: '����� �����', example: 'clxyz123...' })
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({ description: '���� ��Ґ�� �� �� ������' })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: '������� ������' })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * DTO for verifying a payment callback
 */
export class VerifyPaymentDto {
  @ApiProperty({ description: '�� ������� ���䝁��' })
  @IsString()
  authority: string;

  @ApiProperty({ description: '����� ������ �� ���䝁��', example: 'OK' })
  @IsString()
  status: string;
}

/**
 * DTO for refund request
 */
export class RefundPaymentDto {
  @ApiProperty({ description: '����� ��ǘ��' })
  @IsString()
  transactionId: string;

  @ApiPropertyOptional({ description: '���� ������� (������� - ��ԝ��� �� ����)' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  amount?: number;

  @ApiPropertyOptional({ description: '���� �������' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Response for payment request
 */
export class PaymentRequestResponse {
  @ApiProperty({ description: '���� ������' })
  paymentUrl: string;

  @ApiProperty({ description: '�� �������' })
  authority: string;

  @ApiProperty({ description: '����� ��ǘ��' })
  transactionId: string;
}

/**
 * Response for payment verification
 */
export class PaymentVerifyResponse {
  @ApiProperty({ description: '������ ������' })
  success: boolean;

  @ApiPropertyOptional({ description: '����� ����' })
  refId?: string;

  @ApiPropertyOptional({ description: '����� ���� ��Ә ���' })
  cardPan?: string;

  @ApiPropertyOptional({ description: '���� ���' })
  message?: string;
}

/**
 * Response for transaction details
 */
export class TransactionDetailsResponse {
  @ApiProperty({ description: '����� ��ǘ��' })
  id: string;

  @ApiProperty({ description: '����' })
  amount: number;

  @ApiProperty({ description: '�����' })
  status: string;

  @ApiProperty({ description: '�ѐ�� ������' })
  gateway: string;

  @ApiPropertyOptional({ description: '����� ����' })
  refId?: string;

  @ApiProperty({ description: '����� �����' })
  createdAt: Date;

  @ApiPropertyOptional({ description: '����� ������' })
  paidAt?: Date;
}

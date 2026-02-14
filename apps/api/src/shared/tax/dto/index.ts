/**
 * Tax Module DTOs
 * Requirements: 9.1, 9.2, 9.3
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubmitInvoiceDto {
  @ApiProperty({ description: '����� �ǘ���' })
  @IsUUID()
  invoiceId: string;

  @ApiPropertyOptional({ description: '����� ����� �ǘ���' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiProperty({ description: '���� �� �ǘ���', example: 1500000 })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({ description: '����� �ǘ���' })
  @Type(() => Date)
  @IsDate()
  createdAt: Date;
}

export class PollStatusDto {
  @ApiProperty({ description: '����� �ǘ���' })
  @IsUUID()
  invoiceId: string;
}

export class InvoiceItemDto {
  @ApiProperty({ description: '����� ����' })
  @IsString()
  id: string;

  @ApiProperty({ description: '���� ��', example: 500000 })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({ description: '���� ������', example: 45000 })
  @IsNumber()
  @Min(0)
  taxAmount: number;

  @ApiProperty({ description: '�����' })
  @IsString()
  date: string;
}

export class GenerateReportDto {
  @ApiProperty({ description: '���� �����', example: '1402/09' })
  @IsString()
  period: string;

  @ApiProperty({ description: '���� �ǘ�����', type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  invoices: InvoiceItemDto[];
}

export class SubmissionResultDto {
  @ApiProperty({ description: '����� �ǘ���' })
  invoiceId: string;

  @ApiProperty({ description: '�����', enum: ['PENDING', 'CONFIRMED', 'REJECTED'] })
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';

  @ApiPropertyOptional({ description: '����� ���� ������' })
  senaRefId?: string;

  @ApiProperty({ description: '����� �����' })
  createdAt: Date;

  @ApiProperty({ description: '����� ����������' })
  updatedAt: Date;
}

export class TaxReportResultDto {
  @ApiProperty({ description: '���� �����' })
  period: string;

  @ApiProperty({ description: '��� �����', enum: ['VAT', 'SALES'] })
  type: 'VAT' | 'SALES';

  @ApiProperty({ description: '������ XML �����' })
  xmlContent: string;
}

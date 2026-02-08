/**
 * Tax Module DTOs
 * Requirements: 9.1, 9.2, 9.3
 */

import { IsString, IsNumber, IsOptional, IsDate, IsUUID, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitInvoiceDto {
  @ApiProperty({ description: '‘‰«”Â ›«ò Ê—' })
  @IsUUID()
  invoiceId: string;

  @ApiPropertyOptional({ description: '‘„«—Â ”—Ì«· ›«ò Ê—' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiProperty({ description: '„»·€ ò· ›«ò Ê—', example: 1500000 })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({ description: ' «—ÌŒ ›«ò Ê—' })
  @Type(() => Date)
  @IsDate()
  createdAt: Date;
}

export class PollStatusDto {
  @ApiProperty({ description: '‘‰«”Â ›«ò Ê—' })
  @IsUUID()
  invoiceId: string;
}

export class InvoiceItemDto {
  @ApiProperty({ description: '‘‰«”Â ¬Ì „' })
  @IsString()
  id: string;

  @ApiProperty({ description: '„»·€ ò·', example: 500000 })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({ description: '„»·€ „«·Ì« ', example: 45000 })
  @IsNumber()
  @Min(0)
  taxAmount: number;

  @ApiProperty({ description: ' «—ÌŒ' })
  @IsString()
  date: string;
}

export class GenerateReportDto {
  @ApiProperty({ description: 'œÊ—Â ê“«—‘', example: '1402/09' })
  @IsString()
  period: string;

  @ApiProperty({ description: '·Ì”  ›«ò Ê—Â«', type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  invoices: InvoiceItemDto[];
}

export class SubmissionResultDto {
  @ApiProperty({ description: '‘‰«”Â ›«ò Ê—' })
  invoiceId: string;

  @ApiProperty({ description: 'Ê÷⁄Ì ', enum: ['PENDING', 'CONFIRMED', 'REJECTED'] })
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';

  @ApiPropertyOptional({ description: '‘„«—Â „—Ã⁄ „ÊœÌ«‰' })
  senaRefId?: string;

  @ApiProperty({ description: ' «—ÌŒ «ÌÃ«œ' })
  createdAt: Date;

  @ApiProperty({ description: ' «—ÌŒ »Âù—Ê“—”«‰Ì' })
  updatedAt: Date;
}

export class TaxReportResultDto {
  @ApiProperty({ description: 'œÊ—Â ê“«—‘' })
  period: string;

  @ApiProperty({ description: '‰Ê⁄ ê“«—‘', enum: ['VAT', 'SALES'] })
  type: 'VAT' | 'SALES';

  @ApiProperty({ description: '„Õ Ê«Ì XML ê“«—‘' })
  xmlContent: string;
}

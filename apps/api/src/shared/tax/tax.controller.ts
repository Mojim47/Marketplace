/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Tax Controller
 * ???????????????????????????????????????????????????????????????????????????
 *
 * REST API endpoints for Iranian tax authority (Moodian/SENA) integration.
 *
 * Features:
 * - Submit invoices to Moodian
 * - Poll invoice status
 * - Generate VAT reports
 *
 * @module @nextgen/api/shared/tax
 * Requirements: 9.1, 9.2, 9.3
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  GenerateReportDto,
  SubmissionResultDto,
  SubmitInvoiceDto,
  TaxReportResultDto,
} from './dto';
import { TaxService } from './tax.service';

@ApiTags('tax')
@Controller('tax')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  /**
   * ����� �ǘ��� �� ������ ������
   * Requirements: 9.1
   */
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �ǘ��� �� ������ ������' })
  @ApiResponse({
    status: 200,
    description: '�ǘ��� �� ������ ����� ��',
    type: SubmissionResultDto,
  })
  @ApiResponse({ status: 400, description: '��� �� ����� �ǘ���' })
  async submitInvoice(@Body() dto: SubmitInvoiceDto): Promise<SubmissionResultDto> {
    const result = await this.taxService.submitInvoice({
      id: dto.invoiceId,
      serial: dto.serial,
      total: dto.total,
      createdAt: dto.createdAt,
    });

    return {
      invoiceId: result.invoiceId,
      status: result.status,
      senaRefId: result.senaRefId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * ����� ����� �ǘ��� �� ������
   * Requirements: 9.2
   */
  @Get('status/:invoiceId')
  @ApiOperation({ summary: '����� ����� �ǘ��� �� ������' })
  @ApiResponse({
    status: 200,
    description: '����� �ǘ���',
    type: SubmissionResultDto,
  })
  @ApiResponse({ status: 404, description: '�ǘ��� ���� ���' })
  async getStatus(@Param('invoiceId') invoiceId: string): Promise<SubmissionResultDto> {
    // First check local database
    let submission = await this.taxService.getSubmission(invoiceId);

    // If pending, poll Moodian for latest status
    if (submission && submission.status === 'PENDING') {
      submission = await this.taxService.pollStatus(invoiceId);
    }

    if (!submission) {
      throw new Error('�ǘ��� ���� ���');
    }

    return {
      invoiceId: submission.invoiceId,
      status: submission.status,
      senaRefId: submission.senaRefId,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }

  /**
   * ���������� ����� �ǘ��� �� ������
   * Requirements: 9.2
   */
  @Post('refresh/:invoiceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '���������� ����� �ǘ��� �� ������' })
  @ApiResponse({
    status: 200,
    description: '����� ����� ��',
    type: SubmissionResultDto,
  })
  async refreshStatus(@Param('invoiceId') invoiceId: string): Promise<SubmissionResultDto> {
    const result = await this.taxService.pollStatus(invoiceId);

    return {
      invoiceId: result.invoiceId,
      status: result.status,
      senaRefId: result.senaRefId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * ����� ����� �������
   * Requirements: 9.3
   */
  @Post('report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� ����� ������� VAT' })
  @ApiResponse({
    status: 200,
    description: '����� ����� ��',
    type: TaxReportResultDto,
  })
  async generateReport(@Body() dto: GenerateReportDto): Promise<TaxReportResultDto> {
    const report = this.taxService.generateReport(dto.period, dto.invoices);

    return {
      period: report.period,
      type: report.type,
      xmlContent: report.xmlContent,
    };
  }

  /**
   * ���������� ��� �ǘ������ �� ������
   */
  @Post('refresh-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '���������� ����� ��� �ǘ������ �� ������' })
  @ApiResponse({
    status: 200,
    description: '����� ����������',
  })
  async refreshAllPending(): Promise<{ updated: number; failed: number; message: string }> {
    const result = await this.taxService.refreshPendingStatuses();

    return {
      ...result,
      message: `${result.updated} �ǘ��� ����� �ϡ ${result.failed} ���`,
    };
  }

  /**
   * ����� ����� ����� �������
   */
  @Get('health')
  @ApiOperation({ summary: '����� ����� ����� �������' })
  @ApiResponse({ status: 200, description: '����� �����' })
  async healthCheck(): Promise<{ healthy: boolean; timestamp: string }> {
    return {
      healthy: true,
      timestamp: new Date().toISOString(),
    };
  }
}

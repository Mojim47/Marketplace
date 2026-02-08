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
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TaxService } from './tax.service';
import {
  SubmitInvoiceDto,
  GenerateReportDto,
  SubmissionResultDto,
  TaxReportResultDto,
} from './dto';

@ApiTags('tax')
@Controller('tax')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  /**
   * «—”«· ›«ò Ê— »Â ”«„«‰Â „ÊœÌ«‰
   * Requirements: 9.1
   */
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '«—”«· ›«ò Ê— »Â ”«„«‰Â „ÊœÌ«‰' })
  @ApiResponse({
    status: 200,
    description: '›«ò Ê— »« „Ê›ﬁÌ  «—”«· ‘œ',
    type: SubmissionResultDto,
  })
  @ApiResponse({ status: 400, description: 'Œÿ« œ— «—”«· ›«ò Ê—' })
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
   * »——”Ì Ê÷⁄Ì  ›«ò Ê— œ— „ÊœÌ«‰
   * Requirements: 9.2
   */
  @Get('status/:invoiceId')
  @ApiOperation({ summary: '»——”Ì Ê÷⁄Ì  ›«ò Ê— œ— „ÊœÌ«‰' })
  @ApiResponse({
    status: 200,
    description: 'Ê÷⁄Ì  ›«ò Ê—',
    type: SubmissionResultDto,
  })
  @ApiResponse({ status: 404, description: '›«ò Ê— Ì«›  ‰‘œ' })
  async getStatus(@Param('invoiceId') invoiceId: string): Promise<SubmissionResultDto> {
    // First check local database
    let submission = await this.taxService.getSubmission(invoiceId);
    
    // If pending, poll Moodian for latest status
    if (submission && submission.status === 'PENDING') {
      submission = await this.taxService.pollStatus(invoiceId);
    }

    if (!submission) {
      throw new Error('›«ò Ê— Ì«›  ‰‘œ');
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
   * »Âù—Ê“—”«‰Ì Ê÷⁄Ì  ›«ò Ê— «“ „ÊœÌ«‰
   * Requirements: 9.2
   */
  @Post('refresh/:invoiceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '»Âù—Ê“—”«‰Ì Ê÷⁄Ì  ›«ò Ê— «“ „ÊœÌ«‰' })
  @ApiResponse({
    status: 200,
    description: 'Ê÷⁄Ì  »Âù—Ê“ ‘œ',
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
   *  Ê·Ìœ ê“«—‘ „«·Ì« Ì
   * Requirements: 9.3
   */
  @Post('report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: ' Ê·Ìœ ê“«—‘ „«·Ì« Ì VAT' })
  @ApiResponse({
    status: 200,
    description: 'ê“«—‘  Ê·Ìœ ‘œ',
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
   * »Âù—Ê“—”«‰Ì Â„Â ›«ò Ê—Â«Ì œ— «‰ Ÿ«—
   */
  @Post('refresh-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '»Âù—Ê“—”«‰Ì Ê÷⁄Ì  Â„Â ›«ò Ê—Â«Ì œ— «‰ Ÿ«—' })
  @ApiResponse({
    status: 200,
    description: '‰ ÌÃÂ »Âù—Ê“—”«‰Ì',
  })
  async refreshAllPending(): Promise<{ updated: number; failed: number; message: string }> {
    const result = await this.taxService.refreshPendingStatuses();

    return {
      ...result,
      message: `${result.updated} ›«ò Ê— »Âù—Ê“ ‘œ° ${result.failed} Œÿ«`,
    };
  }

  /**
   * »——”Ì ”·«„  ”—ÊÌ” „«·Ì« Ì
   */
  @Get('health')
  @ApiOperation({ summary: '»——”Ì ”·«„  ”—ÊÌ” „«·Ì« Ì' })
  @ApiResponse({ status: 200, description: 'Ê÷⁄Ì  ”·«„ ' })
  async healthCheck(): Promise<{ healthy: boolean; timestamp: string }> {
    return {
      healthy: true,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Payment Controller
 * ???????????????????????????????????????????????????????????????????????????
 *
 * REST API endpoints for payment operations.
 * Integrates with ZarinPal payment gateway.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreatePaymentDto,
  PaymentRequestResponse,
  PaymentVerifyResponse,
  RefundPaymentDto,
  TransactionDetailsResponse,
  VerifyPaymentDto,
} from './dto/payment.dto';
import { PaymentService } from './payment.service';

/**
 * Extract client IP from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Request a new payment
   * Requirements: 4.1 - WHEN ����� ������ �� ���� �흘�� THEN THE Payment_Service SHALL ������� ������ �� ���䝁�� ����� ���
   */
  @Post('request')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '������� ������',
    description: '����� ������� ������ ���� ���� � ����� � ������ ��� ������ ���䝁��',
  })
  @ApiResponse({
    status: 200,
    description: '������� ������ �� ������ ����� ��',
    type: PaymentRequestResponse,
  })
  @ApiResponse({ status: 400, description: '��� �� ����� ������� ������' })
  @ApiResponse({ status: 401, description: '����� ���� ����' })
  async requestPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePaymentDto,
    @Req() req: Request
  ): Promise<PaymentRequestResponse> {
    const ipAddress = getClientIp(req);
    return this.paymentService.requestPayment(dto, user.id, ipAddress);
  }

  /**
   * Verify payment callback from ZarinPal
   * Requirements: 4.2, 4.3, 4.4 - ����� ������ � ���������� ����� �����
   */
  @Get('verify')
  @ApiOperation({
    summary: '����� ������',
    description: '����� ������ �� �� ��Ґ�� ����� �� �ѐ�� ���',
  })
  @ApiQuery({ name: 'Authority', description: '�� ������� ���䝁��', required: true })
  @ApiQuery({ name: 'Status', description: '����� ������', required: true })
  @ApiResponse({
    status: 200,
    description: '����� ����� ������',
    type: PaymentVerifyResponse,
  })
  @ApiResponse({ status: 404, description: '��ǘ�� ���� ���' })
  async verifyPayment(
    @Query('Authority') authority: string,
    @Query('Status') status: string,
    @Req() req: Request
  ): Promise<PaymentVerifyResponse> {
    const ipAddress = getClientIp(req);
    return this.paymentService.verifyPayment({ authority, status }, ipAddress);
  }

  /**
   * Process refund for a transaction
   * Requirements: 4.5 - WHEN ������� ������� ����� ����� THEN THE Payment_Service SHALL ������� �� ������ ���
   */
  @Post('refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '������� ���',
    description: '������� ������� ��� ���� � ��ǘ�� ������ ���',
  })
  @ApiResponse({ status: 200, description: '������� �� ������ ����� ��' })
  @ApiResponse({ status: 400, description: '��� �� ������� ���' })
  @ApiResponse({ status: 401, description: '����� ���� ����' })
  @ApiResponse({ status: 404, description: '��ǘ�� ���� ���' })
  async refundPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: RefundPaymentDto,
    @Req() req: Request
  ): Promise<{ success: boolean; message: string }> {
    const ipAddress = getClientIp(req);
    return this.paymentService.refundPayment(dto, user.id, ipAddress);
  }

  /**
   * Get transaction details
   */
  @Get('transaction/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '������ ��ǘ��',
    description: '������ ������ � ��ǘ�� ������',
  })
  @ApiResponse({
    status: 200,
    description: '������ ��ǘ��',
    type: TransactionDetailsResponse,
  })
  @ApiResponse({ status: 401, description: '����� ���� ����' })
  @ApiResponse({ status: 404, description: '��ǘ�� ���� ���' })
  async getTransaction(
    @CurrentUser() user: { id: string },
    @Param('id') transactionId: string
  ): Promise<TransactionDetailsResponse> {
    return this.paymentService.getTransaction(transactionId, user.id);
  }

  /**
   * Get user's transaction history
   */
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '����΍� ��ǘ�ԝ��',
    description: '������ ���� ��ǘ�ԝ��� ������ �����',
  })
  @ApiQuery({ name: 'page', description: '����� ����', required: false })
  @ApiQuery({ name: 'limit', description: '����� �� �� ����', required: false })
  @ApiResponse({
    status: 200,
    description: '���� ��ǘ�ԝ��',
  })
  @ApiResponse({ status: 401, description: '����� ���� ����' })
  async getUserTransactions(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<{ transactions: TransactionDetailsResponse[]; total: number }> {
    return this.paymentService.getUserTransactions(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10
    );
  }

  /**
   * Get payment gateway status
   */
  @Get('status')
  @ApiOperation({
    summary: '����� �ѐ�� ������',
    description: '����� ����� ����� �� �ѐ�� ������',
  })
  @ApiResponse({ status: 200, description: '����� �ѐ��' })
  async getGatewayStatus(): Promise<{ gateway: string; sandbox: boolean; status: string }> {
    return {
      gateway: 'zarinpal',
      sandbox: this.paymentService.isSandboxMode(),
      status: 'active',
    };
  }
}

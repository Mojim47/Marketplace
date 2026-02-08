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
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreatePaymentDto,
  VerifyPaymentDto,
  RefundPaymentDto,
  PaymentRequestResponse,
  PaymentVerifyResponse,
  TransactionDetailsResponse,
} from './dto/payment.dto';

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
   * Requirements: 4.1 - WHEN ò«—»— Å—œ«Œ  —« ‘—Ê⁄ „Ìùò‰œ THEN THE Payment_Service SHALL œ—ŒÊ«”  Å—œ«Œ  »Â “—Ì‰ùÅ«· «—”«· ò‰œ
   */
  @Post('request')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'œ—ŒÊ«”  Å—œ«Œ ',
    description: '«ÌÃ«œ œ—ŒÊ«”  Å—œ«Œ  ÃœÌœ »—«Ì Ìò ”›«—‘ Ê œ—Ì«›  ·Ì‰ò Å—œ«Œ  “—Ì‰ùÅ«·',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'œ—ŒÊ«”  Å—œ«Œ  »« „Ê›ﬁÌ  «ÌÃ«œ ‘œ',
    type: PaymentRequestResponse,
  })
  @ApiResponse({ status: 400, description: 'Œÿ« œ— «ÌÃ«œ œ—ŒÊ«”  Å—œ«Œ ' })
  @ApiResponse({ status: 401, description: '«Õ—«“ ÂÊÌ  ‰‘œÂ' })
  async requestPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ): Promise<PaymentRequestResponse> {
    const ipAddress = getClientIp(req);
    return this.paymentService.requestPayment(dto, user.id, ipAddress);
  }

  /**
   * Verify payment callback from ZarinPal
   * Requirements: 4.2, 4.3, 4.4 -  «ÌÌœ Å—œ«Œ  Ê »Âù—Ê“—”«‰Ì Ê÷⁄Ì  ”›«—‘
   */
  @Get('verify')
  @ApiOperation({ 
    summary: ' «ÌÌœ Å—œ«Œ ',
    description: ' «ÌÌœ Å—œ«Œ  Å” «“ »«“ê‘  ò«—»— «“ œ—ê«Â »«‰ò',
  })
  @ApiQuery({ name: 'Authority', description: 'òœ « Ê—Ì Ì “—Ì‰ùÅ«·', required: true })
  @ApiQuery({ name: 'Status', description: 'Ê÷⁄Ì  Å—œ«Œ ', required: true })
  @ApiResponse({ 
    status: 200, 
    description: '‰ ÌÃÂ  «ÌÌœ Å—œ«Œ ',
    type: PaymentVerifyResponse,
  })
  @ApiResponse({ status: 404, description: ' —«ò‰‘ Ì«›  ‰‘œ' })
  async verifyPayment(
    @Query('Authority') authority: string,
    @Query('Status') status: string,
    @Req() req: Request,
  ): Promise<PaymentVerifyResponse> {
    const ipAddress = getClientIp(req);
    return this.paymentService.verifyPayment({ authority, status }, ipAddress);
  }

  /**
   * Process refund for a transaction
   * Requirements: 4.5 - WHEN œ—ŒÊ«”  «” —œ«œ «—”«· „Ìù‘Êœ THEN THE Payment_Service SHALL «” —œ«œ —« Å—œ«“‘ ò‰œ
   */
  @Post('refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '«” —œ«œ ÊÃÂ',
    description: 'œ—ŒÊ«”  «” —œ«œ ÊÃÂ »—«Ì Ìò  —«ò‰‘ Å—œ«Œ  ‘œÂ',
  })
  @ApiResponse({ status: 200, description: '«” —œ«œ »« „Ê›ﬁÌ  «‰Ã«„ ‘œ' })
  @ApiResponse({ status: 400, description: 'Œÿ« œ— «” —œ«œ ÊÃÂ' })
  @ApiResponse({ status: 401, description: '«Õ—«“ ÂÊÌ  ‰‘œÂ' })
  @ApiResponse({ status: 404, description: ' —«ò‰‘ Ì«›  ‰‘œ' })
  async refundPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: RefundPaymentDto,
    @Req() req: Request,
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
    summary: 'Ã“∆Ì«   —«ò‰‘',
    description: 'œ—Ì«›  Ã“∆Ì«  Ìò  —«ò‰‘ Å—œ«Œ ',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Ã“∆Ì«   —«ò‰‘',
    type: TransactionDetailsResponse,
  })
  @ApiResponse({ status: 401, description: '«Õ—«“ ÂÊÌ  ‰‘œÂ' })
  @ApiResponse({ status: 404, description: ' —«ò‰‘ Ì«›  ‰‘œ' })
  async getTransaction(
    @CurrentUser() user: { id: string },
    @Param('id') transactionId: string,
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
    summary: ' «—ÌŒçÂ  —«ò‰‘ùÂ«',
    description: 'œ—Ì«›  ·Ì”   —«ò‰‘ùÂ«Ì Å—œ«Œ  ò«—»—',
  })
  @ApiQuery({ name: 'page', description: '‘„«—Â ’›ÕÂ', required: false })
  @ApiQuery({ name: 'limit', description: ' ⁄œ«œ œ— Â— ’›ÕÂ', required: false })
  @ApiResponse({ 
    status: 200, 
    description: '·Ì”   —«ò‰‘ùÂ«',
  })
  @ApiResponse({ status: 401, description: '«Õ—«“ ÂÊÌ  ‰‘œÂ' })
  async getUserTransactions(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ transactions: TransactionDetailsResponse[]; total: number }> {
    return this.paymentService.getUserTransactions(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * Get payment gateway status
   */
  @Get('status')
  @ApiOperation({ 
    summary: 'Ê÷⁄Ì  œ—ê«Â Å—œ«Œ ',
    description: '»——”Ì Ê÷⁄Ì  « ’«· »Â œ—ê«Â Å—œ«Œ ',
  })
  @ApiResponse({ status: 200, description: 'Ê÷⁄Ì  œ—ê«Â' })
  async getGatewayStatus(): Promise<{ gateway: string; sandbox: boolean; status: string }> {
    return {
      gateway: 'zarinpal',
      sandbox: this.paymentService.isSandboxMode(),
      status: 'active',
    };
  }
}

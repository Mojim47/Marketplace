/**
 * Checkout Controller
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CheckoutService } from './checkout.service';
import type { PaymentMethod, ShippingAddress } from './checkout.types';

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('init')
  async initCheckout(@Request() req: any) {
    return this.checkoutService.initCheckout(req.user.id);
  }

  @Get('active')
  async getActiveSession(@Request() req: any) {
    const session = await this.checkoutService.getActiveSession(req.user.id);
    return session || { active: false };
  }

  @Get(':sessionId')
  async getSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.checkoutService.getSession(sessionId, req.user.id);
  }

  @Put(':sessionId/shipping')
  async setShippingAddress(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() address: ShippingAddress
  ) {
    return this.checkoutService.setShippingAddress(sessionId, req.user.id, address);
  }

  @Put(':sessionId/billing')
  async setBillingAddress(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() address: ShippingAddress
  ) {
    return this.checkoutService.setBillingAddress(sessionId, req.user.id, address);
  }

  @Put(':sessionId/payment')
  async setPaymentMethod(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { method: PaymentMethod }
  ) {
    return this.checkoutService.setPaymentMethod(sessionId, req.user.id, body.method);
  }

  @Post(':sessionId/complete')
  async completeCheckout(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.checkoutService.completeCheckout(sessionId, req.user.id);
  }

  @Delete(':sessionId')
  async cancelCheckout(@Request() req: any, @Param('sessionId') sessionId: string) {
    await this.checkoutService.cancelCheckout(sessionId, req.user.id);
    return { success: true };
  }
}

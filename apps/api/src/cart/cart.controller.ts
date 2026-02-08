/**
 * Cart Controller
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import type { AddToCartDto, UpdateCartItemDto, ApplyDiscountDto } from './cart.types';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  @Get('count')
  async getItemCount(@Request() req: any) {
    return { count: await this.cartService.getItemCount(req.user.id) };
  }

  @Post('items')
  async addToCart(@Request() req: any, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, dto);
  }

  @Put('items')
  async updateCartItem(@Request() req: any, @Body() dto: UpdateCartItemDto) {
    return this.cartService.updateCartItem(req.user.id, dto);
  }

  @Delete('items/:productId')
  async removeFromCart(
    @Request() req: any,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeFromCart(req.user.id, productId);
  }

  @Delete()
  async clearCart(@Request() req: any) {
    await this.cartService.clearCart(req.user.id);
    return { success: true };
  }

  @Post('discount')
  async applyDiscount(@Request() req: any, @Body() dto: ApplyDiscountDto) {
    return this.cartService.applyDiscount(req.user.id, dto.code);
  }

  @Delete('discount')
  async removeDiscount(@Request() req: any) {
    return this.cartService.removeDiscount(req.user.id);
  }

  @Get('validate')
  async validateForCheckout(@Request() req: any) {
    return this.cartService.validateForCheckout(req.user.id);
  }
}

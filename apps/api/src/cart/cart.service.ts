/**
 * Cart Service - Redis-Backed Stateless Implementation
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 *
 * Features:
 * - Cart state stored in Redis (stateless API)
 * - Distributed locking for concurrent updates
 * - TTL-based cart expiration
 * - Atomic operations
 */

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AddToCartDto, Cart, CartConfig, CartItem, UpdateCartItemDto } from './cart.types';

/** Redis State Service Interface */
interface IStateService {
  setState<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<boolean>;
  getState<T>(key: string): Promise<T | null>;
  deleteState(key: string): Promise<boolean>;
  acquireLock(
    key: string,
    options?: { ttlMs?: number; retryAttempts?: number }
  ): Promise<{ key: string; token: string } | null>;
  releaseLock(lock: { key: string; token: string }): Promise<boolean>;
}

const DEFAULT_CONFIG: CartConfig = {
  ttlSeconds: 86400 * 7, // 7 days
  maxItems: 50,
  taxRate: 0.09, // 9% VAT
};

@Injectable()
export class CartService {
  private config: CartConfig;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('STATE_SERVICE') private readonly stateService: IStateService,
    config?: Partial<CartConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate cart key for Redis
   */
  private getCartKey(userId: string): string {
    return `cart:${userId}`;
  }

  /**
   * Get cart lock key
   */
  private getCartLockKey(userId: string): string {
    return `cart:lock:${userId}`;
  }

  /**
   * Calculate cart totals
   */
  private calculateTotals(
    items: CartItem[],
    discount: number,
    shippingCost: number
  ): Pick<Cart, 'subtotal' | 'taxAmount' | 'total'> {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const taxAmount = discountedSubtotal * this.config.taxRate;
    const total = discountedSubtotal + taxAmount + shippingCost;

    return { subtotal, taxAmount, total };
  }

  /**
   * Create empty cart
   */
  private createEmptyCart(userId: string): Cart {
    const now = new Date();
    return {
      userId,
      items: [],
      subtotal: 0,
      discount: 0,
      shippingCost: 0,
      taxAmount: 0,
      total: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get user's cart
   */
  async getCart(userId: string): Promise<Cart> {
    const cartKey = this.getCartKey(userId);
    const cart = await this.stateService.getState<Cart>(cartKey);

    if (!cart) {
      return this.createEmptyCart(userId);
    }

    // Restore Date objects
    return {
      ...cart,
      createdAt: new Date(cart.createdAt),
      updatedAt: new Date(cart.updatedAt),
    };
  }

  /**
   * Save cart to Redis
   */
  private async saveCart(cart: Cart): Promise<void> {
    const cartKey = this.getCartKey(cart.userId);
    await this.stateService.setState(cartKey, cart, { ttlSeconds: this.config.ttlSeconds });
  }

  /**
   * Add item to cart
   */
  async addToCart(userId: string, dto: AddToCartDto): Promise<Cart> {
    const lockKey = this.getCartLockKey(userId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('��� ���� �� ��� ������ ��ʡ ����� ������ ���� ����');
    }

    try {
      // Validate product exists and has stock
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, name: true, sku: true, price: true, stock: true, images: true },
      });

      if (!product) {
        throw new NotFoundException('����� ���� ���');
      }

      if (product.stock < dto.quantity) {
        throw new BadRequestException(`������ ���� ����. ������ ����: ${product.stock}`);
      }

      // Get current cart
      const cart = await this.getCart(userId);

      // Check max items
      if (cart.items.length >= this.config.maxItems) {
        throw new BadRequestException(`��ǘ�� ${this.config.maxItems} ���� �� ��� ���� ���� ���`);
      }

      // Find existing item
      const existingIndex = cart.items.findIndex(
        (item) => item.productId === dto.productId && item.variantId === dto.variantId
      );

      if (existingIndex >= 0) {
        // Update quantity
        const newQuantity = cart.items[existingIndex].quantity + dto.quantity;
        if (newQuantity > product.stock) {
          throw new BadRequestException(`������ ���� ����. ������ ����: ${product.stock}`);
        }
        cart.items[existingIndex].quantity = newQuantity;
      } else {
        // Add new item
        const newItem: CartItem = {
          productId: product.id,
          variantId: dto.variantId,
          productName: product.name,
          productSku: product.sku,
          quantity: dto.quantity,
          price: Number(product.price),
          imageUrl: product.images?.[0],
        };
        cart.items.push(newItem);
      }

      // Recalculate totals
      const totals = this.calculateTotals(cart.items, cart.discount, cart.shippingCost);
      Object.assign(cart, totals);
      cart.updatedAt = new Date();

      // Save cart
      await this.saveCart(cart);

      return cart;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(userId: string, dto: UpdateCartItemDto): Promise<Cart> {
    const lockKey = this.getCartLockKey(userId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('��� ���� �� ��� ������ ��ʡ ����� ������ ���� ����');
    }

    try {
      const cart = await this.getCart(userId);

      const itemIndex = cart.items.findIndex(
        (item) => item.productId === dto.productId && item.variantId === dto.variantId
      );

      if (itemIndex < 0) {
        throw new NotFoundException('���� �� ��� ���� ���� ���');
      }

      if (dto.quantity <= 0) {
        // Remove item
        cart.items.splice(itemIndex, 1);
      } else {
        // Validate stock
        const product = await this.prisma.product.findUnique({
          where: { id: dto.productId },
          select: { stock: true },
        });

        if (!product || product.stock < dto.quantity) {
          throw new BadRequestException(`������ ���� ����. ������ ����: ${product?.stock || 0}`);
        }

        cart.items[itemIndex].quantity = dto.quantity;
      }

      // Recalculate totals
      const totals = this.calculateTotals(cart.items, cart.discount, cart.shippingCost);
      Object.assign(cart, totals);
      cart.updatedAt = new Date();

      await this.saveCart(cart);

      return cart;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: string, productId: string, variantId?: string): Promise<Cart> {
    return this.updateCartItem(userId, { productId, variantId, quantity: 0 });
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string): Promise<void> {
    const cartKey = this.getCartKey(userId);
    await this.stateService.deleteState(cartKey);
  }

  /**
   * Apply discount code
   */
  async applyDiscount(userId: string, code: string): Promise<Cart> {
    const lockKey = this.getCartLockKey(userId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('��� ���� �� ��� ������ ��ʡ ����� ������ ���� ����');
    }

    try {
      // Validate discount code
      const discount = await this.prisma.discount.findFirst({
        where: {
          code,
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });

      if (!discount) {
        throw new BadRequestException('�� ����� ������� ���');
      }

      const cart = await this.getCart(userId);

      // Calculate discount amount
      let discountAmount = 0;
      if (discount.type === 'PERCENTAGE') {
        discountAmount = cart.subtotal * (Number(discount.value) / 100);
        if (discount.maxDiscount) {
          discountAmount = Math.min(discountAmount, Number(discount.maxDiscount));
        }
      } else {
        discountAmount = Number(discount.value);
      }

      cart.discount = discountAmount;
      cart.discountCode = code;

      // Recalculate totals
      const totals = this.calculateTotals(cart.items, cart.discount, cart.shippingCost);
      Object.assign(cart, totals);
      cart.updatedAt = new Date();

      await this.saveCart(cart);

      return cart;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Remove discount
   */
  async removeDiscount(userId: string): Promise<Cart> {
    const lockKey = this.getCartLockKey(userId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('��� ���� �� ��� ������ ��ʡ ����� ������ ���� ����');
    }

    try {
      const cart = await this.getCart(userId);

      cart.discount = 0;
      cart.discountCode = undefined;

      // Recalculate totals
      const totals = this.calculateTotals(cart.items, cart.discount, cart.shippingCost);
      Object.assign(cart, totals);
      cart.updatedAt = new Date();

      await this.saveCart(cart);

      return cart;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Set shipping cost
   */
  async setShippingCost(userId: string, shippingCost: number): Promise<Cart> {
    const lockKey = this.getCartLockKey(userId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('��� ���� �� ��� ������ ��ʡ ����� ������ ���� ����');
    }

    try {
      const cart = await this.getCart(userId);

      cart.shippingCost = shippingCost;

      // Recalculate totals
      const totals = this.calculateTotals(cart.items, cart.discount, cart.shippingCost);
      Object.assign(cart, totals);
      cart.updatedAt = new Date();

      await this.saveCart(cart);

      return cart;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Get cart item count
   */
  async getItemCount(userId: string): Promise<number> {
    const cart = await this.getCart(userId);
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Validate cart before checkout
   */
  async validateForCheckout(userId: string): Promise<{ valid: boolean; errors: string[] }> {
    const cart = await this.getCart(userId);
    const errors: string[] = [];

    if (cart.items.length === 0) {
      errors.push('��� ���� ���� ���');
      return { valid: false, errors };
    }

    // Validate stock for all items
    for (const item of cart.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true, stock: true, isActive: true },
      });

      if (!product) {
        errors.push(`����� "${item.productName}" ��� ����� ����`);
      } else if (!product.isActive) {
        errors.push(`����� "${item.productName}" ������� ��� ���`);
      } else if (product.stock < item.quantity) {
        errors.push(`������ "${item.productName}" ���� ���� (������: ${product.stock})`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

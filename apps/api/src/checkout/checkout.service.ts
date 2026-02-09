/**
 * Checkout Service - Redis-Backed Stateless Implementation
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 *
 * Features:
 * - Checkout session stored in Redis (stateless API)
 * - Distributed locking for concurrent operations
 * - TTL-based session expiration
 * - Multi-step checkout flow
 */

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import type { CartService } from '../cart/cart.service';
import type { PrismaService } from '../database/prisma.service';
import type {
  CheckoutConfig,
  CheckoutSession,
  PaymentMethod,
  ShippingAddress,
} from './checkout.types';

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

const DEFAULT_CONFIG: CheckoutConfig = {
  sessionTtlSeconds: 1800, // 30 minutes
};

@Injectable()
export class CheckoutService {
  private config: CheckoutConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    @Inject('STATE_SERVICE') private readonly stateService: IStateService,
    config?: Partial<CheckoutConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate checkout session key for Redis
   */
  private getSessionKey(sessionId: string): string {
    return `checkout:${sessionId}`;
  }

  /**
   * Generate user's active checkout key
   */
  private getUserCheckoutKey(userId: string): string {
    return `checkout:user:${userId}`;
  }

  /**
   * Get checkout lock key
   */
  private getCheckoutLockKey(sessionId: string): string {
    return `checkout:lock:${sessionId}`;
  }

  /**
   * Initialize checkout session
   */
  async initCheckout(userId: string): Promise<CheckoutSession> {
    // Validate cart
    const validation = await this.cartService.validateForCheckout(userId);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Get cart
    const cart = await this.cartService.getCart(userId);

    // Create checkout session
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlSeconds * 1000);

    const session: CheckoutSession = {
      id: sessionId,
      userId,
      cartSnapshot: {
        items: cart.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: cart.subtotal,
        discount: cart.discount,
        discountCode: cart.discountCode,
        shippingCost: cart.shippingCost,
        taxAmount: cart.taxAmount,
        total: cart.total,
      },
      step: 'SHIPPING',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    // Save session
    const sessionKey = this.getSessionKey(sessionId);
    await this.stateService.setState(sessionKey, session, {
      ttlSeconds: this.config.sessionTtlSeconds,
    });

    // Track user's active checkout
    const userKey = this.getUserCheckoutKey(userId);
    await this.stateService.setState(userKey, sessionId, {
      ttlSeconds: this.config.sessionTtlSeconds,
    });

    return session;
  }

  /**
   * Get checkout session
   */
  async getSession(sessionId: string, userId: string): Promise<CheckoutSession> {
    const sessionKey = this.getSessionKey(sessionId);
    const session = await this.stateService.getState<CheckoutSession>(sessionKey);

    if (!session) {
      throw new NotFoundException('���� ������ ���� ��� �� ����� ��� ���');
    }

    if (session.userId !== userId) {
      throw new BadRequestException('������ �������');
    }

    // Restore Date objects
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      expiresAt: new Date(session.expiresAt),
    };
  }

  /**
   * Get user's active checkout session
   */
  async getActiveSession(userId: string): Promise<CheckoutSession | null> {
    const userKey = this.getUserCheckoutKey(userId);
    const sessionId = await this.stateService.getState<string>(userKey);

    if (!sessionId) {
      return null;
    }

    try {
      return await this.getSession(sessionId, userId);
    } catch {
      // Session expired or invalid
      await this.stateService.deleteState(userKey);
      return null;
    }
  }

  /**
   * Set shipping address
   */
  async setShippingAddress(
    sessionId: string,
    userId: string,
    address: ShippingAddress
  ): Promise<CheckoutSession> {
    const lockKey = this.getCheckoutLockKey(sessionId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('���� ������ �� ��� ������ ���');
    }

    try {
      const session = await this.getSession(sessionId, userId);

      session.shippingAddress = address;
      session.step = 'PAYMENT';
      session.updatedAt = new Date();

      const sessionKey = this.getSessionKey(sessionId);
      await this.stateService.setState(sessionKey, session, {
        ttlSeconds: this.config.sessionTtlSeconds,
      });

      return session;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Set billing address
   */
  async setBillingAddress(
    sessionId: string,
    userId: string,
    address: ShippingAddress
  ): Promise<CheckoutSession> {
    const lockKey = this.getCheckoutLockKey(sessionId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('���� ������ �� ��� ������ ���');
    }

    try {
      const session = await this.getSession(sessionId, userId);

      session.billingAddress = address;
      session.updatedAt = new Date();

      const sessionKey = this.getSessionKey(sessionId);
      await this.stateService.setState(sessionKey, session, {
        ttlSeconds: this.config.sessionTtlSeconds,
      });

      return session;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Set payment method
   */
  async setPaymentMethod(
    sessionId: string,
    userId: string,
    method: PaymentMethod
  ): Promise<CheckoutSession> {
    const lockKey = this.getCheckoutLockKey(sessionId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 5000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('���� ������ �� ��� ������ ���');
    }

    try {
      const session = await this.getSession(sessionId, userId);

      if (!session.shippingAddress) {
        throw new BadRequestException('����� ���� ����� �� ���� ����');
      }

      session.paymentMethod = method;
      session.step = 'REVIEW';
      session.updatedAt = new Date();

      const sessionKey = this.getSessionKey(sessionId);
      await this.stateService.setState(sessionKey, session, {
        ttlSeconds: this.config.sessionTtlSeconds,
      });

      return session;
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Complete checkout and create order
   */
  async completeCheckout(
    sessionId: string,
    userId: string
  ): Promise<{ orderId: string; orderNumber: string }> {
    const lockKey = this.getCheckoutLockKey(sessionId);
    const lock = await this.stateService.acquireLock(lockKey, { ttlMs: 30000, retryAttempts: 3 });

    if (!lock) {
      throw new BadRequestException('���� ������ �� ��� ������ ���');
    }

    try {
      const session = await this.getSession(sessionId, userId);

      // Validate session is ready
      if (!session.shippingAddress) {
        throw new BadRequestException('���� ����� ���� ���� ���');
      }

      if (!session.paymentMethod) {
        throw new BadRequestException('��� ������ ������ ���� ���');
      }

      // Create order in transaction
      const order = await this.prisma.$transaction(async (tx) => {
        // Validate stock again
        for (const item of session.cartSnapshot.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true, name: true },
          });

          if (!product || product.stock < item.quantity) {
            throw new BadRequestException(`������ "${item.productName}" ���� ����`);
          }
        }

        // Create order
        const order = await tx.order.create({
          data: {
            userId,
            orderNumber: `ORD-${Date.now()}`,
            subtotal: new Decimal(session.cartSnapshot.subtotal),
            taxAmount: new Decimal(session.cartSnapshot.taxAmount),
            shippingCost: new Decimal(session.cartSnapshot.shippingCost),
            totalAmount: new Decimal(session.cartSnapshot.total),
            status: 'PENDING',
            paymentStatus: 'PENDING',
            shippingAddress: session.shippingAddress as any,
            items: {
              create: session.cartSnapshot.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                productSku: `SKU-${item.productId.slice(0, 8)}`,
                quantity: item.quantity,
                price: new Decimal(item.price),
                total: new Decimal(item.price * item.quantity),
                product: { connect: { id: item.productId } },
              })),
            },
          },
        });

        // Decrement stock
        for (const item of session.cartSnapshot.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        return order;
      });

      // Clear cart and checkout session
      await this.cartService.clearCart(userId);

      const sessionKey = this.getSessionKey(sessionId);
      const userKey = this.getUserCheckoutKey(userId);
      await this.stateService.deleteState(sessionKey);
      await this.stateService.deleteState(userKey);

      return { orderId: order.id, orderNumber: order.orderNumber };
    } finally {
      await this.stateService.releaseLock(lock);
    }
  }

  /**
   * Cancel checkout session
   */
  async cancelCheckout(sessionId: string, userId: string): Promise<void> {
    const _session = await this.getSession(sessionId, userId);

    const sessionKey = this.getSessionKey(sessionId);
    const userKey = this.getUserCheckoutKey(userId);

    await this.stateService.deleteState(sessionKey);
    await this.stateService.deleteState(userKey);
  }
}

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

import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import { LoggingService } from '../_observability/logging.service';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../database/prisma.service';
import { MetricsService } from '../monitoring/metrics.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  assertCheckoutActionAllowed,
  flowStateFromStep,
  type CheckoutAction,
} from './checkout-state-machine';
import type {
  CheckoutConfig,
  CheckoutSession,
  CheckoutStep,
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
  private readonly context = CheckoutService.name;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    @Inject('STATE_SERVICE') private readonly stateService: IStateService,
    private readonly loggingService: LoggingService,
    @Optional() private readonly outboxService?: OutboxService,
    @Optional() private readonly metricsService?: MetricsService
  ) {
    this.config = DEFAULT_CONFIG;
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

  private mapStepToFlowState(step: CheckoutStep): string {
    return flowStateFromStep(step);
  }

  private logTransition(
    session: Pick<CheckoutSession, 'id' | 'userId' | 'step'>,
    nextStep: CheckoutStep,
    reason: string,
    details?: Record<string, unknown>
  ): void {
    this.loggingService.log('checkout_transition', this.context, {
      type: 'checkout_transition',
      sessionId: session.id,
      userId: session.userId,
      prev: this.mapStepToFlowState(session.step),
      next: this.mapStepToFlowState(nextStep),
      prevState: this.mapStepToFlowState(session.step),
      nextState: this.mapStepToFlowState(nextStep),
      reason,
      guardReason: null,
      details: details || {},
    });
  }

  private logGuardBlocked(
    session: Pick<CheckoutSession, 'id' | 'userId' | 'step'>,
    targetStep: CheckoutStep,
    guard: string,
    guardReason: string,
    details?: Record<string, unknown>
  ): void {
    this.loggingService.warn('checkout_guard_blocked', this.context, {
      type: 'checkout_guard_blocked',
      sessionId: session.id,
      userId: session.userId,
      guard,
      guardReason,
      prev: this.mapStepToFlowState(session.step),
      next: this.mapStepToFlowState(targetStep),
      prevState: this.mapStepToFlowState(session.step),
      nextState: this.mapStepToFlowState(targetStep),
      reason: guardReason,
      details: details || {},
    });
    this.metricsService?.checkoutGuardBlockedTotal.inc({
      guard,
      guard_reason: guardReason,
      target_step: targetStep,
    });
  }

  private assertStepTransition(
    session: CheckoutSession,
    action: CheckoutAction,
    guard: string
  ): void {
    const transition = assertCheckoutActionAllowed(action, session.step);
    if (transition.allowed) {
      return;
    }

    this.logGuardBlocked(session, transition.targetStep, guard, transition.guardReason, {
      currentStep: session.step,
      action,
    });

    throw new BadRequestException('checkout_step_transition_forbidden');
  }

  private async persistSession(
    session: CheckoutSession,
    previousStep: CheckoutStep,
    reason: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const sessionKey = this.getSessionKey(session.id);
    const persisted = await this.stateService.setState(sessionKey, session, {
      ttlSeconds: this.config.sessionTtlSeconds,
    });

    if (!persisted) {
      this.loggingService.error(
        'checkout_state_persist_failed',
        undefined,
        this.context,
        { sessionId: session.id, userId: session.userId, reason }
      );
      throw new InternalServerErrorException('checkout_state_persist_failed');
    }

    this.logTransition({ ...session, step: previousStep }, session.step, reason, details);
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
    const sessionSaved = await this.stateService.setState(sessionKey, session, {
      ttlSeconds: this.config.sessionTtlSeconds,
    });
    if (!sessionSaved) {
      this.loggingService.error(
        'checkout_init_session_persist_failed',
        undefined,
        this.context,
        { sessionId, userId }
      );
      throw new InternalServerErrorException('checkout_init_session_persist_failed');
    }

    // Track user's active checkout
    const userKey = this.getUserCheckoutKey(userId);
    const userKeySaved = await this.stateService.setState(userKey, sessionId, {
      ttlSeconds: this.config.sessionTtlSeconds,
    });
    if (!userKeySaved) {
      this.loggingService.error(
        'checkout_init_user_key_persist_failed',
        undefined,
        this.context,
        { sessionId, userId }
      );
      throw new InternalServerErrorException('checkout_init_user_key_persist_failed');
    }

    this.logTransition(
      { id: session.id, userId: session.userId, step: 'CART' },
      session.step,
      'checkout_init_success'
    );

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
      this.assertStepTransition(session, 'set_shipping', 'checkout_step_guard');

      const previousStep = session.step;
      session.shippingAddress = address;
      session.step = 'PAYMENT';
      session.updatedAt = new Date();

      await this.persistSession(session, previousStep, 'checkout_shipping_set');

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
      this.assertStepTransition(session, 'set_billing', 'checkout_step_guard');

      const previousStep = session.step;
      session.billingAddress = address;
      session.updatedAt = new Date();

      await this.persistSession(session, previousStep, 'checkout_billing_set');

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
      this.assertStepTransition(session, 'set_payment', 'checkout_step_guard');

      if (!session.shippingAddress) {
        this.logGuardBlocked(
          session,
          'REVIEW',
          'checkout_guard',
          'payment_set_requires_shipping_address'
        );
        throw new BadRequestException('����� ���� ����� �� ���� ����');
      }

      if (method !== 'ONLINE') {
        this.logGuardBlocked(
          session,
          'REVIEW',
          'checkout_guard',
          'unsupported_payment_method',
          { method }
        );
        throw new BadRequestException('only_zarinpal_online_payment_supported');
      }

      const previousStep = session.step;
      session.paymentMethod = method;
      session.step = 'REVIEW';
      session.updatedAt = new Date();

      await this.persistSession(session, previousStep, 'checkout_payment_set', { method });

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
      this.assertStepTransition(session, 'complete', 'checkout_step_guard');

      // Validate session is ready
      if (!session.shippingAddress) {
        this.logGuardBlocked(
          session,
          'COMPLETE',
          'checkout_guard',
          'complete_requires_shipping_address'
        );
        throw new BadRequestException('���� ����� ���� ���� ���');
      }

      if (!session.paymentMethod) {
        this.logGuardBlocked(
          session,
          'COMPLETE',
          'checkout_guard',
          'complete_requires_payment_method'
        );
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

        await this.outboxService?.enqueueInTransaction(tx, {
          aggregateType: 'order',
          aggregateId: order.id,
          eventType: 'order.created',
          dedupKey: `checkout-order-created:${session.id}:${order.id}`,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId,
            sessionId: session.id,
            itemCount: session.cartSnapshot.items.length,
            totalAmount: session.cartSnapshot.total,
            source: 'checkout.complete',
          },
        });

        return order;
      });

      if (!order.id || !order.orderNumber) {
        this.loggingService.error(
          'checkout_order_identity_missing',
          undefined,
          this.context,
          { sessionId, userId }
        );
        throw new InternalServerErrorException('checkout_order_identity_missing');
      }

      const previousStep = session.step;
      session.step = 'COMPLETE';
      session.updatedAt = new Date();
      await this.persistSession(session, previousStep, 'checkout_order_created', {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });

      // Clear cart and checkout session
      await this.cartService.clearCart(userId);
      this.loggingService.log('checkout_side_effect', this.context, {
        type: 'checkout_side_effect',
        action: 'cart_cleared',
        sessionId,
        userId,
      });

      const sessionKey = this.getSessionKey(sessionId);
      const userKey = this.getUserCheckoutKey(userId);
      const sessionDeleted = await this.stateService.deleteState(sessionKey);
      const userKeyDeleted = await this.stateService.deleteState(userKey);

      if (!sessionDeleted || !userKeyDeleted) {
        this.metricsService?.checkoutStateCleanupUntrackedTotal.inc({ action: 'complete_checkout' });
        this.loggingService.error(
          'checkout_state_cleanup_untracked',
          undefined,
          this.context,
          { sessionId, userId, sessionDeleted, userKeyDeleted }
        );
        throw new InternalServerErrorException('checkout_state_cleanup_untracked');
      }

      this.loggingService.log('checkout_side_effect', this.context, {
        type: 'checkout_side_effect',
        action: 'checkout_state_deleted',
        sessionId,
        userId,
      });

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

    const sessionDeleted = await this.stateService.deleteState(sessionKey);
    const userKeyDeleted = await this.stateService.deleteState(userKey);

    if (!sessionDeleted || !userKeyDeleted) {
      this.metricsService?.checkoutStateCleanupUntrackedTotal.inc({ action: 'cancel_checkout' });
      this.loggingService.error(
        'checkout_cancel_cleanup_untracked',
        undefined,
        this.context,
        { sessionId, userId, sessionDeleted, userKeyDeleted }
      );
      throw new InternalServerErrorException('checkout_cancel_cleanup_untracked');
    }

    this.loggingService.log('checkout_side_effect', this.context, {
      type: 'checkout_side_effect',
      action: 'checkout_cancelled',
      sessionId,
      userId,
    });
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Payment Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enterprise payment orchestration with idempotency and audit trail.
 * Supports multiple payment gateways and split payments.
 *
 * Features:
 * - Multi-gateway support (ZarinPal, etc.)
 * - Idempotent payment operations
 * - Split payments for marketplace
 * - Full audit trail
 * - Automatic retry and recovery
 *
 * @module @nextgen/payment
 */

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { type PaymentInitRequest, ZarinPalGateway } from './gateways/zarinpal.gateway';

// ═══════════════════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export type PaymentMethod = 'ZARINPAL' | 'BANK_TRANSFER' | 'CREDIT' | 'CHEQUE';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export interface CreatePaymentDto {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  callbackUrl?: string;
  description?: string;
  idempotencyKey?: string;
  splitPayments?: SplitPayment[];
  metadata?: Record<string, unknown>;
}

export interface SplitPayment {
  vendorId: string;
  iban: string;
  amount: number;
  description?: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  transactionId?: string;
  authority?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  fee: number;
  currency: string;
  gatewayResponse?: Record<string, unknown>;
  refNumber?: string;
  cardNumber?: string;
  paidAt?: Date;
  failedAt?: Date;
  failReason?: string;
  idempotencyKey?: string;
  splitPayments?: SplitPayment[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentInitResult {
  paymentId: string;
  authority?: string;
  gatewayUrl?: string;
  status: PaymentStatus;
  error?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  paymentId: string;
  refNumber?: string;
  cardNumber?: string;
  status: PaymentStatus;
  error?: string;
}

export interface PaymentConfig {
  zarinpal?: {
    merchantId: string;
    sandbox: boolean;
    callbackUrl: string;
  };
  defaultCurrency: string;
  defaultMethod: PaymentMethod;
}

export interface PrismaClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
}

export interface PrismaTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Payment Service
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class PaymentService {
  private config: PaymentConfig;
  private prisma: PrismaClient;
  private zarinpal?: ZarinPalGateway;

  constructor(prisma: PrismaClient, @Inject('PAYMENT_CONFIG') config: PaymentConfig) {
    this.prisma = prisma;
    this.config = config;

    // Initialize gateways
    if (config.zarinpal) {
      this.zarinpal = new ZarinPalGateway(config.zarinpal);
    }
  }

  /**
   * Create and initiate a payment
   */
  async createPayment(dto: CreatePaymentDto): Promise<PaymentInitResult> {
    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        return {
          paymentId: existing.id,
          authority: existing.authority,
          gatewayUrl:
            existing.authority && this.zarinpal
              ? this.zarinpal.getGatewayUrl(existing.authority)
              : undefined,
          status: existing.status,
        };
      }
    }

    // Create payment record
    const paymentId = uuidv4();
    const now = new Date();

    await this.prisma.$executeRaw`
      INSERT INTO payments (
        id, order_id, method, status, amount, fee, currency,
        idempotency_key, metadata, created_at, updated_at
      ) VALUES (
        ${paymentId}::uuid,
        ${dto.orderId}::uuid,
        ${dto.method},
        'PENDING',
        ${dto.amount},
        0,
        ${this.config.defaultCurrency},
        ${dto.idempotencyKey ?? null},
        ${JSON.stringify(dto.metadata ?? {})}::jsonb,
        ${now},
        ${now}
      )
    `;

    // Log audit event
    await this.logAudit(paymentId, 'CREATED', { amount: dto.amount, method: dto.method });

    // Initiate payment based on method
    switch (dto.method) {
      case 'ZARINPAL':
        return this.initiateZarinPal(paymentId, dto);
      case 'BANK_TRANSFER':
        return this.initiateBankTransfer(paymentId, dto);
      case 'CREDIT':
        return this.initiateCredit(paymentId, dto);
      default:
        return {
          paymentId,
          status: 'PENDING',
          error: 'روش پرداخت پشتیبانی نمی‌شود',
        };
    }
  }

  /**
   * Verify a payment callback
   */
  async verifyPayment(authority: string, amount: number): Promise<PaymentVerifyResult> {
    // Find payment by authority
    const payment = await this.findByAuthority(authority);
    if (!payment) {
      return {
        success: false,
        paymentId: '',
        status: 'FAILED',
        error: 'پرداخت یافت نشد',
      };
    }

    // Check if already verified
    if (payment.status === 'COMPLETED') {
      return {
        success: true,
        paymentId: payment.id,
        refNumber: payment.refNumber,
        cardNumber: payment.cardNumber,
        status: 'COMPLETED',
      };
    }

    // Verify with gateway
    if (!this.zarinpal) {
      return {
        success: false,
        paymentId: payment.id,
        status: 'FAILED',
        error: 'درگاه پرداخت پیکربندی نشده است',
      };
    }

    const verifyResult = await this.zarinpal.verify({ authority, amount });

    if (verifyResult.success) {
      // Update payment record
      await this.prisma.$executeRaw`
        UPDATE payments SET
          status = 'COMPLETED',
          ref_number = ${verifyResult.refId},
          card_number = ${verifyResult.cardPan},
          fee = ${verifyResult.fee ?? 0},
          gateway_response = ${JSON.stringify(verifyResult)}::jsonb,
          paid_at = NOW(),
          updated_at = NOW()
        WHERE id = ${payment.id}::uuid
      `;

      // Log audit event
      await this.logAudit(payment.id, 'VERIFIED', {
        refId: verifyResult.refId,
        cardPan: verifyResult.cardPan,
      });

      return {
        success: true,
        paymentId: payment.id,
        refNumber: verifyResult.refId,
        cardNumber: verifyResult.cardPan,
        status: 'COMPLETED',
      };
    }

    // Payment failed
    await this.prisma.$executeRaw`
      UPDATE payments SET
        status = 'FAILED',
        fail_reason = ${verifyResult.error?.messageFA ?? verifyResult.error?.message},
        gateway_response = ${JSON.stringify(verifyResult)}::jsonb,
        failed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${payment.id}::uuid
    `;

    // Log audit event
    await this.logAudit(payment.id, 'FAILED', {
      error: verifyResult.error,
    });

    return {
      success: false,
      paymentId: payment.id,
      status: 'FAILED',
      error: verifyResult.error?.messageFA ?? verifyResult.error?.message,
    };
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<PaymentRecord | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        order_id: string;
        transaction_id: string | null;
        authority: string | null;
        method: PaymentMethod;
        status: PaymentStatus;
        amount: number;
        fee: number;
        currency: string;
        gateway_response: Record<string, unknown> | null;
        ref_number: string | null;
        card_number: string | null;
        paid_at: Date | null;
        failed_at: Date | null;
        fail_reason: string | null;
        idempotency_key: string | null;
        metadata: Record<string, unknown>;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT * FROM payments WHERE id = ${paymentId}::uuid
    `;

    if (results.length === 0) {
      return null;
    }

    const r = results[0];
    return this.mapPaymentRecord(r);
  }

  /**
   * Get payments by order ID
   */
  async getPaymentsByOrder(orderId: string): Promise<PaymentRecord[]> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        order_id: string;
        transaction_id: string | null;
        authority: string | null;
        method: PaymentMethod;
        status: PaymentStatus;
        amount: number;
        fee: number;
        currency: string;
        gateway_response: Record<string, unknown> | null;
        ref_number: string | null;
        card_number: string | null;
        paid_at: Date | null;
        failed_at: Date | null;
        fail_reason: string | null;
        idempotency_key: string | null;
        metadata: Record<string, unknown>;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT * FROM payments 
      WHERE order_id = ${orderId}::uuid
      ORDER BY created_at DESC
    `;

    return results.map((r) => this.mapPaymentRecord(r));
  }

  /**
   * Cancel a pending payment
   */
  async cancelPayment(paymentId: string): Promise<boolean> {
    const payment = await this.getPayment(paymentId);
    if (!payment || payment.status !== 'PENDING') {
      return false;
    }

    await this.prisma.$executeRaw`
      UPDATE payments SET
        status = 'CANCELLED',
        updated_at = NOW()
      WHERE id = ${paymentId}::uuid
    `;

    await this.logAudit(paymentId, 'CANCELLED', {});
    return true;
  }

  /**
   * Refund a completed payment
   */
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<{ success: boolean; error?: string }> {
    const payment = await this.getPayment(paymentId);
    if (!payment || payment.status !== 'COMPLETED') {
      return { success: false, error: 'پرداخت قابل استرداد نیست' };
    }

    if (!payment.authority || !this.zarinpal) {
      return { success: false, error: 'درگاه پرداخت پیکربندی نشده است' };
    }

    const refundResult = await this.zarinpal.refund({
      authority: payment.authority,
      amount,
    });

    if (refundResult.success) {
      await this.prisma.$executeRaw`
        UPDATE payments SET
          status = 'REFUNDED',
          updated_at = NOW()
        WHERE id = ${paymentId}::uuid
      `;

      await this.logAudit(paymentId, 'REFUNDED', { amount, refId: refundResult.refId });
      return { success: true };
    }

    return {
      success: false,
      error: refundResult.error?.messageFA ?? refundResult.error?.message,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private async initiateZarinPal(
    paymentId: string,
    dto: CreatePaymentDto
  ): Promise<PaymentInitResult> {
    if (!this.zarinpal) {
      return {
        paymentId,
        status: 'FAILED',
        error: 'درگاه زرین‌پال پیکربندی نشده است',
      };
    }

    const request: PaymentInitRequest = {
      amount: dto.amount,
      description: dto.description ?? `پرداخت سفارش ${dto.orderId}`,
      callbackUrl: dto.callbackUrl,
      orderId: dto.orderId,
      metadata: dto.metadata,
    };

    // Add split payments
    if (dto.splitPayments && dto.splitPayments.length > 0) {
      request.wages = dto.splitPayments.map((sp) => ({
        iban: sp.iban,
        amount: sp.amount,
        description: sp.description,
      }));
    }

    const result = await this.zarinpal.initiate(request);

    if (result.success && result.authority) {
      // Update payment with authority
      await this.prisma.$executeRaw`
        UPDATE payments SET
          authority = ${result.authority},
          status = 'PROCESSING',
          fee = ${result.fee ?? 0},
          updated_at = NOW()
        WHERE id = ${paymentId}::uuid
      `;

      await this.logAudit(paymentId, 'INITIATED', { authority: result.authority });

      return {
        paymentId,
        authority: result.authority,
        gatewayUrl: result.gatewayUrl,
        status: 'PROCESSING',
      };
    }

    // Failed to initiate
    await this.prisma.$executeRaw`
      UPDATE payments SET
        status = 'FAILED',
        fail_reason = ${result.error?.messageFA ?? result.error?.message},
        failed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${paymentId}::uuid
    `;

    return {
      paymentId,
      status: 'FAILED',
      error: result.error?.messageFA ?? result.error?.message,
    };
  }

  private async initiateBankTransfer(
    paymentId: string,
    _dto: CreatePaymentDto
  ): Promise<PaymentInitResult> {
    // Bank transfer is manual - just mark as pending
    await this.logAudit(paymentId, 'BANK_TRANSFER_INITIATED', {});

    return {
      paymentId,
      status: 'PENDING',
    };
  }

  private async initiateCredit(
    paymentId: string,
    _dto: CreatePaymentDto
  ): Promise<PaymentInitResult> {
    // Credit payment - check organization credit limit
    // This would integrate with the credit management system
    await this.logAudit(paymentId, 'CREDIT_INITIATED', {});

    return {
      paymentId,
      status: 'PENDING',
    };
  }

  private async findByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        order_id: string;
        transaction_id: string | null;
        authority: string | null;
        method: PaymentMethod;
        status: PaymentStatus;
        amount: number;
        fee: number;
        currency: string;
        gateway_response: Record<string, unknown> | null;
        ref_number: string | null;
        card_number: string | null;
        paid_at: Date | null;
        failed_at: Date | null;
        fail_reason: string | null;
        idempotency_key: string | null;
        metadata: Record<string, unknown>;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT * FROM payments WHERE idempotency_key = ${key}
    `;

    if (results.length === 0) {
      return null;
    }
    return this.mapPaymentRecord(results[0]);
  }

  private async findByAuthority(authority: string): Promise<PaymentRecord | null> {
    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        order_id: string;
        transaction_id: string | null;
        authority: string | null;
        method: PaymentMethod;
        status: PaymentStatus;
        amount: number;
        fee: number;
        currency: string;
        gateway_response: Record<string, unknown> | null;
        ref_number: string | null;
        card_number: string | null;
        paid_at: Date | null;
        failed_at: Date | null;
        fail_reason: string | null;
        idempotency_key: string | null;
        metadata: Record<string, unknown>;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT * FROM payments WHERE authority = ${authority}
    `;

    if (results.length === 0) {
      return null;
    }
    return this.mapPaymentRecord(results[0]);
  }

  private mapPaymentRecord(r: {
    id: string;
    order_id: string;
    transaction_id: string | null;
    authority: string | null;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    fee: number;
    currency: string;
    gateway_response: Record<string, unknown> | null;
    ref_number: string | null;
    card_number: string | null;
    paid_at: Date | null;
    failed_at: Date | null;
    fail_reason: string | null;
    idempotency_key: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }): PaymentRecord {
    return {
      id: r.id,
      orderId: r.order_id,
      transactionId: r.transaction_id ?? undefined,
      authority: r.authority ?? undefined,
      method: r.method,
      status: r.status,
      amount: r.amount,
      fee: r.fee,
      currency: r.currency,
      gatewayResponse: r.gateway_response ?? undefined,
      refNumber: r.ref_number ?? undefined,
      cardNumber: r.card_number ?? undefined,
      paidAt: r.paid_at ?? undefined,
      failedAt: r.failed_at ?? undefined,
      failReason: r.fail_reason ?? undefined,
      idempotencyKey: r.idempotency_key ?? undefined,
      metadata: r.metadata,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }

  private async logAudit(
    paymentId: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO audit_logs (action, resource, resource_id, new_value, created_at)
        VALUES ('PAYMENT_${action}', 'payment', ${paymentId}, ${JSON.stringify(data)}::jsonb, NOW())
      `;
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════

export function createPaymentService(prisma: PrismaClient, config: PaymentConfig): PaymentService {
  return new PaymentService(prisma, config);
}

export default {
  PaymentService,
  createPaymentService,
};

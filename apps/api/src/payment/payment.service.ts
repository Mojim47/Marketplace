/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Payment Service
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Integrated payment service using ZarinPalService from libs/payment.
 * Provides endpoints for payment initiation, verification, and refund.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Injectable, BadRequestException, NotFoundException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ZarinPalService, PaymentRequestData } from '@nextgen/payment';
import { PaymentSecurityService, generateIdempotencyKey, generateRequestHash } from './payment-security.service';
import { CircuitBreakerService } from '@nextgen/resilience';
import CircuitBreaker from 'opossum';
import { 
  CreatePaymentDto, 
  VerifyPaymentDto, 
  RefundPaymentDto,
  PaymentRequestResponse,
  PaymentVerifyResponse,
  TransactionDetailsResponse 
} from './dto/payment.dto';

// Audit service interface for dependency injection
export interface PaymentAuditService {
  logPaymentInitiated(userId: string, transactionId: string, amount: number, orderId: string, ipAddress?: string): Promise<void>;
  logPaymentSuccess(userId: string, transactionId: string, amount: number, refId: string, ipAddress?: string): Promise<void>;
  logPaymentFailure(userId: string, transactionId: string, amount: number, reason: string, ipAddress?: string): Promise<void>;
  logPaymentRefund(userId: string, transactionId: string, amount: number, refId: string, ipAddress?: string): Promise<void>;
  logPaymentCallback(authority: string, status: string, ipAddress?: string): Promise<void>;
}

// Token for audit service injection
export const PAYMENT_AUDIT_SERVICE = 'PAYMENT_AUDIT_SERVICE';

/**
 * Persian error messages for payment operations
 */
const ERROR_MESSAGES = {
  ORDER_NOT_FOUND: 'سفارش يافت نشد',
  ORDER_ALREADY_PAID: 'اين سفارش قبلاً پرداخت شده است',
  TRANSACTION_NOT_FOUND: 'تراکنش يافت نشد',
  PAYMENT_CANCELLED: 'پرداخت توسط کاربر لغو شد',
  PAYMENT_VERIFICATION_FAILED: 'تاييد پرداخت ناموفق بود',
  PAYMENT_GATEWAY_ERROR: 'خطا در اتصال به درگاه پرداخت',
  INVALID_AMOUNT: 'مبلغ پرداخت نامعتبر است',
  REFUND_NOT_ALLOWED: 'امکان استرداد اين تراکنش وجود ندارد',
  REFUND_AMOUNT_EXCEEDS: 'مبلغ استرداد بيشتر از مبلغ پرداخت شده است',
  DUPLICATE_REQUEST: 'درخواست تکراري است',
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly zarinpalService: ZarinPalService;
  private readonly requestBreaker: CircuitBreaker;
  private readonly verifyBreaker: CircuitBreaker;
  private readonly refundBreaker: CircuitBreaker;
  private readonly breakerMessage =
    'سرويس پرداخت در حال حاضر در دسترس نيست. لطفاً چند دقيقه ديگر تلاش کنيد.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: PaymentSecurityService,
    private readonly circuitBreakerService: CircuitBreakerService,
    @Inject(PAYMENT_AUDIT_SERVICE) private readonly auditService: PaymentAuditService,
  ) {
    // Initialize ZarinPal service
    this.zarinpalService = new ZarinPalService();
    this.logger.log('PaymentService initialized with ZarinPal integration');

    const breakerOptions = {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    };

    this.requestBreaker = this.circuitBreakerService.createBreaker(
      'zarinpal.request',
      (data) => this.zarinpalService.requestPayment(data),
      breakerOptions,
    );
    this.verifyBreaker = this.circuitBreakerService.createBreaker(
      'zarinpal.verify',
      (authority, amount) => this.zarinpalService.verifyPayment(authority, amount),
      breakerOptions,
    );
    this.refundBreaker = this.circuitBreakerService.createBreaker(
      'zarinpal.refund',
      (refId, amount) => this.zarinpalService.refundPayment(refId, amount),
      breakerOptions,
    );
  }

  /**
   * Request a new payment for an order
   * Requirements: 4.1 - WHEN کاربر پرداخت را شروع مي‌کند THEN THE Payment_Service SHALL درخواست پرداخت به زرين‌پال ارسال کند
   */
  async requestPayment(
    dto: CreatePaymentDto,
    userId: string,
    ipAddress?: string,
  ): Promise<PaymentRequestResponse> {
    const { orderId, callbackUrl, description } = dto;

    // Find the order
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { user: true },
    });

    if (!order) {
      throw new BadRequestException(ERROR_MESSAGES.ORDER_NOT_FOUND);
    }

    if (order.paymentStatus === 'COMPLETED') {
      throw new BadRequestException(ERROR_MESSAGES.ORDER_ALREADY_PAID);
    }

    // Calculate amount in Tomans (ZarinPal uses Tomans)
    const amountInRials = order.totalAmount.toNumber();
    const amountInTomans = Math.floor(amountInRials / 10);

    // Validate amount
    if (!this.securityService.validateAmount(amountInRials)) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_AMOUNT);
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(userId, orderId, amountInRials);
    const requestHash = generateRequestHash({ orderId, amount: amountInRials });

    // Check for duplicate request
    const idempotencyCheck = await this.securityService.checkIdempotency(idempotencyKey, requestHash);
    if (idempotencyCheck.isDuplicate) {
      this.logger.log(`Returning cached payment response for order ${orderId}`);
      return idempotencyCheck.response as PaymentRequestResponse;
    }

    // Prepare callback URL
    const finalCallbackUrl = callbackUrl || `${process.env['APP_URL']}/api/payment/verify`;

    // Prepare payment request data
    const paymentData: PaymentRequestData = {
      amount: amountInTomans,
      description: description || `پرداخت سفارش ${order.orderNumber}`,
      callbackUrl: finalCallbackUrl,
      mobile: order.customerPhone || undefined,
      email: order.customerEmail || undefined,
      metadata: {
        orderId: order.id,
        userId: userId,
        orderNumber: order.orderNumber,
      },
    };

    try {
      // Request payment from ZarinPal
      const zarinpalResponse = await this.circuitBreakerService.fire(
        this.requestBreaker,
        [paymentData],
        this.breakerMessage,
      );

      // Create payment transaction record
      const transaction = await this.prisma.paymentTransaction.create({
        data: {
          userId,
          orderId,
          authority: zarinpalResponse.authority,
          amount: new Decimal(amountInRials),
          description: paymentData.description,
          mobile: order.customerPhone,
          email: order.customerEmail,
          callbackUrl: finalCallbackUrl,
          gateway: 'zarinpal',
          status: 'pending',
        },
      });

      this.logger.log(`Payment request created: ${transaction.id} for order ${orderId}`);

      // Log audit event
      if (this.auditService) {
        await this.auditService.logPaymentInitiated(
          userId,
          transaction.id,
          amountInRials,
          orderId,
          ipAddress,
        );
      }

      const response: PaymentRequestResponse = {
        paymentUrl: zarinpalResponse.redirectUrl,
        authority: zarinpalResponse.authority,
        transactionId: transaction.id,
      };

      // Store idempotent response
      await this.securityService.storeIdempotentResponse(idempotencyKey, requestHash, response);

      return response;
    } catch (error) {
      this.logger.error(`Payment request failed for order ${orderId}: ${error.message}`);
      
      // Log audit event for failure
      if (this.auditService) {
        await this.auditService.logPaymentFailure(
          userId,
          'N/A',
          amountInRials,
          error.message,
          ipAddress,
        );
      }

      throw new BadRequestException(error.message || ERROR_MESSAGES.PAYMENT_GATEWAY_ERROR);
    }
  }

  /**
   * Verify payment after user returns from bank
   * Requirements: 4.2 - WHEN کاربر از بانک برمي‌گردد THEN THE Payment_Service SHALL پرداخت را تاييد کند
   * Requirements: 4.3 - WHEN پرداخت موفق باشد THEN THE Payment_Service SHALL وضعيت سفارش را به‌روز کند
   * Requirements: 4.4 - WHEN پرداخت ناموفق باشد THEN THE Payment_Service SHALL پيام خطاي فارسي برگرداند
   */
  async verifyPayment(
    dto: VerifyPaymentDto,
    ipAddress?: string,
  ): Promise<PaymentVerifyResponse> {
    const { authority, status } = dto;

    // Log callback audit event
    if (this.auditService) {
      await this.auditService.logPaymentCallback(authority, status, ipAddress);
    }

    // Find the transaction
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { authority },
      include: { order: true },
    });

    if (!transaction) {
      throw new NotFoundException(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
    }

    // Check if already verified
    if (transaction.status === 'paid' && transaction.refId) {
      return {
        success: true,
        refId: transaction.refId,
        cardPan: transaction.cardPan || undefined,
        message: 'اين تراکنش قبلاً تاييد شده است',
      };
    }

    // Handle user cancellation
    if (status !== 'OK') {
      await this.prisma.paymentTransaction.update({
        where: { authority },
        data: {
          status: 'failed',
          errorMessage: ERROR_MESSAGES.PAYMENT_CANCELLED,
        },
      });

      // Log audit event
      if (this.auditService) {
        await this.auditService.logPaymentFailure(
          transaction.userId,
          transaction.id,
          transaction.amount.toNumber(),
          ERROR_MESSAGES.PAYMENT_CANCELLED,
          ipAddress,
        );
      }

      return {
        success: false,
        message: ERROR_MESSAGES.PAYMENT_CANCELLED,
      };
    }

    try {
      // Verify payment with ZarinPal (amount in Tomans)
      const amountInTomans = Math.floor(transaction.amount.toNumber() / 10);
      const verifyResponse = await this.circuitBreakerService.fire(
        this.verifyBreaker,
        [authority, amountInTomans],
        this.breakerMessage,
      );

      // Update transaction and order in a single transaction
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.update({
          where: { authority },
          data: {
            status: 'paid',
            refId: verifyResponse.refId,
            cardPan: verifyResponse.cardPan || null,
            cardHash: verifyResponse.cardHash || null,
            feeType: verifyResponse.feeType || null,
            fee: verifyResponse.fee ? new Decimal(verifyResponse.fee) : null,
            paidAt: new Date(),
            verifiedAt: new Date(),
          },
        }),
        this.prisma.order.update({
          where: { id: transaction.orderId! },
          data: {
            paymentStatus: 'COMPLETED',
            status: 'CONFIRMED',
          },
        }),
      ]);

      this.logger.log(`Payment verified: ${transaction.id}, RefID: ${verifyResponse.refId}`);

      // Log audit event
      if (this.auditService) {
        await this.auditService.logPaymentSuccess(
          transaction.userId,
          transaction.id,
          transaction.amount.toNumber(),
          verifyResponse.refId,
          ipAddress,
        );
      }

      return {
        success: true,
        refId: verifyResponse.refId,
        cardPan: verifyResponse.cardPan || undefined,
        message: 'پرداخت با موفقيت انجام شد',
      };
    } catch (error) {
      this.logger.error(`Payment verification failed for ${authority}: ${error.message}`);

      // Update transaction with error
      await this.prisma.paymentTransaction.update({
        where: { authority },
        data: {
          status: 'failed',
          errorMessage: error.message,
        },
      });

      // Log audit event
      if (this.auditService) {
        await this.auditService.logPaymentFailure(
          transaction.userId,
          transaction.id,
          transaction.amount.toNumber(),
          error.message,
          ipAddress,
        );
      }

      return {
        success: false,
        message: error.message || ERROR_MESSAGES.PAYMENT_VERIFICATION_FAILED,
      };
    }
  }

  /**
   * Process refund for a paid transaction
   * Requirements: 4.5 - WHEN درخواست استرداد ارسال مي‌شود THEN THE Payment_Service SHALL استرداد را پردازش کند
   */
  async refundPayment(
    dto: RefundPaymentDto,
    userId: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    const { transactionId, amount, reason } = dto;

    // Find the transaction
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
    }

    // Validate transaction status
    if (transaction.status !== 'paid' || !transaction.refId) {
      throw new BadRequestException(ERROR_MESSAGES.REFUND_NOT_ALLOWED);
    }

    // Calculate refund amount
    const refundAmountRials = amount || transaction.amount.toNumber();
    const refundAmountTomans = Math.floor(refundAmountRials / 10);

    // Validate refund amount
    if (refundAmountRials > transaction.amount.toNumber()) {
      throw new BadRequestException(ERROR_MESSAGES.REFUND_AMOUNT_EXCEEDS);
    }

    try {
      // Request refund from ZarinPal
      await this.circuitBreakerService.fire(
        this.refundBreaker,
        [transaction.refId, refundAmountTomans],
        this.breakerMessage,
      );

      // Update transaction status
      await this.prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'refunded',
          errorMessage: reason || 'استرداد وجه',
        },
      });

      // Update order status if full refund
      if (refundAmountRials === transaction.amount.toNumber() && transaction.orderId) {
        await this.prisma.order.update({
          where: { id: transaction.orderId },
          data: {
            paymentStatus: 'REFUNDED',
            status: 'CANCELLED',
          },
        });
      }

      this.logger.log(`Refund processed: ${transactionId}, Amount: ${refundAmountRials}`);

      // Log audit event
      if (this.auditService) {
        await this.auditService.logPaymentRefund(
          userId,
          transactionId,
          refundAmountRials,
          transaction.refId,
          ipAddress,
        );
      }

      return {
        success: true,
        message: 'استرداد وجه با موفقيت انجام شد',
      };
    } catch (error) {
      this.logger.error(`Refund failed for ${transactionId}: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get transaction details by ID
   */
  async getTransaction(transactionId: string, userId: string): Promise<TransactionDetailsResponse> {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new NotFoundException(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
    }

    return {
      id: transaction.id,
      amount: transaction.amount.toNumber(),
      status: transaction.status,
      gateway: transaction.gateway,
      refId: transaction.refId || undefined,
      createdAt: transaction.createdAt,
      paidAt: transaction.paidAt || undefined,
    };
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ transactions: TransactionDetailsResponse[]; total: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: t.amount.toNumber(),
        status: t.status,
        gateway: t.gateway,
        refId: t.refId || undefined,
        createdAt: t.createdAt,
        paidAt: t.paidAt || undefined,
      })),
      total,
    };
  }

  /**
   * Get unverified transactions for recovery
   */
  async getUnverifiedTransactions(): Promise<any[]> {
    return this.zarinpalService.getUnverifiedTransactions();
  }

  /**
   * Check if ZarinPal is in sandbox mode
   */
  isSandboxMode(): boolean {
    return this.zarinpalService.isSandbox();
  }
}










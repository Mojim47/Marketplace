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

import { Injectable, BadRequestException, NotFoundException, Logger, Inject, OnModuleInit } from '@nestjs/common';
import crypto from 'crypto';
import { Gauge } from 'prom-client';
import { PrismaService } from '../database/prisma.service';
import { PaymentGateway, InvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ZarinPalService, PaymentRequestData } from '@nextgen/payment';
import { PaymentSecurityService, generateIdempotencyKey, generateRequestHash } from './payment-security.service';
import { CircuitBreakerService } from '@nextgen/resilience';
import CircuitBreaker from 'opossum';
import { ConfigService } from '@nestjs/config';
import { TaxService } from '../shared/tax/tax.service';
import { ElectronicSignatureService } from '@nextgen/moodian/electronic-signature.service';
import { SUIDGeneratorService } from '@nextgen/moodian/suid-generator.service';
import { QueueService } from '@nextgen/queue';
import { QUEUE_NAMES } from '@nextgen/queue/queue.constants';
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
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private readonly zarinpalService: ZarinPalService;
  private readonly requestBreaker: CircuitBreaker;
  private readonly verifyBreaker: CircuitBreaker;
  private readonly refundBreaker: CircuitBreaker;
  private readonly breakerMessage =
    'سرويس پرداخت در حال حاضر در دسترس نيست. لطفاً چند دقيقه ديگر تلاش کنيد.';
  private readonly suidGenerator = new SUIDGeneratorService();
  private readonly signatureService: ElectronicSignatureService;
  private slaMonitorHandle: NodeJS.Timeout | null = null;
  private readonly slaGauge = new Gauge({
    name: 'moodian_invoices_pending_24h',
    help: 'Number of invoices older than 24h not delivered',
    labelNames: ['tenant_id'],
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: PaymentSecurityService,
    private readonly circuitBreakerService: CircuitBreakerService,
    @Inject(PAYMENT_AUDIT_SERVICE) private readonly auditService: PaymentAuditService,
    private readonly taxService: TaxService,
    private readonly configService: ConfigService,
    signatureService: ElectronicSignatureService,
    private readonly queueService: QueueService,
  ) {
    // Initialize ZarinPal service
    this.zarinpalService = new ZarinPalService();
    this.signatureService = signatureService;
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
      where: { id: orderId, user_id: userId },
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
          user_id: userId,
          order_id: orderId,
          tenant_id: order.tenant_id,
          transaction_type: 'PAYMENT',
          authority: zarinpalResponse.authority,
          amount: new Decimal(amountInRials),
          description: paymentData.description,
          mobile: order.customerPhone,
          email: order.customerEmail,
          callback_url: finalCallbackUrl,
          gateway: PaymentGateway.ZARINPAL,
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
    if (transaction.status === 'paid' && transaction.ref_id) {
      return {
        success: true,
        refId: transaction.ref_id,
        cardPan: transaction.card_pan || undefined,
        message: 'اين تراکنش قبلاً تاييد شده است',
      };
    }

    // Handle user cancellation
    if (status !== 'OK') {
      await this.prisma.paymentTransaction.update({
        where: { authority },
        data: {
          status: 'failed',
          error_message: ERROR_MESSAGES.PAYMENT_CANCELLED,
        },
      });

      // Log audit event
      if (this.auditService) {
        await this.auditService.logPaymentFailure(
          transaction.user_id,
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
            ref_id: verifyResponse.refId,
            card_pan: this.maskPan(verifyResponse.cardPan),
            card_hash: verifyResponse.cardHash || null,
            fee_type: verifyResponse.feeType || null,
            fee: verifyResponse.fee ? new Decimal(verifyResponse.fee) : null,
            paid_at: new Date(),
            verified_at: new Date(),
          },
        }),
        this.prisma.order.update({
          where: { id: transaction.order_id! },
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
          transaction.user_id,
          transaction.id,
          transaction.amount.toNumber(),
          verifyResponse.refId,
          ipAddress,
        );
      }

      // Gate 2: create invoice + submit to Moodian behind feature flag
      await this.issueInvoiceAndSubmit(transaction, verifyResponse);

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
          error_message: error.message,
        },
      });

      // Log audit event
      if (this.auditService) {
        await this.auditService.logPaymentFailure(
          transaction.user_id,
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
    if (transaction.status !== 'paid' || !transaction.ref_id) {
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
        [transaction.ref_id, refundAmountTomans],
        this.breakerMessage,
      );

      // Update transaction status
      await this.prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'refunded',
          error_message: reason || 'استرداد وجه',
        },
      });

      // Update order status if full refund
      if (refundAmountRials === transaction.amount.toNumber() && transaction.order_id) {
        await this.prisma.order.update({
          where: { id: transaction.order_id },
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
          transaction.ref_id,
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
      where: { id: transactionId, user_id: userId },
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
      createdAt: transaction.created_at,
      paidAt: transaction.paid_at || undefined,
    };
  }

  async onModuleInit() {
    if (this.isMoodianV2Enabled()) {
      this.queueService.registerWorker(
        QUEUE_NAMES.MOODIAN_SUBMIT,
        async (job) => this.processMoodianJob(job),
        {
          concurrency: 3,
          deadLetterQueue: QUEUE_NAMES.MOODIAN_SUBMIT_DLQ,
        },
      );
      // SLA watchdog: flag invoices older than 24h
      this.slaMonitorHandle = setInterval(() => {
        this.monitorSla().catch((err) =>
          this.logger.error(`SLA monitor error: ${err.message}`),
        );
      }, 10 * 60 * 1000); // every 10 minutes
    }
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
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentTransaction.count({ where: { user_id: userId } }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: t.amount.toNumber(),
        status: t.status,
        gateway: t.gateway,
        refId: t.ref_id || undefined,
        createdAt: t.created_at,
        paidAt: t.paid_at || undefined,
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

  private maskPan(pan?: string | null): string | null {
    if (!pan) return null;
    const digits = pan.replace(/\D/g, '');
    if (digits.length < 10) return '****';
    const first6 = digits.slice(0, 6);
    const last4 = digits.slice(-4);
    return `${first6}******${last4}`;
  }

  /**
   * Feature flag check for Moodian v2 flow
   */
  private isMoodianV2Enabled(): boolean {
    return this.configService.get<string>('FEATURE_MOODIAN_V2', 'false') === 'true';
  }

  /**
   * Gate 2: after successful payment, issue invoice, sign, and submit to Moodian
   */
  private async issueInvoiceAndSubmit(transaction: any, verifyResponse: any): Promise<void> {
    if (!this.isMoodianV2Enabled()) {
      return;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: transaction.order_id },
      include: { items: true, tenant: true, user: true },
    });

    if (!order) {
      this.logger.warn(`Order ${transaction.order_id} not found for invoice issuance`);
      return;
    }

    // Idempotency: avoid duplicate invoices per order
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { order_id: order.id },
    });
    if (existingInvoice) {
      this.logger.debug(`Invoice already exists for order ${order.id}, skipping Moodian submission`);
      return;
    }

    const invoiceDate = new Date();
    const sellerTaxId = order.tenant?.tax_id || '00000000000000';
    let suid: string;
    try {
      suid = this.suidGenerator.generateSUID(sellerTaxId, invoiceDate).suid;
    } catch (error) {
      this.logger.error(`Failed to generate SUID for order ${order.id}: ${error.message}`);
      return;
    }

    const invoiceNumber = order.order_number || `INV-${Date.now()}`;
    const subtotal = order.subtotal ?? new Decimal(0);
    const discount = order.discount_amount ?? new Decimal(0);
    const vat = order.tax_amount ?? new Decimal(0);
    const total = order.total ?? new Decimal(0);

    const itemsSnapshot = order.items.map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productSku: item.product_sku,
      name: item.product_name,
      quantity: item.quantity,
      total: item.total,
    }));

    const { signature, signedAt } = this.signatureService.sign({
      orderId: order.id,
      suid,
      invoiceNumber,
      total,
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        tenant_id: order.tenant_id,
        order_id: order.id,
        payment_id: transaction.payment_id ?? null,
        invoice_number: invoiceNumber,
        suid,
        invoice_type: 1,
        invoice_pattern: 1,
        seller_tax_id: sellerTaxId,
        buyer_tax_id: order.user?.national_id || null,
        buyer_postal_code: null,
        status: (InvoiceStatus as any)?.SENT_TO_MOODIAN ?? 'SENT_TO_MOODIAN',
        subtotal,
        discount_amount: discount,
        vat_amount: vat,
        total_amount: total,
        invoice_date: invoiceDate,
        jalali_date: 0,
        buyer_info: {
          userId: order.user_id,
          nationalId: order.user?.national_id ?? null,
          phone: order.user?.phone ?? null,
        },
        items: itemsSnapshot,
        electronic_sign: signature,
        signed_at: signedAt,
      },
    });

    await this.recordInvoiceAudit(invoice.id, 'SENT_TO_MOODIAN', {
      suid,
      invoiceNumber,
      orderId: order.id,
      total,
    });

    // Persist invoice line items for audit
    await this.prisma.invoiceItem.createMany({
      data: order.items.map((item: any) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        title: item.product_name,
        quantity: item.quantity,
        unit_price: new Decimal(item.total).div(item.quantity || 1),
        discount_amount: new Decimal(0),
        total_amount: item.total,
        vat_rate: order.tax_amount && order.total
          ? Number(new Decimal(order.tax_amount).div(order.total).mul(100).toFixed(2))
          : 9,
        vat_amount: order.tax_amount && order.total
          ? new Decimal(item.total).mul(order.tax_amount).div(order.total)
          : new Decimal(item.total).mul(0.09),
      })),
      skipDuplicates: true,
    });

    // Async submit to Moodian/SENA with retry handled inside TaxService
    const queueName = (QUEUE_NAMES as any)?.MOODIAN_SUBMIT ?? 'moodian-submit';
    this.logger.debug(`Enqueue Moodian submit job ${invoice.id} queue=${queueName}`);
    const job = await this.queueService.addJob(
      queueName,
      'submit-invoice',
      { invoiceId: invoice.id },
      { jobId: invoice.id, attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );
    this.logger.debug(`Enqueued job ${job?.id ?? 'n/a'} on ${queueName}`);
  }

  private async processMoodianJob(job: any) {
    const invoiceId = job.data.invoiceId as string;
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    try {
      const submission = await this.taxService.submitInvoice({
        id: invoice.id,
        serial: invoice.invoice_number,
        total: Number(invoice.total_amount),
        createdAt: invoice.invoice_date,
      });

      const statusMap: Record<string, InvoiceStatus> = {
        CONFIRMED: InvoiceStatus.MOODIAN_CONFIRMED,
        PENDING: InvoiceStatus.SENT_TO_MOODIAN,
        REJECTED: InvoiceStatus.MOODIAN_REJECTED,
      };

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: statusMap[submission.status] ?? InvoiceStatus.SENT_TO_MOODIAN,
          moodian_reference_number: submission.senaRefId ?? null,
          moodian_sent_at: new Date(),
          moodian_confirmed_at:
            submission.status === 'CONFIRMED' ? new Date() : null,
          retry_count: submission.status === 'CONFIRMED' ? 0 : invoice.retry_count + 1,
        },
      });

      await this.recordInvoiceAudit(invoice.id, submission.status, submission);
    } catch (error) {
      this.logger.error(`Moodian submit failed for invoice ${invoiceId}: ${error.message}`);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.DRAFT,
          error_message: error.message,
          retry_count: invoice.retry_count + 1,
          last_retry_at: new Date(),
        },
      });
      await this.recordInvoiceAudit(invoice.id, 'SUBMIT_FAILED', { error: error.message });
      throw error;
    }
  }

  private async recordInvoiceAudit(invoiceId: string, event: string, payload: any) {
    const prev = await this.prisma.invoiceAudit.findFirst({
      where: { invoice_id: invoiceId },
      orderBy: { created_at: 'desc' },
    });
    const prevHash = prev?.hash ?? '';
    const hash = this.hashEvent(prevHash, payload);
    await this.prisma.invoiceAudit.create({
      data: {
        invoice_id: invoiceId,
        event,
        payload,
        prev_hash: prevHash || null,
        hash,
      },
    });
  }

  private hashEvent(prevHash: string, payload: any): string {
    return crypto
      .createHash('sha256')
      .update(prevHash + JSON.stringify(payload))
      .digest('hex');
  }

  private async monitorSla() {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const late = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.SENT_TO_MOODIAN] },
        created_at: { lt: threshold },
      },
      select: { id: true, invoice_number: true, status: true, created_at: true, tenant_id: true },
    });

    if (late.length > 0) {
      this.logger.error(`SLA breach: ${late.length} invoices older than 24h not delivered`);
      this.slaGauge.reset();
      for (const inv of late) {
        await this.recordInvoiceAudit(inv.id, 'SLA_BREACH_24H', inv);
        this.slaGauge.inc({ tenant_id: inv.tenant_id ?? 'unknown' });
      }
    }
  }
}










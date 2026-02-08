/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Payment Audit Service
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Audit logging service for payment transactions.
 * Records all financial operations for compliance and security.
 * 
 * Requirements: 7.2 - WHEN  —«ò‰‘ „«·Ì «‰Ã«„ „Ìù‘Êœ THEN THE Audit_Logger SHALL Ã“∆Ì«   —«ò‰‘ —« À»  ò‰œ
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentAuditService as IPaymentAuditService } from './payment.service';
import {
  AuditService as LibAuditService,
  AuditEventType,
  AuditSeverity,
} from '@nextgen/audit';

/**
 * Payment-specific audit event types
 */
export enum PaymentAuditEventType {
  PAYMENT_INITIATED = 'PAYMENT.INITIATED',
  PAYMENT_SUCCESS = 'PAYMENT.SUCCESS',
  PAYMENT_FAILURE = 'PAYMENT.FAILURE',
  PAYMENT_REFUND = 'PAYMENT.REFUND',
  PAYMENT_CALLBACK = 'PAYMENT.CALLBACK',
}

/**
 * Payment audit log entry structure
 */
export interface PaymentAuditEntry {
  id: string;
  eventType: PaymentAuditEventType;
  userId?: string;
  transactionId: string;
  orderId?: string;
  amount: number;
  currency: string;
  gateway: string;
  refId?: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  checksum: string;
}

/**
 * Payment Audit Service
 * 
 * Implements comprehensive audit logging for all payment operations.
 * Uses chain integrity verification for tamper detection.
 */
@Injectable()
export class PaymentAuditService implements IPaymentAuditService {
  private readonly logger = new Logger(PaymentAuditService.name);
  private readonly libAuditService: LibAuditService;

  constructor(private readonly prisma: PrismaService) {
    this.libAuditService = new LibAuditService();
    this.logger.log('PaymentAuditService initialized');
  }

  /**
   * Log payment initiation event
   * Requirements: 7.2 - À»  ‘—Ê⁄  —«ò‰‘ „«·Ì
   */
  async logPaymentInitiated(
    userId: string,
    transactionId: string,
    amount: number,
    orderId: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      // Log to libs/audit service
      await this.libAuditService.logPaymentEvent(
        AuditEventType.PAYMENT_INITIATED,
        userId,
        transactionId,
        amount,
        'SUCCESS',
        {
          orderId,
          gateway: 'zarinpal',
          currency: 'IRR',
          action: 'initiated',
        },
      );

      // Also log to database for persistence
      await this.logToDatabase({
        eventType: PaymentAuditEventType.PAYMENT_INITIATED,
        userId,
        transactionId,
        orderId,
        amount,
        status: 'PENDING',
        ipAddress,
        metadata: { action: 'payment_request' },
      });

      this.logger.log(
        `[AUDIT] Payment initiated: User=${userId}, Transaction=${transactionId}, Amount=${amount}`,
      );
    } catch (error) {
      this.logger.error(`Failed to log payment initiation: ${error.message}`);
      // Don't throw - audit logging should not block payment flow
    }
  }

  /**
   * Log successful payment event
   * Requirements: 7.2 - À»   —«ò‰‘ „Ê›ﬁ
   */
  async logPaymentSuccess(
    userId: string,
    transactionId: string,
    amount: number,
    refId: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      // Log to libs/audit service
      await this.libAuditService.logPaymentEvent(
        AuditEventType.PAYMENT_SUCCESS,
        userId,
        transactionId,
        amount,
        'SUCCESS',
        {
          refId,
          gateway: 'zarinpal',
          currency: 'IRR',
          action: 'verified',
        },
      );

      // Also log to database for persistence
      await this.logToDatabase({
        eventType: PaymentAuditEventType.PAYMENT_SUCCESS,
        userId,
        transactionId,
        amount,
        refId,
        status: 'SUCCESS',
        ipAddress,
        metadata: { action: 'payment_verified', refId },
      });

      this.logger.log(
        `[AUDIT] Payment success: User=${userId}, Transaction=${transactionId}, RefID=${refId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to log payment success: ${error.message}`);
    }
  }

  /**
   * Log failed payment event
   * Requirements: 7.2 - À»   —«ò‰‘ ‰«„Ê›ﬁ
   */
  async logPaymentFailure(
    userId: string,
    transactionId: string,
    amount: number,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      // Log to libs/audit service with WARNING severity
      await this.libAuditService.log({
        type: AuditEventType.PAYMENT_FAILURE,
        userId,
        resource: `payment:${transactionId}`,
        action: 'payment_failed',
        result: 'FAILURE',
        severity: AuditSeverity.WARNING,
        errorMessage: reason,
        ipAddress,
        details: {
          transactionId,
          amount,
          gateway: 'zarinpal',
          currency: 'IRR',
          failureReason: reason,
        },
      });

      // Also log to database for persistence
      await this.logToDatabase({
        eventType: PaymentAuditEventType.PAYMENT_FAILURE,
        userId,
        transactionId,
        amount,
        status: 'FAILURE',
        errorMessage: reason,
        ipAddress,
        metadata: { action: 'payment_failed', reason },
      });

      this.logger.warn(
        `[AUDIT] Payment failure: User=${userId}, Transaction=${transactionId}, Reason=${reason}`,
      );
    } catch (error) {
      this.logger.error(`Failed to log payment failure: ${error.message}`);
    }
  }

  /**
   * Log refund event
   * Requirements: 7.2 - À»  «” —œ«œ ÊÃÂ
   */
  async logPaymentRefund(
    userId: string,
    transactionId: string,
    amount: number,
    refId: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      // Log to libs/audit service
      await this.libAuditService.logPaymentEvent(
        AuditEventType.PAYMENT_REFUND,
        userId,
        transactionId,
        amount,
        'SUCCESS',
        {
          refId,
          gateway: 'zarinpal',
          currency: 'IRR',
          action: 'refunded',
        },
      );

      // Also log to database for persistence
      await this.logToDatabase({
        eventType: PaymentAuditEventType.PAYMENT_REFUND,
        userId,
        transactionId,
        amount,
        refId,
        status: 'SUCCESS',
        ipAddress,
        metadata: { action: 'payment_refunded', refId },
      });

      this.logger.log(
        `[AUDIT] Payment refund: User=${userId}, Transaction=${transactionId}, Amount=${amount}`,
      );
    } catch (error) {
      this.logger.error(`Failed to log payment refund: ${error.message}`);
    }
  }

  /**
   * Log payment callback event
   * Requirements: 7.2 - À»  callback «“ œ—ê«Â
   */
  async logPaymentCallback(
    authority: string,
    status: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      // Log to libs/audit service
      await this.libAuditService.log({
        type: AuditEventType.PAYMENT_CALLBACK,
        action: 'payment_callback',
        result: status === 'OK' ? 'SUCCESS' : 'FAILURE',
        ipAddress,
        details: {
          authority,
          callbackStatus: status,
          gateway: 'zarinpal',
        },
      });

      // Also log to database for persistence
      await this.logToDatabase({
        eventType: PaymentAuditEventType.PAYMENT_CALLBACK,
        transactionId: authority,
        amount: 0,
        status: status === 'OK' ? 'SUCCESS' : 'FAILURE',
        ipAddress,
        metadata: { action: 'callback_received', callbackStatus: status },
      });

      this.logger.log(
        `[AUDIT] Payment callback: Authority=${authority}, Status=${status}`,
      );
    } catch (error) {
      this.logger.error(`Failed to log payment callback: ${error.message}`);
    }
  }

  /**
   * Log audit entry to database
   * Uses AuditLog table for persistence
   */
  private async logToDatabase(params: {
    eventType: PaymentAuditEventType;
    userId?: string;
    transactionId: string;
    orderId?: string;
    amount: number;
    refId?: string;
    status: 'SUCCESS' | 'FAILURE' | 'PENDING';
    errorMessage?: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: params.eventType,
          entity: 'PaymentTransaction',
          entityId: params.transactionId,
          adminId: params.userId || null,
          changes: {
            amount: params.amount,
            status: params.status,
            refId: params.refId,
            orderId: params.orderId,
            errorMessage: params.errorMessage,
            ipAddress: params.ipAddress,
            ...params.metadata,
          },
        },
      });
    } catch (error) {
      // Log error but don't throw - database logging is secondary
      this.logger.error(`Failed to persist audit log: ${error.message}`);
    }
  }

  /**
   * Query payment audit logs
   */
  async queryPaymentAuditLogs(params: {
    userId?: string;
    transactionId?: string;
    eventType?: PaymentAuditEventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const where: any = {
      entity: 'PaymentTransaction',
    };

    if (params.userId) {
      where.adminId = params.userId;
    }

    if (params.transactionId) {
      where.entityId = params.transactionId;
    }

    if (params.eventType) {
      where.action = params.eventType;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 100,
      skip: params.offset || 0,
    });
  }

  /**
   * Get payment audit statistics
   */
  async getPaymentAuditStats(startDate: Date, endDate: Date): Promise<{
    totalTransactions: number;
    successfulPayments: number;
    failedPayments: number;
    refunds: number;
    totalAmount: number;
  }> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity: 'PaymentTransaction',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let totalTransactions = 0;
    let successfulPayments = 0;
    let failedPayments = 0;
    let refunds = 0;
    let totalAmount = 0;

    for (const log of logs) {
      const changes = log.changes as any;
      
      if (log.action === PaymentAuditEventType.PAYMENT_INITIATED) {
        totalTransactions++;
      } else if (log.action === PaymentAuditEventType.PAYMENT_SUCCESS) {
        successfulPayments++;
        totalAmount += changes?.amount || 0;
      } else if (log.action === PaymentAuditEventType.PAYMENT_FAILURE) {
        failedPayments++;
      } else if (log.action === PaymentAuditEventType.PAYMENT_REFUND) {
        refunds++;
      }
    }

    return {
      totalTransactions,
      successfulPayments,
      failedPayments,
      refunds,
      totalAmount,
    };
  }
}

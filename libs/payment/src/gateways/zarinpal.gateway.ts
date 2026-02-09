/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - ZarinPal Payment Gateway
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enterprise ZarinPal integration with split payments support.
 * Handles payment initiation, verification, and refunds.
 *
 * Features:
 * - Payment initiation with callback URL
 * - Payment verification
 * - Split payments (تسهیم) for marketplace
 * - Refund support
 * - Sandbox mode for testing
 *
 * @module @nextgen/payment
 */

import { Injectable } from '@nestjs/common';

// ═══════════════════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface ZarinPalConfig {
  merchantId: string;
  sandbox: boolean;
  callbackUrl: string;
}

export interface PaymentInitRequest {
  amount: number; // In Rials
  description: string;
  callbackUrl?: string;
  mobile?: string;
  email?: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
  wages?: WageItem[]; // Split payments
}

export interface WageItem {
  iban: string;
  amount: number;
  description?: string;
}

export interface PaymentInitResponse {
  success: boolean;
  authority?: string;
  gatewayUrl?: string;
  fee?: number;
  feeType?: string;
  error?: PaymentError;
}

export interface PaymentVerifyRequest {
  authority: string;
  amount: number;
}

export interface PaymentVerifyResponse {
  success: boolean;
  refId?: string;
  cardPan?: string;
  cardHash?: string;
  feeType?: string;
  fee?: number;
  wages?: WageVerifyItem[];
  error?: PaymentError;
}

export interface WageVerifyItem {
  iban: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'FAILED';
}

export interface RefundRequest {
  authority: string;
  amount?: number; // Partial refund if specified
}

export interface RefundResponse {
  success: boolean;
  refId?: string;
  error?: PaymentError;
}

export interface PaymentError {
  code: number;
  message: string;
  messageFA?: string;
}

export interface InquiryResponse {
  success: boolean;
  status?: PaymentStatus;
  amount?: number;
  refId?: string;
  error?: PaymentError;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'VERIFIED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

// ═══════════════════════════════════════════════════════════════════════════
// ZarinPal Error Codes
// ═══════════════════════════════════════════════════════════════════════════

export const ZARINPAL_ERRORS: Record<number, { en: string; fa: string }> = {
  '-1': { en: 'Information submitted is incomplete', fa: 'اطلاعات ارسال شده ناقص است' },
  '-2': { en: 'IP or merchant code is not correct', fa: 'آی‌پی یا مرچنت کد صحیح نیست' },
  '-3': { en: 'Amount should be above 1000 Rials', fa: 'مبلغ باید بالای ۱۰۰۰ ریال باشد' },
  '-4': {
    en: 'Approved level of merchant is lower than silver',
    fa: 'سطح تایید پذیرنده پایین‌تر از سطح نقره‌ای است',
  },
  '-11': { en: 'Request not found', fa: 'درخواست مورد نظر یافت نشد' },
  '-12': { en: 'Unable to edit request', fa: 'امکان ویرایش درخواست وجود ندارد' },
  '-21': {
    en: 'No financial operation found for this transaction',
    fa: 'هیچ نوع عملیات مالی برای این تراکنش یافت نشد',
  },
  '-22': { en: 'Transaction is unsuccessful', fa: 'تراکنش ناموفق است' },
  '-33': {
    en: 'Transaction amount does not match',
    fa: 'مبلغ تراکنش با مبلغ پرداخت شده مطابقت ندارد',
  },
  '-34': { en: 'Transaction limit exceeded', fa: 'سقف تقسیم تراکنش از حد مجاز بیشتر است' },
  '-40': { en: 'Invalid access to method', fa: 'دسترسی به متد مربوطه وجود ندارد' },
  '-41': { en: 'Invalid AdditionalData', fa: 'اطلاعات اضافی نامعتبر است' },
  '-42': {
    en: 'Validity period of ID payment has expired',
    fa: 'مدت زمان معتبر درخواست پرداخت منقضی شده است',
  },
  '-54': { en: 'Request archived', fa: 'درخواست آرشیو شده است' },
  '100': { en: 'Operation was successful', fa: 'عملیات موفق' },
  '101': {
    en: 'Operation was successful but verify has been done before',
    fa: 'عملیات موفق ولی تایید قبلاً انجام شده',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ZarinPal Gateway Service
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class ZarinPalGateway {
  private config: ZarinPalConfig;
  private baseUrl: string;
  private gatewayUrl: string;

  constructor(config: ZarinPalConfig) {
    this.config = config;
    this.baseUrl = config.sandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://api.zarinpal.com/pg/v4/payment';
    this.gatewayUrl = config.sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://www.zarinpal.com/pg/StartPay';
  }

  /**
   * Initialize a payment request
   */
  async initiate(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    try {
      const payload: Record<string, unknown> = {
        merchant_id: this.config.merchantId,
        amount: request.amount,
        description: request.description,
        callback_url: request.callbackUrl ?? this.config.callbackUrl,
      };

      if (request.mobile) {
        payload.mobile = request.mobile;
      }
      if (request.email) {
        payload.email = request.email;
      }
      if (request.orderId) {
        payload.order_id = request.orderId;
      }
      if (request.metadata) {
        payload.metadata = request.metadata;
      }

      // Add split payments (wages)
      if (request.wages && request.wages.length > 0) {
        payload.wages = request.wages.map((w) => ({
          iban: w.iban,
          amount: w.amount,
          description: w.description ?? '',
        }));
      }

      const response = await fetch(`${this.baseUrl}/request.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.data && data.data.code === 100) {
        return {
          success: true,
          authority: data.data.authority,
          gatewayUrl: `${this.gatewayUrl}/${data.data.authority}`,
          fee: data.data.fee,
          feeType: data.data.fee_type,
        };
      }

      const errorCode = data.errors?.code ?? -1;
      const errorInfo = ZARINPAL_ERRORS[errorCode] ?? { en: 'Unknown error', fa: 'خطای ناشناخته' };

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorInfo.en,
          messageFA: errorInfo.fa,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: -999,
          message: (error as Error).message,
          messageFA: 'خطا در برقراری ارتباط با درگاه پرداخت',
        },
      };
    }
  }

  /**
   * Verify a payment
   */
  async verify(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    try {
      const payload = {
        merchant_id: this.config.merchantId,
        authority: request.authority,
        amount: request.amount,
      };

      const response = await fetch(`${this.baseUrl}/verify.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.data && (data.data.code === 100 || data.data.code === 101)) {
        return {
          success: true,
          refId: data.data.ref_id?.toString(),
          cardPan: data.data.card_pan,
          cardHash: data.data.card_hash,
          feeType: data.data.fee_type,
          fee: data.data.fee,
          wages: data.data.wages?.map((w: { iban: string; amount: number; status: string }) => ({
            iban: w.iban,
            amount: w.amount,
            status: w.status,
          })),
        };
      }

      const errorCode = data.errors?.code ?? -1;
      const errorInfo = ZARINPAL_ERRORS[errorCode] ?? { en: 'Unknown error', fa: 'خطای ناشناخته' };

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorInfo.en,
          messageFA: errorInfo.fa,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: -999,
          message: (error as Error).message,
          messageFA: 'خطا در تایید پرداخت',
        },
      };
    }
  }

  /**
   * Inquiry payment status
   */
  async inquiry(authority: string): Promise<InquiryResponse> {
    try {
      const payload = {
        merchant_id: this.config.merchantId,
        authority,
      };

      const response = await fetch(`${this.baseUrl}/inquiry.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.data) {
        let status: PaymentStatus = 'PENDING';
        switch (data.data.code) {
          case 100:
            status = 'PAID';
            break;
          case 101:
            status = 'VERIFIED';
            break;
          case -21:
          case -22:
            status = 'FAILED';
            break;
          case -54:
            status = 'CANCELLED';
            break;
        }

        return {
          success: true,
          status,
          amount: data.data.amount,
          refId: data.data.ref_id?.toString(),
        };
      }

      const errorCode = data.errors?.code ?? -1;
      const errorInfo = ZARINPAL_ERRORS[errorCode] ?? { en: 'Unknown error', fa: 'خطای ناشناخته' };

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorInfo.en,
          messageFA: errorInfo.fa,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: -999,
          message: (error as Error).message,
          messageFA: 'خطا در استعلام پرداخت',
        },
      };
    }
  }

  /**
   * Refund a payment (requires special merchant permissions)
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const payload: Record<string, unknown> = {
        merchant_id: this.config.merchantId,
        authority: request.authority,
      };

      if (request.amount) {
        payload.amount = request.amount;
      }

      const response = await fetch(`${this.baseUrl}/refund.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.data && data.data.code === 100) {
        return {
          success: true,
          refId: data.data.ref_id?.toString(),
        };
      }

      const errorCode = data.errors?.code ?? -1;
      const errorInfo = ZARINPAL_ERRORS[errorCode] ?? { en: 'Unknown error', fa: 'خطای ناشناخته' };

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorInfo.en,
          messageFA: errorInfo.fa,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: -999,
          message: (error as Error).message,
          messageFA: 'خطا در استرداد وجه',
        },
      };
    }
  }

  /**
   * Get gateway URL for redirect
   */
  getGatewayUrl(authority: string): string {
    return `${this.gatewayUrl}/${authority}`;
  }

  /**
   * Parse callback parameters
   */
  parseCallback(query: Record<string, string>): {
    authority: string;
    status: 'OK' | 'NOK';
  } {
    return {
      authority: query.Authority ?? query.authority ?? '',
      status: (query.Status ?? query.status ?? 'NOK') as 'OK' | 'NOK',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════

export function createZarinPalGateway(config: ZarinPalConfig): ZarinPalGateway {
  return new ZarinPalGateway(config);
}

export default {
  ZarinPalGateway,
  createZarinPalGateway,
  ZARINPAL_ERRORS,
};

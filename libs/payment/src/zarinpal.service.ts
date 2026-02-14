// ═══════════════════════════════════════════════════════════════════════════
// ZarinPal Service - Real ZarinPal Payment Gateway Integration
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BusinessRuleError, ValidationError } from '@nextgen/errors';
import axios, { type AxiosInstance } from 'axios';

interface ZarinpalPaymentRequest {
  amount: number;
  description: string;
  callback_url: string;
  metadata?: {
    payment_id?: string;
    order_id?: string;
    tenant_id?: string;
  };
  mobile?: string;
  email?: string;
}

interface ZarinpalPaymentResponse {
  success: boolean;
  authority?: string;
  payment_url?: string;
  error?: string;
  code?: number;
}

interface ZarinpalVerifyRequest {
  authority: string;
  amount: number;
}

interface ZarinpalVerifyResponse {
  success: boolean;
  ref_id?: string;
  card_hash?: string;
  card_pan?: string;
  fee_type?: string;
  fee?: number;
  error?: string;
  code?: number;
}

@Injectable()
export class ZarinpalService {
  private readonly logger = new Logger(ZarinpalService.name);
  private readonly httpClient: AxiosInstance;
  private readonly merchantId: string;
  private readonly isSandbox: boolean;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.get<string>('ZARINPAL_MERCHANT_ID')!;
    this.isSandbox = this.configService.get<string>('ZARINPAL_SANDBOX') === 'true';

    this.baseUrl = this.isSandbox ? 'https://sandbox.zarinpal.com' : 'https://api.zarinpal.com';

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`ZarinPal API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data,
          sandbox: this.isSandbox,
        });
        return config;
      },
      (error) => {
        this.logger.error('ZarinPal API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`ZarinPal API Response: ${response.status}`, {
          data: response.data,
        });
        return response;
      },
      (error) => {
        this.logger.error('ZarinPal API Response Error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  async requestPayment(request: ZarinpalPaymentRequest): Promise<ZarinpalPaymentResponse> {
    try {
      // Schema validation - format/type checks only
      if (!request.callback_url) {
        throw ValidationError.missingField('callback_url');
      }

      if (!request.description || typeof request.description !== 'string') {
        throw ValidationError.missingField('description');
      }

      if (request.description.length < 3) {
        throw ValidationError.invalidFormat('description', 'minimum 3 characters');
      }

      // Business rule validation - minimum amount is a ZarinPal business constraint
      if (!request.amount || typeof request.amount !== 'number') {
        throw ValidationError.missingField('amount');
      }

      if (request.amount < 1000) {
        throw BusinessRuleError.minimumAmountNotMet('amount', 1000, 'Rials');
      }

      // Convert amount to Rials (ZarinPal expects Rials)
      const amountInRials = Math.round(request.amount * 10);

      const requestData = {
        merchant_id: this.merchantId,
        amount: amountInRials,
        description: request.description,
        callback_url: request.callback_url,
        metadata: request.metadata || {},
        ...(request.mobile && { mobile: request.mobile }),
        ...(request.email && { email: request.email }),
      };

      const response = await this.httpClient.post('/pg/v4/payment/request.json', requestData);

      if (response.data.data && response.data.data.code === 100) {
        const authority = response.data.data.authority;
        const paymentUrl = this.isSandbox
          ? `https://sandbox.zarinpal.com/pg/StartPay/${authority}`
          : `https://www.zarinpal.com/pg/StartPay/${authority}`;

        return {
          success: true,
          authority,
          payment_url: paymentUrl,
        };
      }
      const errorCode = response.data.errors?.code || response.data.data?.code;
      const errorMessage = this.getErrorMessage(errorCode);

      this.logger.warn('ZarinPal payment request failed', {
        code: errorCode,
        message: errorMessage,
        merchantId: this.merchantId,
        amount: request.amount,
      });

      return {
        success: false,
        error: errorMessage,
        code: errorCode,
      };
    } catch (error) {
      this.logger.error('ZarinPal payment request error', error);

      // Re-throw AppError instances
      if (error instanceof ValidationError || error instanceof BusinessRuleError) {
        throw error;
      }

      return {
        success: false,
        error: 'Payment request failed. Please try again.',
      };
    }
  }

  async verifyPayment(request: ZarinpalVerifyRequest): Promise<ZarinpalVerifyResponse> {
    try {
      // Schema validation
      if (!request.authority || typeof request.authority !== 'string') {
        throw ValidationError.missingField('authority');
      }

      if (!request.amount || typeof request.amount !== 'number') {
        throw ValidationError.missingField('amount');
      }

      // Business rule validation
      if (request.amount <= 0) {
        throw BusinessRuleError.violation(
          'Payment amount must be positive',
          'مبلغ پرداخت باید مثبت باشد'
        );
      }

      // Convert amount to Rials
      const amountInRials = Math.round(request.amount * 10);

      const requestData = {
        merchant_id: this.merchantId,
        amount: amountInRials,
        authority: request.authority,
      };

      const response = await this.httpClient.post('/pg/v4/payment/verify.json', requestData);

      if (response.data.data && response.data.data.code === 100) {
        return {
          success: true,
          ref_id: response.data.data.ref_id,
          card_hash: response.data.data.card_hash,
          card_pan: response.data.data.card_pan,
          fee_type: response.data.data.fee_type,
          fee: response.data.data.fee,
        };
      }
      const errorCode = response.data.errors?.code || response.data.data?.code;
      const errorMessage = this.getErrorMessage(errorCode);

      this.logger.warn('ZarinPal payment verification failed', {
        code: errorCode,
        message: errorMessage,
        authority: request.authority,
        amount: request.amount,
      });

      return {
        success: false,
        error: errorMessage,
        code: errorCode,
      };
    } catch (error) {
      this.logger.error('ZarinPal payment verification error', error);

      // Re-throw AppError instances
      if (error instanceof ValidationError || error instanceof BusinessRuleError) {
        throw error;
      }

      return {
        success: false,
        error: 'Payment verification failed. Please contact support.',
      };
    }
  }

  async getPaymentStatus(authority: string): Promise<any> {
    try {
      const response = await this.httpClient.post('/pg/v4/payment/inquiry.json', {
        merchant_id: this.merchantId,
        authority,
      });

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      this.logger.error('ZarinPal payment status inquiry error', error);
      return {
        success: false,
        error: 'Failed to get payment status',
      };
    }
  }

  private getErrorMessage(code: number): string {
    const errorMessages: Record<number, string> = {
      // Success codes
      100: 'Payment successful',
      101: 'Payment already verified',

      // Error codes
      '-9': 'Validation error in submitted information',
      '-10': 'Terminal (merchant_id) not found',
      '-11': 'Terminal (merchant_id) inactive',
      '-12': 'Too many failed attempts',
      '-15': 'Terminal (merchant_id) suspended',
      '-16': 'Terminal (merchant_id) access level insufficient',
      '-30': 'Terminal (merchant_id) does not allow this payment method',
      '-31': 'Terminal (merchant_id) does not allow installment payments',
      '-32': 'Installment payment not available for this amount',
      '-33': 'Installment payment count exceeds allowed limit',
      '-34': 'Installment payment not available for this terminal',
      '-40': 'Invalid additional data',
      '-41': 'Invalid additional data - AdditionalData',
      '-42': 'Payment session timeout',
      '-50': 'Amount must be greater than 100 Tomans',
      '-51': 'Amount exceeds limit',
      '-52': 'Card holder information not found',
      '-53': 'Payment not allowed for this card',
      '-54': 'Payment not allowed for this card',
    };

    return errorMessages[code] || `Unknown error (code: ${code})`;
  }

  // Utility method to check if service is configured
  isConfigured(): boolean {
    return !!(this.merchantId && this.merchantId !== 'CHANGE_IN_PRODUCTION');
  }

  // Get configuration info for debugging
  getConfig() {
    return {
      merchantId: this.merchantId ? `${this.merchantId.substring(0, 8)}...` : 'Not configured',
      isSandbox: this.isSandbox,
      baseUrl: this.baseUrl,
      configured: this.isConfigured(),
    };
  }
}

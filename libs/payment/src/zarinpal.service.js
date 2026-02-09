const __decorate =
  (this && this.__decorate) ||
  ((decorators, target, key, desc) => {
    const c = arguments.length;
    let r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc;
    let d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
      r = Reflect.decorate(decorators, target, key, desc);
    } else {
      for (let i = decorators.length - 1; i >= 0; i--) {
        if ((d = decorators[i])) {
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        }
      }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  });
const __metadata =
  (this && this.__metadata) ||
  ((k, v) => {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') {
      return Reflect.metadata(k, v);
    }
  });
const __importDefault =
  (this && this.__importDefault) || ((mod) => (mod?.__esModule ? mod : { default: mod }));
let ZarinpalService_1;
Object.defineProperty(exports, '__esModule', { value: true });
exports.ZarinpalService = void 0;
const common_1 = require('@nestjs/common');
const config_1 = require('@nestjs/config');
const axios_1 = __importDefault(require('axios'));
let ZarinpalService = (ZarinpalService_1 = class ZarinpalService {
  constructor(configService) {
    Object.defineProperty(this, 'configService', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: configService,
    });
    Object.defineProperty(this, 'logger', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new common_1.Logger(ZarinpalService_1.name),
    });
    Object.defineProperty(this, 'httpClient', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'merchantId', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'isSandbox', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'baseUrl', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.merchantId = this.configService.get('ZARINPAL_MERCHANT_ID');
    this.isSandbox = this.configService.get('ZARINPAL_SANDBOX') === 'true';
    this.baseUrl = this.isSandbox ? 'https://sandbox.zarinpal.com' : 'https://api.zarinpal.com';
    this.httpClient = axios_1.default.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
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
  async requestPayment(request) {
    try {
      if (!request.amount || request.amount < 1000) {
        throw new common_1.BadRequestException('Amount must be at least 1000 Rials');
      }
      if (!request.description || request.description.length < 3) {
        throw new common_1.BadRequestException(
          'Description is required and must be at least 3 characters'
        );
      }
      if (!request.callback_url) {
        throw new common_1.BadRequestException('Callback URL is required');
      }
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
      if (error instanceof common_1.BadRequestException) {
        throw error;
      }
      return {
        success: false,
        error: 'Payment request failed. Please try again.',
      };
    }
  }
  async verifyPayment(request) {
    try {
      if (!request.authority) {
        throw new common_1.BadRequestException('Authority is required');
      }
      if (!request.amount || request.amount <= 0) {
        throw new common_1.BadRequestException('Amount must be greater than 0');
      }
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
      if (error instanceof common_1.BadRequestException) {
        throw error;
      }
      return {
        success: false,
        error: 'Payment verification failed. Please contact support.',
      };
    }
  }
  async getPaymentStatus(authority) {
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
  getErrorMessage(code) {
    const errorMessages = {
      100: 'Payment successful',
      101: 'Payment already verified',
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
  isConfigured() {
    return !!(this.merchantId && this.merchantId !== 'CHANGE_IN_PRODUCTION');
  }
  getConfig() {
    return {
      merchantId: this.merchantId ? `${this.merchantId.substring(0, 8)}...` : 'Not configured',
      isSandbox: this.isSandbox,
      baseUrl: this.baseUrl,
      configured: this.isConfigured(),
    };
  }
});
exports.ZarinpalService = ZarinpalService;
exports.ZarinpalService =
  ZarinpalService =
  ZarinpalService_1 =
    __decorate(
      [(0, common_1.Injectable)(), __metadata('design:paramtypes', [config_1.ConfigService])],
      ZarinpalService
    );
//# sourceMappingURL=zarinpal.service.js.map

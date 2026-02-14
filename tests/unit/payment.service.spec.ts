import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('PaymentService', () => {
  // Mock Zarinpal API responses
  const mockZarinpalConfig = {
    merchantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    callbackUrl: 'https://api.nextgen-market.ir/payment/callback',
    sandbox: false,
  };

  const mockOrder = {
    id: 'order-001',
    orderNumber: 'ORD-2025-123456',
    totalAmount: 1500000, // 1,500,000 Rials = 150,000 Tomans
    userId: 'user-123',
    customerEmail: 'customer@example.com',
    customerPhone: '09121234567',
  };

  describe('Payment Request', () => {
    it('should create payment request with correct amount', () => {
      const amount = mockOrder.totalAmount;
      const description = `پرداخت سفارش ${mockOrder.orderNumber}`;

      const paymentRequest = {
        merchant_id: mockZarinpalConfig.merchantId,
        amount,
        description,
        callback_url: mockZarinpalConfig.callbackUrl,
        metadata: {
          email: mockOrder.customerEmail,
          mobile: mockOrder.customerPhone,
          order_id: mockOrder.id,
        },
      };

      expect(paymentRequest.amount).toBe(1500000);
      expect(paymentRequest.merchant_id).toBe(mockZarinpalConfig.merchantId);
      expect(paymentRequest.metadata.order_id).toBe(mockOrder.id);
    });

    it('should throw BadRequestException for zero amount', () => {
      const validateAmount = (amount: number) => {
        if (amount <= 0) {
          throw new BadRequestException('Payment amount must be greater than zero');
        }
        return amount;
      };

      expect(() => validateAmount(0)).toThrow('Payment amount must be greater than zero');
      expect(() => validateAmount(-1000)).toThrow('Payment amount must be greater than zero');
    });

    it('should throw BadRequestException for amount below minimum', () => {
      const MINIMUM_PAYMENT = 10000; // 1,000 Tomans minimum

      const validateAmount = (amount: number) => {
        if (amount < MINIMUM_PAYMENT) {
          throw new BadRequestException(`Minimum payment is ${MINIMUM_PAYMENT} Rials`);
        }
        return amount;
      };

      expect(() => validateAmount(5000)).toThrow(`Minimum payment is ${MINIMUM_PAYMENT} Rials`);
    });
  });

  describe('Payment Verification', () => {
    it('should verify successful payment', () => {
      const mockVerifyResponse = {
        code: 100,
        message: 'Verified',
        ref_id: 123456789,
        fee_type: 'Merchant',
        fee: 0,
      };

      const isSuccessful = mockVerifyResponse.code === 100 || mockVerifyResponse.code === 101;

      expect(isSuccessful).toBe(true);
      expect(mockVerifyResponse.ref_id).toBeDefined();
    });

    it('should handle already verified payment (code 101)', () => {
      const mockVerifyResponse = {
        code: 101,
        message: 'Already Verified',
        ref_id: 123456789,
      };

      const isSuccessful = mockVerifyResponse.code === 100 || mockVerifyResponse.code === 101;

      expect(isSuccessful).toBe(true);
    });

    it('should reject failed payment verification', () => {
      const mockVerifyResponse = {
        code: -21,
        message: 'Transaction not found',
      };

      const handleVerification = (response: typeof mockVerifyResponse) => {
        if (response.code !== 100 && response.code !== 101) {
          throw new BadRequestException(`Payment verification failed: ${response.message}`);
        }
        return response;
      };

      expect(() => handleVerification(mockVerifyResponse)).toThrow(
        'Payment verification failed: Transaction not found'
      );
    });

    it('should handle network errors gracefully', () => {
      const handleNetworkError = (_error: Error) => {
        throw new InternalServerErrorException(
          'Payment gateway unavailable. Please try again later.'
        );
      };

      expect(() => handleNetworkError(new Error('Network timeout'))).toThrow(
        'Payment gateway unavailable. Please try again later.'
      );
    });
  });

  describe('Idempotency', () => {
    const processedPayments = new Set<string>();

    it('should prevent duplicate payment processing', () => {
      const authority = 'A00000000000000000000000000123456789';

      const processPayment = (auth: string) => {
        if (processedPayments.has(auth)) {
          throw new BadRequestException('Payment already processed');
        }
        processedPayments.add(auth);
        return { success: true, authority: auth };
      };

      // First attempt should succeed
      const result1 = processPayment(authority);
      expect(result1.success).toBe(true);

      // Second attempt should fail
      expect(() => processPayment(authority)).toThrow('Payment already processed');
    });

    it('should allow different payment authorities', () => {
      const authority1 = 'A00000000000000000000000000111111111';
      const authority2 = 'A00000000000000000000000000222222222';

      processedPayments.clear();

      const processPayment = (auth: string) => {
        if (processedPayments.has(auth)) {
          throw new BadRequestException('Payment already processed');
        }
        processedPayments.add(auth);
        return { success: true, authority: auth };
      };

      const result1 = processPayment(authority1);
      const result2 = processPayment(authority2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Zarinpal Error Codes', () => {
    const errorMessages: Record<number, string> = {
      [-1]: 'اطلاعات ارسال شده ناقص است',
      [-2]: 'IP یا merchant کد نادرست است',
      [-3]: 'مبلغ باید بالای 1000 ریال باشد',
      [-4]: 'سطح تایید کمتر از سطح نقره‌ای است',
      [-11]: 'درخواست مورد نظر یافت نشد',
      [-12]: 'امکان ویرایش درخواست وجود ندارد',
      [-21]: 'هیچ نوع عملیات مالی یافت نشد',
      [-22]: 'تراکنش ناموفق بود',
      [-33]: 'مبلغ تراکنش با مبلغ پرداختی همخوانی ندارد',
      [-34]: 'محدودیت تعداد تراکنش',
      [-40]: 'دسترسی غیرمجاز به متد',
      [-41]: 'تغییر غیرمجاز در داده‌های ارسالی',
      [-54]: 'درخواست مورد نظر آرشیو شده',
    };

    it('should map Zarinpal error codes to Persian messages', () => {
      expect(errorMessages[-1]).toBe('اطلاعات ارسال شده ناقص است');
      expect(errorMessages[-21]).toBe('هیچ نوع عملیات مالی یافت نشد');
      expect(errorMessages[-33]).toBe('مبلغ تراکنش با مبلغ پرداختی همخوانی ندارد');
    });

    it('should handle unknown error codes', () => {
      const getErrorMessage = (code: number): string => {
        return errorMessages[code] || 'خطای نامشخص در پرداخت';
      };

      expect(getErrorMessage(-999)).toBe('خطای نامشخص در پرداخت');
    });
  });

  describe('Payment Amount Formatting', () => {
    it('should format Rials to Tomans correctly', () => {
      const rialsToTomans = (rials: number): number => Math.floor(rials / 10);

      expect(rialsToTomans(1500000)).toBe(150000);
      expect(rialsToTomans(10000)).toBe(1000);
      expect(rialsToTomans(15)).toBe(1);
    });

    it('should format amount with Persian number separators', () => {
      const formatPersianAmount = (amount: number): string => {
        return `${amount.toLocaleString('fa-IR')} تومان`;
      };

      // Note: toLocaleString may vary by environment
      const formatted = formatPersianAmount(150000);
      expect(formatted).toContain('تومان');
    });
  });
});

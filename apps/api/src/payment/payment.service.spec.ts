import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PaymentService } from './payment.service';
import { PaymentSecurityService } from './payment-security.service';
import { Decimal } from '@prisma/client/runtime/library';

vi.mock('@nextgen/payment', () => {
  return {
    ZarinPalService: class {
      requestPayment = vi.fn();
      verifyPayment = vi.fn();
      refundPayment = vi.fn();
      getUnverifiedTransactions = vi.fn();
      isSandbox = vi.fn();
    },
  };
});

describe('PaymentService', () => {
  const createService = () => {
    const prisma = {
      order: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      paymentTransaction: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    } as any;

    const securityService = {
      validateAmount: vi.fn(),
      checkIdempotency: vi.fn(),
      storeIdempotentResponse: vi.fn(),
    } as unknown as PaymentSecurityService;

    const circuitBreakerService = {
      createBreaker: (_name: string, action: (...args: any[]) => Promise<any>) => ({
        fire: (...args: any[]) => action(...args),
      }),
      fire: (_breaker: any, args: any[], _message: string) => _breaker.fire(...args),
    } as any;

    const service = new PaymentService(prisma, securityService, circuitBreakerService);

    return { service, prisma, securityService };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requestPayment sends correct data and returns payment url', async () => {
    const { service, prisma, securityService } = createService();

    const order = {
      id: 'order_1',
      userId: 'user_1',
      paymentStatus: 'PENDING',
      totalAmount: new Decimal(100000),
      orderNumber: 'ORD-1',
      customerPhone: '09120000000',
      customerEmail: 'user@example.com',
      user: {},
    };

    prisma.order.findFirst.mockResolvedValue(order);
    securityService.validateAmount = vi.fn().mockReturnValue(true);
    securityService.checkIdempotency = vi.fn().mockResolvedValue({ isDuplicate: false });
    securityService.storeIdempotentResponse = vi.fn().mockResolvedValue(undefined);

    const transaction = {
      id: 'tx_1',
      authority: 'AUTH-1',
    };

    prisma.paymentTransaction.create.mockResolvedValue(transaction);

    const zarinpalResponse = {
      authority: 'AUTH-1',
      redirectUrl: 'https://zarinpal.com/pay/AUTH-1',
    };

    const zarinpal = (service as any).zarinpalService;
    zarinpal.requestPayment.mockResolvedValue(zarinpalResponse);

    const result = await service.requestPayment(
      {
        orderId: 'order_1',
        description: 'Test payment',
        callbackUrl: 'https://example.com/callback',
      } as any,
      'user_1',
    );

    expect(zarinpal.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        description: 'Test payment',
        callbackUrl: 'https://example.com/callback',
        mobile: order.customerPhone,
        email: order.customerEmail,
        metadata: expect.objectContaining({
          orderId: order.id,
          userId: 'user_1',
          orderNumber: order.orderNumber,
        }),
      }),
    );

    expect(result).toEqual({
      paymentUrl: zarinpalResponse.redirectUrl,
      authority: zarinpalResponse.authority,
      transactionId: transaction.id,
    });
  });

  it('verifyPayment updates order and returns success when gateway returns code 100', async () => {
    const { service, prisma } = createService();

    const transaction = {
      id: 'tx_1',
      userId: 'user_1',
      orderId: 'order_1',
      amount: new Decimal(100000),
      status: 'pending',
      refId: null,
      cardPan: null,
    };

    prisma.paymentTransaction.findUnique.mockResolvedValue(transaction);
    prisma.$transaction.mockResolvedValue(undefined);

    const zarinpal = (service as any).zarinpalService;
    zarinpal.verifyPayment.mockResolvedValue({
      refId: 'REF-1',
      cardPan: '1234',
      cardHash: 'hash',
      feeType: 'Merchant',
      fee: 1000,
    });

    const result = await service.verifyPayment({
      authority: 'AUTH-1',
      status: 'OK',
    } as any);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.refId).toBe('REF-1');
  });

  it('verifyPayment returns failure when gateway returns non-100 code', async () => {
    const { service, prisma } = createService();

    const transaction = {
      id: 'tx_1',
      userId: 'user_1',
      orderId: 'order_1',
      amount: new Decimal(100000),
      status: 'pending',
      refId: null,
      cardPan: null,
    };

    prisma.paymentTransaction.findUnique.mockResolvedValue(transaction);
    prisma.paymentTransaction.update.mockResolvedValue(undefined);

    const zarinpal = (service as any).zarinpalService;
    zarinpal.verifyPayment.mockRejectedValue(new Error('Gateway error'));

    const result = await service.verifyPayment({
      authority: 'AUTH-1',
      status: 'OK',
    } as any);

    expect(prisma.paymentTransaction.update).toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

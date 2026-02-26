import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CheckoutService } from './checkout.service';

class InMemoryStateService {
  private readonly store = new Map<string, unknown>();

  async setState<T>(key: string, value: T): Promise<boolean> {
    this.store.set(key, JSON.parse(JSON.stringify(value)));
    return true;
  }

  async getState<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }

  async deleteState(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async acquireLock(key: string): Promise<{ key: string; token: string }> {
    return { key, token: 'lock-token' };
  }

  async releaseLock(_lock: { key: string; token: string }): Promise<boolean> {
    return true;
  }
}

const createService = () => {
  const stateService = new InMemoryStateService();

  const cartService = {
    validateForCheckout: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    getCart: vi.fn().mockResolvedValue({
      items: [{ productId: 'p1', productName: 'Phone', quantity: 1, price: 100000 }],
      subtotal: 100000,
      discount: 0,
      shippingCost: 0,
      taxAmount: 9000,
      total: 109000,
    }),
    clearCart: vi.fn().mockResolvedValue(undefined),
  } as any;

  const prisma = {
    $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn({
        product: {
          findUnique: vi.fn().mockResolvedValue({ stock: 10, name: 'Phone' }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        order: {
          create: vi.fn().mockResolvedValue({ id: 'order-1', order_number: 'ORD-1' }),
        },
      })
    ),
  } as any;

  const loggingService = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;

  const service = new CheckoutService(prisma, cartService, stateService as any, loggingService);
  return { service, stateService, cartService, prisma, loggingService };
};

describe('CheckoutService domain guards', () => {
  it('blocks payment transition before shipping step is completed', async () => {
    const { service, loggingService } = createService();
    const userId = 'user-1';
    const session = await service.initCheckout(userId);

    await expect(service.setPaymentMethod(session.id, userId, 'ONLINE')).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(loggingService.warn).toHaveBeenCalledWith(
      'checkout_guard_blocked',
      'CheckoutService',
      expect.objectContaining({
        guardReason: 'payment_set_requires_payment_step',
      })
    );
  });

  it('blocks complete transition when session is not in REVIEW state', async () => {
    const { service, loggingService } = createService();
    const userId = 'user-2';
    const session = await service.initCheckout(userId);

    await service.setShippingAddress(session.id, userId, {
      fullName: 'Test User',
      phone: '09120000000',
      province: 'Tehran',
      city: 'Tehran',
      address: 'Tehran, Example St',
      postalCode: '1111111111',
    });

    await expect(service.completeCheckout(session.id, userId)).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(loggingService.warn).toHaveBeenCalledWith(
      'checkout_guard_blocked',
      'CheckoutService',
      expect.objectContaining({
        guardReason: 'complete_requires_review_step',
      })
    );
  });

  it('returns order identity only after valid deterministic transitions', async () => {
    const { service, cartService, loggingService } = createService();
    const userId = 'user-3';
    const session = await service.initCheckout(userId);

    await service.setShippingAddress(session.id, userId, {
      fullName: 'Test User',
      phone: '09120000000',
      province: 'Tehran',
      city: 'Tehran',
      address: 'Tehran, Example St',
      postalCode: '1111111111',
    });
    await service.setPaymentMethod(session.id, userId, 'ONLINE');

    const result = await service.completeCheckout(session.id, userId);

    expect(result).toEqual({ orderId: 'order-1', orderNumber: 'ORD-1' });
    expect(cartService.clearCart).toHaveBeenCalledWith(userId);
    expect(loggingService.log).toHaveBeenCalledWith(
      'checkout_transition',
      'CheckoutService',
      expect.objectContaining({
        reason: 'checkout_order_created',
        prev: 'S8_CHECKOUT_PAYMENT_SET',
        next: 'S9_ORDER_CREATED',
      })
    );
  });

  it('fails closed when cleanup side-effect is untracked', async () => {
    const { service, stateService } = createService();
    const userId = 'user-4';
    const session = await service.initCheckout(userId);

    await service.setShippingAddress(session.id, userId, {
      fullName: 'Test User',
      phone: '09120000000',
      province: 'Tehran',
      city: 'Tehran',
      address: 'Tehran, Example St',
      postalCode: '1111111111',
    });
    await service.setPaymentMethod(session.id, userId, 'ONLINE');

    const originalDelete = stateService.deleteState.bind(stateService);
    let deleteCount = 0;
    stateService.deleteState = vi.fn(async (key: string) => {
      deleteCount += 1;
      if (deleteCount === 2) {
        return false;
      }
      return originalDelete(key);
    });

    await expect(service.completeCheckout(session.id, userId)).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });

  it('rejects unsupported payment method with deterministic guard reason', async () => {
    const { service, loggingService } = createService();
    const userId = 'user-5';
    const session = await service.initCheckout(userId);

    await service.setShippingAddress(session.id, userId, {
      fullName: 'Test User',
      phone: '09120000000',
      province: 'Tehran',
      city: 'Tehran',
      address: 'Tehran, Example St',
      postalCode: '1111111111',
    });

    await expect(service.setPaymentMethod(session.id, userId, 'COD' as any)).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(loggingService.warn).toHaveBeenCalledWith(
      'checkout_guard_blocked',
      'CheckoutService',
      expect.objectContaining({
        guardReason: 'unsupported_payment_method',
      })
    );
  });

  it('fails closed when cancel cleanup side-effect is untracked', async () => {
    const { service, stateService } = createService();
    const userId = 'user-6';
    const session = await service.initCheckout(userId);

    const originalDelete = stateService.deleteState.bind(stateService);
    let deleteCount = 0;
    stateService.deleteState = vi.fn(async (key: string) => {
      deleteCount += 1;
      if (deleteCount === 2) {
        return false;
      }
      return originalDelete(key);
    });

    await expect(service.cancelCheckout(session.id, userId)).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CartService } from './cart.service';

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
  const prisma = {
    product: {
      findUnique: vi.fn(),
    },
  } as any;

  const service = new CartService(prisma, stateService as any);
  return { service, prisma, stateService };
};

describe('CartService', () => {
  it('returns empty cart when state does not exist', async () => {
    const { service } = createService();
    const cart = await service.getCart('user-empty');

    expect(cart.items).toEqual([]);
    expect(cart.total).toBe(0);
  });

  it('adds product to cart and calculates totals', async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'Phone',
      sku: 'SKU-1',
      price: 100000,
      stock: 10,
      images: ['https://cdn.local/phone.jpg'],
    });

    const cart = await service.addToCart('user-1', { productId: 'p1', quantity: 2 });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toEqual(
      expect.objectContaining({
        productId: 'p1',
        quantity: 2,
        productName: 'Phone',
        productSku: 'SKU-1',
        price: 100000,
      })
    );
    expect(cart.subtotal).toBe(200000);
    expect(cart.taxAmount).toBe(18000);
    expect(cart.total).toBe(218000);
  });

  it('updates item quantity to zero and removes it', async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'Phone',
      sku: 'SKU-1',
      price: 100000,
      stock: 10,
      images: [],
    });
    await service.addToCart('user-2', { productId: 'p1', quantity: 1 });

    const cart = await service.updateCartItem('user-2', {
      productId: 'p1',
      quantity: 0,
    });

    expect(cart.items).toEqual([]);
    expect(cart.total).toBe(0);
  });

  it('fails validation when product is inactive or missing', async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique
      .mockResolvedValueOnce({
        id: 'p1',
        name: 'Phone',
        sku: 'SKU-1',
        price: 100000,
        stock: 3,
        images: [],
      })
      .mockResolvedValueOnce({
        name: 'Phone',
        stock: 3,
        status: 'INACTIVE',
      });
    await service.addToCart('user-3', { productId: 'p1', quantity: 1 });

    const validation = await service.validateForCheckout('user-3');
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('throws not found when updating a non-existing item', async () => {
    const { service } = createService();

    await expect(
      service.updateCartItem('user-404', { productId: 'missing', quantity: 1 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid discount codes', async () => {
    const { service } = createService();

    await expect(service.applyDiscount('user-discount', 'x')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

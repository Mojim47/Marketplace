import { describe, it, expect } from 'vitest';
import { OrdersService } from './orders.service';
import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ResourceLockedError, ExecutionError } from 'redlock';
import { MetricsService } from '../monitoring/metrics.service';

class SerialLockService {
  lastCall: { resources: string[]; ttl: number; settings?: Record<string, unknown> } | null = null;
  private queues = new Map<string, Promise<void>>();

  async using<T>(
    resources: string[],
    ttl: number,
    routine: (signal: { aborted?: boolean; error?: Error }) => Promise<T>,
    settings?: Record<string, unknown>
  ): Promise<T> {
    this.lastCall = { resources, ttl, settings };
    const key = resources.join('|');
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queues.set(key, previous.then(() => current));

    await previous;
    try {
      return await routine({ aborted: false });
    } finally {
      release();
      if (this.queues.get(key) === current) {
        this.queues.delete(key);
      }
    }
  }

  isLockConflict(error: unknown): boolean {
    return error instanceof ResourceLockedError;
  }

  isLockInfrastructureError(error: unknown): boolean {
    return error instanceof ExecutionError;
  }
}

class InMemoryStateService {
  private store = new Map<string, { value: any; expiresAt: number }>();

  async setState<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<boolean> {
    const ttlMs = (options?.ttlSeconds ?? 3600) * 1000;
    this.store.set(key, { value: JSON.parse(JSON.stringify(value)), expiresAt: Date.now() + ttlMs });
    return true;
  }

  async getState<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async deleteState(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
}

const baseOrderData = {
  vendorId: 'vendor-1',
  customerEmail: 'user@example.com',
  customerPhone: '09120000000',
  shippingAddress: 'Tehran',
  shippingCost: 0,
  items: [
    {
      productId: 'product-1',
      variantId: 'variant-1',
      productName: 'Test Product',
      productSku: 'SKU-1',
      quantity: 1,
      price: 1000,
    },
  ],
};

const createPrismaFake = (stock: number) => {
  const state = { stock, orders: 0 };

  const tx = {
    product: {
      findUnique: async () => ({ id: 'product-1', name: 'Test Product', stock: state.stock }),
      findMany: async () => [{ id: 'product-1', name: 'Test Product', stock: state.stock }],
      updateMany: async ({ where, data }: { where: { stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        if (state.stock >= where.stock.gte) {
          state.stock -= data.stock.decrement;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    order: {
      create: async () => {
        state.orders += 1;
        return {
          id: `order-${state.orders}`,
          orderNumber: `ORD-${state.orders}`,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          totalAmount: 1000,
          createdAt: new Date(),
          items: [],
        };
      },
    },
  } as any;

  const prisma = {
    $transaction: async (fn: (client: any) => Promise<any>) => fn(tx),
  } as any;

  return { prisma, state };
};

const getCounterValue = async (metrics: MetricsService, name: string) => {
  const metric = metrics.getRegistry().getSingleMetric(name) as any;
  if (!metric) return 0;
  const result = await metric.get();
  const values = (result.values || []) as Array<{ value: number }>;
  return values.reduce((sum, v) => sum + v.value, 0);
};

describe('OrdersService - Locking & Concurrency', () => {
  it('serializes concurrent orders and prevents double-decrement', async () => {
    const { prisma, state } = createPrismaFake(1);
    const lockService = new SerialLockService();
    const metrics = new MetricsService();
    const stateService = new InMemoryStateService();
    const service = new OrdersService(prisma, lockService as any, metrics, stateService as any);

    const [first, second] = await Promise.allSettled([
      service.create('user-1', baseOrderData as any),
      service.create('user-1', baseOrderData as any),
    ]);

    const fulfilled = [first, second].filter((r) => r.status === 'fulfilled');
    const rejected = [first, second].filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(state.orders).toBe(1);
    expect(state.stock).toBe(0);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
  });

  it('supports idempotency keys without double-decrement', async () => {
    const { prisma, state } = createPrismaFake(1);
    const lockService = new SerialLockService();
    const metrics = new MetricsService();
    const stateService = new InMemoryStateService();
    const service = new OrdersService(prisma, lockService as any, metrics, stateService as any);

    const first = await service.create('user-1', baseOrderData as any, 'idem-1');
    const second = await service.create('user-1', baseOrderData as any, 'idem-1');

    expect(first.id).toBe('order-1');
    expect(second.id).toBe('order-1');
    expect(state.orders).toBe(1);
    expect(state.stock).toBe(0);
  });

  it('rejects reused idempotency key with different payload', async () => {
    const { prisma } = createPrismaFake(10);
    const lockService = new SerialLockService();
    const metrics = new MetricsService();
    const stateService = new InMemoryStateService();
    const service = new OrdersService(prisma, lockService as any, metrics, stateService as any);

    await service.create('user-1', baseOrderData as any, 'idem-2');

    const mutated = {
      ...baseOrderData,
      items: [{ ...baseOrderData.items[0], quantity: 2 }],
    };

    await expect(service.create('user-1', mutated as any, 'idem-2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes lock resources and settings for SLA-safe behavior', async () => {
    const { prisma } = createPrismaFake(10);
    const lockService = new SerialLockService();
    const metrics = new MetricsService();
    const stateService = new InMemoryStateService();
    const service = new OrdersService(prisma, lockService as any, metrics, stateService as any);

    await service.create('user-1', baseOrderData as any);

    expect(lockService.lastCall?.ttl).toBe(10000);
    expect(lockService.lastCall?.resources).toEqual(['product:product-1:variant:variant-1']);
    expect(lockService.lastCall?.settings).toMatchObject({
      retryCount: 3,
      retryDelay: 150,
      retryJitter: 150,
      automaticExtensionThreshold: 2000,
    });
  });

  it('maps lock conflicts to 409 and increments metrics', async () => {
    const { prisma } = createPrismaFake(10);
    const metrics = new MetricsService();
    const stateService = new InMemoryStateService();
    const service = new OrdersService(prisma, {
      using: async () => {
        throw new ResourceLockedError('locked');
      },
      isLockConflict: (error: unknown) => error instanceof ResourceLockedError,
      isLockInfrastructureError: () => false,
    } as any, metrics, stateService as any);

    await expect(service.create('user-1', baseOrderData as any)).rejects.toBeInstanceOf(ConflictException);

    expect(await getCounterValue(metrics, 'order_lock_conflicts_total')).toBe(1);
  });

  it('maps lock infrastructure errors to 503 and increments metrics', async () => {
    const { prisma } = createPrismaFake(10);
    const metrics = new MetricsService();
    const stateService = new InMemoryStateService();
    const service = new OrdersService(prisma, {
      using: async () => {
        throw new ExecutionError('infra', [] as any);
      },
      isLockConflict: () => false,
      isLockInfrastructureError: (error: unknown) => error instanceof ExecutionError,
    } as any, metrics, stateService as any);

    await expect(service.create('user-1', baseOrderData as any)).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(await getCounterValue(metrics, 'order_lock_infra_errors_total')).toBe(1);
  });

  it('records SLA breach when duration exceeds threshold', async () => {
    const { prisma } = createPrismaFake(10);
    const lockService = new SerialLockService();
    const metrics = new MetricsService();
    const stateService = new InMemoryStateService();
    const service = new OrdersService(prisma, lockService as any, metrics, stateService as any);

    const prev = process.env.ORDER_CREATE_SLA_MS;
    process.env.ORDER_CREATE_SLA_MS = '-1';

    await service.create('user-1', baseOrderData as any);

    expect(await getCounterValue(metrics, 'order_sla_breaches_total')).toBe(1);

    if (prev === undefined) {
      delete process.env.ORDER_CREATE_SLA_MS;
    } else {
      process.env.ORDER_CREATE_SLA_MS = prev;
    }
  });
});

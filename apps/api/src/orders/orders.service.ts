import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { MetricsService } from '../monitoring/metrics.service';
import { OutboxService } from '../outbox/outbox.service';
import type { LocalDistributedLockService } from './local-distributed-lock.service';

interface IStateService {
  setState<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<boolean>;
  getState<T>(key: string): Promise<T | null>;
  deleteState(key: string): Promise<boolean>;
}

const IDEMPOTENCY_TTL_SECONDS = 86400;

type IdempotencyRecord<T> = {
  requestHash: string;
  response: T;
  createdAt: string;
  expiresAt: string;
};

const stableStringify = (value: any): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

type OrderItemInput = {
  productId: string;
  variantId?: string;
  productName?: string;
  productSku?: string;
  quantity: number;
  price: number;
};

type CreateOrderInput = {
  items: OrderItemInput[];
  vendorId?: string;
  shippingCost?: number;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: unknown;
};

const normalizeOrderPayload = (data: CreateOrderInput) => {
  if (!data || !Array.isArray(data.items)) {
    return data;
  }
  const normalizedItems = [...data.items]
    .map((item) => ({ ...item }))
    .sort((a, b) => {
      const keyA = `${a.productId ?? ''}:${a.variantId ?? ''}`;
      const keyB = `${b.productId ?? ''}:${b.variantId ?? ''}`;
      return keyA.localeCompare(keyB);
    });
  return { ...data, items: normalizedItems };
};

const hashOrderRequest = (data: CreateOrderInput): string => {
  const normalized = normalizeOrderPayload(data);
  return createHash('sha256').update(stableStringify(normalized)).digest('hex');
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('DISTRIBUTED_LOCK_SERVICE')
    private readonly lockService: LocalDistributedLockService,
    private readonly metrics: MetricsService,
    @Inject('STATE_SERVICE') private readonly stateService: IStateService,
    @Optional() private readonly outboxService?: OutboxService
  ) {}

  async create(userId: string, data: CreateOrderInput, idempotencyKey?: string) {
    if (!data?.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('ليست اقلام سفارش نمي‌تواند خالي باشد');
    }

    const normalizedIdempotencyKey =
      typeof idempotencyKey === 'string' ? idempotencyKey.trim() : undefined;
    const idempotencyRecordKey = normalizedIdempotencyKey
      ? `order:idempotency:${userId}:${normalizedIdempotencyKey}`
      : null;
    const requestHash = normalizedIdempotencyKey ? hashOrderRequest(data) : null;

    if (idempotencyRecordKey && requestHash) {
      const existing =
        await this.stateService.getState<IdempotencyRecord<any>>(idempotencyRecordKey);
      if (existing) {
        const expiresAt = Number(new Date(existing.expiresAt));
        if (!Number.isNaN(expiresAt) && expiresAt > Date.now()) {
          if (existing.requestHash === requestHash) {
            return existing.response;
          }
          throw new BadRequestException('کليد تکراري با داده متفاوت ارسال شده است');
        }
        await this.stateService.deleteState(idempotencyRecordKey);
      }
    }

    const lockResources = Array.from(
      new Set([
        ...data.items.map((item) =>
          item.variantId
            ? `product:${item.productId}:variant:${item.variantId}`
            : `product:${item.productId}`
        ),
        ...(normalizedIdempotencyKey ? [`idempotency:${userId}:${normalizedIdempotencyKey}`] : []),
      ])
    ).sort();

    const lockSettings = {
      retryCount: 3,
      retryDelay: 150,
      retryJitter: 150,
      automaticExtensionThreshold: 2000,
    } as const;

    const start = Date.now();
    const slaMs = Number(process.env.ORDER_CREATE_SLA_MS || 2000);

    try {
      return await this.lockService.using(
        lockResources,
        10000,
        async (signal) => {
          if (signal.aborted) {
            throw new ServiceUnavailableException(
              'زيرساخت قفل‌گذاري موقتاً در دسترس نيست. لطفاً دوباره تلاش کنيد.'
            );
          }

          return this.prisma.$transaction(async (tx) => {
            const productIds = Array.from(new Set(data.items.map((item) => item.productId)));
            const products = await tx.product.findMany({
              where: { id: { in: productIds } },
              select: { id: true, name: true, stock: true },
            });
            const productMap = new Map(products.map((product) => [product.id, product]));

            for (const item of data.items) {
              const product = productMap.get(item.productId);
              if (!product) {
                throw new NotFoundException('محصول يافت نشد');
              }

              const updated = await tx.product.updateMany({
                where: { id: item.productId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
              });

              if (updated.count === 0) {
                throw new BadRequestException(`موجودي کافي نيست: ${product.name}`);
              }
            }

            const subtotal = data.items.reduce(
              (sum: number, item) => sum + item.price * item.quantity,
              0
            );
            const taxAmount = subtotal * 0.09;
            const totalAmount = subtotal + taxAmount + (data.shippingCost || 0);

            const order = await tx.order.create({
              data: {
                user_id: userId,
                order_number: `ORD-${Date.now()}`,
                status: 'PENDING',
                total_amount: new Decimal(totalAmount),
                items: {
                  create: data.items.map((item) => ({
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_price: new Decimal(item.price),
                    total_price: new Decimal(item.price * item.quantity),
                  })),
                },
              },
              select: {
                id: true,
                order_number: true,
                status: true,
                total_amount: true,
                created_at: true,
                items: {
                  select: {
                    id: true,
                    product_id: true,
                    quantity: true,
                    unit_price: true,
                    total_price: true,
                  },
                },
              },
            });

            this.metrics.ordersTotal.inc({
              status: order.status,
              vendor_id: data.vendorId ?? 'unknown',
            });
            this.metrics.orderValue.observe(
              { vendor_id: data.vendorId ?? 'unknown' },
              Number(order.total_amount)
            );

            const normalizedOrder = {
              id: order.id,
              orderNumber: order.order_number,
              status: order.status,
              totalAmount: Number(order.total_amount),
              createdAt: order.created_at,
              items: order.items.map((item) => ({
                id: item.id,
                productId: item.product_id,
                quantity: item.quantity,
                unitPrice: Number(item.unit_price),
                totalPrice: Number(item.total_price),
              })),
            };

            await this.outboxService?.enqueueInTransaction(tx, {
              aggregateType: 'order',
              aggregateId: order.id,
              eventType: 'order.created',
              dedupKey: `orders-create:${userId}:${normalizedIdempotencyKey ?? order.id}`,
              payload: {
                orderId: order.id,
                orderNumber: order.order_number,
                userId,
                vendorId: data.vendorId ?? null,
                itemCount: data.items.length,
                totalAmount: Number(totalAmount),
                idempotencyKey: normalizedIdempotencyKey ?? null,
                source: 'orders.create',
              },
            });

            if (idempotencyRecordKey && requestHash) {
              try {
                const now = new Date();
                const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000);
                await this.stateService.setState(
                  idempotencyRecordKey,
                  {
                    requestHash,
                    response: normalizedOrder,
                    createdAt: now.toISOString(),
                    expiresAt: expiresAt.toISOString(),
                  },
                  { ttlSeconds: IDEMPOTENCY_TTL_SECONDS }
                );
              } catch (err) {
                this.logger.warn(
                  'Idempotency cache write failed',
                  (err as Error)?.message ?? 'unknown'
                );
              }
            }

            return normalizedOrder;
          });
        },
        lockSettings
      );
    } catch (error) {
      if (this.lockService.isLockConflict(error)) {
        this.metrics.orderLockConflicts.inc({ vendor_id: data.vendorId ?? 'unknown' });
        this.logger.warn('Order lock conflict', {
          vendorId: data.vendorId,
          userId,
          itemCount: data.items.length,
        });
        throw new ConflictException('شخص ديگري در حال خريد اين محصول است. لطفاً دوباره تلاش کنيد.');
      }
      if (this.lockService.isLockInfrastructureError(error)) {
        this.metrics.orderLockInfraErrors.inc({ vendor_id: data.vendorId ?? 'unknown' });
        this.logger.error('Order lock infrastructure error', error as Error);
        throw new ServiceUnavailableException(
          'زيرساخت قفل‌گذاري موقتاً در دسترس نيست. لطفاً دوباره تلاش کنيد.'
        );
      }
      throw error;
    } finally {
      const durationSeconds = (Date.now() - start) / 1000;
      this.metrics.orderCreateDuration.observe(
        { vendor_id: data.vendorId ?? 'unknown' },
        durationSeconds
      );
      if (!Number.isNaN(slaMs) && durationSeconds * 1000 > slaMs) {
        this.metrics.orderSlaBreaches.inc({ vendor_id: data.vendorId ?? 'unknown' });
        this.logger.warn(`Order SLA breached: ${durationSeconds.toFixed(2)}s`, {
          vendorId: data.vendorId,
          userId,
        });
      }
    }
  }

  async findAll(userId: string, filters?: { status?: string; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(Number(filters?.limit ?? 20), 1), 100);
    const offset = Math.max(Number(filters?.offset ?? 0), 0);
    const where: Prisma.OrderWhereInput = {
      user_id: userId,
      ...(filters?.status ? { status: filters.status as Prisma.OrderWhereInput['status'] } : {}),
    };

    const orders = await this.prisma.order.findMany({
      where,
      take: limit,
      skip: offset,
      select: {
        id: true,
        order_number: true,
        status: true,
        total_amount: true,
        created_at: true,
        items: {
          select: {
            id: true,
            product_id: true,
            quantity: true,
            total_price: true,
            unit_price: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      totalAmount: Number(order.total_amount),
      createdAt: order.created_at,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.total_price),
      })),
    }));
  }

  async findOne(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, user_id: userId },
      select: {
        id: true,
        order_number: true,
        status: true,
        total_amount: true,
        created_at: true,
        items: {
          select: {
            id: true,
            product_id: true,
            quantity: true,
            unit_price: true,
            total_price: true,
            product: { select: { name: true } },
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            gateway: true,
            transaction_id: true,
            amount: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('سفارش يافت نشد');
    }
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      totalAmount: Number(order.total_amount),
      createdAt: order.created_at,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.total_price),
      })),
      payment: order.payment
        ? {
            id: order.payment.id,
            status: order.payment.status,
            gateway: order.payment.gateway,
            transactionId: order.payment.transaction_id,
            amount: Number(order.payment.amount),
          }
        : null,
    };
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }
}

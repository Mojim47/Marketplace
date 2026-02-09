import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DistributedLockService } from '@nextgen/cache';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { PrismaService } from '../database/prisma.service';
import type { MetricsService } from '../monitoring/metrics.service';

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
    private readonly lockService: DistributedLockService,
    private readonly metrics: MetricsService,
    @Inject('STATE_SERVICE') private readonly stateService: IStateService
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
                userId,
                vendorId: data.vendorId,
                orderNumber: `ORD-${Date.now()}`,
                subtotal: new Decimal(subtotal),
                taxAmount: new Decimal(taxAmount),
                shippingCost: new Decimal(data.shippingCost || 0),
                totalAmount: new Decimal(totalAmount),
                status: 'PENDING',
                paymentStatus: 'PENDING',
                customerEmail: data.customerEmail,
                customerPhone: data.customerPhone,
                shippingAddress: data.shippingAddress,
                items: {
                  create: data.items.map((item) => ({
                    productId: item.productId,
                    variantId: item.variantId,
                    productName: item.productName,
                    productSku: item.productSku,
                    quantity: item.quantity,
                    price: new Decimal(item.price),
                    total: new Decimal(item.price * item.quantity),
                  })),
                },
              },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                paymentStatus: true,
                totalAmount: true,
                createdAt: true,
                items: {
                  select: {
                    id: true,
                    productId: true,
                    productName: true,
                    productSku: true,
                    quantity: true,
                    price: true,
                    total: true,
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
              Number(totalAmount)
            );

            if (idempotencyRecordKey && requestHash) {
              try {
                const now = new Date();
                const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000);
                await this.stateService.setState(
                  idempotencyRecordKey,
                  {
                    requestHash,
                    response: order,
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

            return order;
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
      userId,
      ...(filters?.status ? { status: filters.status as Prisma.OrderWhereInput['status'] } : {}),
    };

    return this.prisma.order.findMany({
      where,
      take: limit,
      skip: offset,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productSku: true,
            quantity: true,
            total: true,
            product: { select: { name: true, images: true } },
          },
        },
        vendor: { select: { businessName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productSku: true,
            quantity: true,
            total: true,
          },
        },
        vendor: { select: { businessName: true } },
        invoice: true,
      },
    });

    if (!order) {
      throw new NotFoundException('سفارش يافت نشد');
    }
    return order;
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }
}

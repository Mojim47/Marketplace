/**
 * Orders CQRS Service - CQRS Pattern with Transactional Outbox
 * Enterprise Scalability Architecture
 * Requirements: 3.1, 5.1, 5.2
 * 
 * Features:
 * - Write operations go to PostgreSQL (Write_DB)
 * - Transactional outbox for guaranteed event delivery
 * - Atomic business data + event writes
 * - Domain events for order lifecycle
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import type { DomainEvent } from '@nextgen/cqrs';

/** Order status enum */
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

/** Payment status enum */
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

/** Order item interface */
interface OrderItem {
  productId: string;
  variantId?: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
}

/** Create order DTO */
interface CreateOrderDTO {
  vendorId: string;
  items: OrderItem[];
  customerEmail: string;
  customerPhone: string;
  shippingAddress: Record<string, unknown>;
  shippingCost?: number;
}

/** Order entity */
interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  vendorId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: Decimal;
  taxAmount: Decimal;
  shippingCost: Decimal;
  totalAmount: Decimal;
  items: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrdersCqrsService {
  private readonly logger = new Logger(OrdersCqrsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create order with transactional outbox
   * Property 10: Write Operation Routing - All writes go to Write_DB
   * Property 20: Atomic Outbox Write - Business data + events in same transaction
   */
  async create(userId: string, data: CreateOrderDTO): Promise<Order> {
    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      // Validate stock availability
      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.stock < item.quantity) {
          throw new BadRequestException(`„ÊÃÊœÌ ò«›Ì ‰Ì” : ${product?.name || item.productId}`);
        }
      }

      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const taxAmount = subtotal * 0.09; // 9% VAT
      const shippingCost = data.shippingCost || 0;
      const totalAmount = subtotal + taxAmount + shippingCost;

      // Create order in Write_DB
      const order = await tx.order.create({
        data: {
          id: orderId,
          userId,
          vendorId: data.vendorId,
          orderNumber,
          subtotal: new Decimal(subtotal),
          taxAmount: new Decimal(taxAmount),
          shippingCost: new Decimal(shippingCost),
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
        include: { items: true },
      });

      // Decrement stock
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        // Write stock update event to outbox
        const stockEvent = this.createDomainEvent('Product', item.productId, 'product.stock_decremented', {
          productId: item.productId,
          quantity: item.quantity,
          orderId,
        });
        await this.writeToOutbox(tx, stockEvent);
      }

      // Write order created event to outbox (atomic with order creation)
      const orderEvent = this.createDomainEvent('Order', orderId, 'order.created', {
        orderId,
        orderNumber,
        userId,
        vendorId: data.vendorId,
        totalAmount,
        itemCount: data.items.length,
      });
      await this.writeToOutbox(tx, orderEvent);

      this.logger.log(`Order created: ${orderNumber}`);
      return order as unknown as Order;
    });
  }

  /**
   * Update order status with outbox event
   * Property 10: Write Operation Routing
   * Property 20: Atomic Outbox Write
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: { status },
        include: { items: true },
      });

      // Write status change event to outbox
      const event = this.createDomainEvent('Order', id, 'order.status_changed', {
        orderId: id,
        orderNumber: order.orderNumber,
        previousStatus: order.status,
        newStatus: status,
      });
      await this.writeToOutbox(tx, event);

      this.logger.log(`Order ${order.orderNumber} status changed to ${status}`);
      return order as unknown as Order;
    });
  }

  /**
   * Update payment status with outbox event
   * Property 20: Atomic Outbox Write
   */
  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus, paymentDetails?: Record<string, unknown>): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: { paymentStatus },
        include: { items: true },
      });

      // Write payment event to outbox
      const event = this.createDomainEvent('Order', id, 'order.payment_updated', {
        orderId: id,
        orderNumber: order.orderNumber,
        paymentStatus,
        paymentDetails,
      });
      await this.writeToOutbox(tx, event);

      // If payment completed, update order status
      if (paymentStatus === 'PAID') {
        await tx.order.update({
          where: { id },
          data: { status: 'CONFIRMED' },
        });

        const confirmEvent = this.createDomainEvent('Order', id, 'order.confirmed', {
          orderId: id,
          orderNumber: order.orderNumber,
        });
        await this.writeToOutbox(tx, confirmEvent);
      }

      return order as unknown as Order;
    });
  }

  /**
   * Cancel order with stock restoration
   * Property 20: Atomic Outbox Write
   */
  async cancel(id: string, userId: string, reason?: string): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, userId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('”›«—‘ Ì«›  ‰‘œ');
      }

      if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
        throw new BadRequestException('«Ì‰ ”›«—‘ ﬁ«»· ·€Ê ‰Ì” ');
      }

      // Restore stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        const stockEvent = this.createDomainEvent('Product', item.productId, 'product.stock_restored', {
          productId: item.productId,
          quantity: item.quantity,
          orderId: id,
        });
        await this.writeToOutbox(tx, stockEvent);
      }

      // Update order status
      const cancelledOrder = await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { items: true },
      });

      // Write cancellation event
      const event = this.createDomainEvent('Order', id, 'order.cancelled', {
        orderId: id,
        orderNumber: order.orderNumber,
        reason,
        userId,
      });
      await this.writeToOutbox(tx, event);

      this.logger.log(`Order ${order.orderNumber} cancelled`);
      return cancelledOrder as unknown as Order;
    });
  }

  /**
   * Find all orders for user
   * Note: This reads from Write_DB as orders are transactional data
   */
  async findAll(userId: string, filters?: { status?: OrderStatus }): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId, ...filters },
      include: {
        items: { include: { product: { select: { name: true, images: true } } } },
        vendor: { select: { businessName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders as unknown as Order[];
  }

  /**
   * Find single order
   */
  async findOne(id: string, userId: string): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: { include: { product: true } },
        vendor: true,
        invoice: true,
      },
    });

    if (!order) {
      throw new NotFoundException('”›«—‘ Ì«›  ‰‘œ');
    }

    return order as unknown as Order;
  }

  /**
   * Find order by order number
   */
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { items: true, vendor: true },
    });

    return order as unknown as Order | null;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create domain event
   */
  private createDomainEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): DomainEvent {
    return {
      id: uuidv4(),
      aggregateType,
      aggregateId,
      eventType,
      payload,
      timestamp: new Date(),
      version: 1,
    };
  }

  /**
   * Write event to outbox table
   * Property 20: Atomic Outbox Write - Same transaction as business data
   */
  private async writeToOutbox(tx: any, event: DomainEvent): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO outbox_messages (id, aggregate_type, aggregate_id, event_type, payload, created_at, processed_at, retry_count, status)
      VALUES (
        ${event.id}::uuid, 
        ${event.aggregateType}, 
        ${event.aggregateId}, 
        ${event.eventType}, 
        ${JSON.stringify(event.payload)}::jsonb, 
        ${event.timestamp}, 
        NULL, 
        0, 
        'pending'
      )
    `;
  }
}

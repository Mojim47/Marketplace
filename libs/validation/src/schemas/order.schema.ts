// ═══════════════════════════════════════════════════════════════════════════
// Order Validation Schemas - Zod Schemas for Order Operations
// ═══════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// Base order schema
export const OrderSchema = z.object({
  id: z.string().cuid(),
  tenant_id: z.string().cuid(),
  user_id: z.string().cuid(),
  order_number: z.string().min(1).max(50),
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  subtotal: z.number().positive().max(999999999.99),
  tax: z.number().min(0).max(999999999.99),
  total: z.number().positive().max(999999999.99),
  metadata: z.record(z.any()).optional(),
  created_at: z.date(),
  updated_at: z.date(),
  created_by: z.string().cuid().optional(),
  updated_by: z.string().cuid().optional(),
});

// Order item schema
export const OrderItemSchema = z.object({
  id: z.string().cuid(),
  tenant_id: z.string().cuid(),
  order_id: z.string().cuid(),
  product_id: z.string().cuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive().max(999999.99),
  total_price: z.number().positive().max(999999999.99),
  created_at: z.date(),
  updated_at: z.date(),
});

// Create order item schema
export const CreateOrderItemSchema = z.object({
  product_id: z.string().cuid(),
  quantity: z.number().int().positive().max(1000),
});

// Create order schema
export const CreateOrderSchema = z.object({
  items: z.array(CreateOrderItemSchema).min(1).max(100),
  metadata: z.record(z.any()).optional(),
});

// Update order schema
export const UpdateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  metadata: z.record(z.any()).optional(),
});

// Order query schema
export const OrderQuerySchema = z.object({
  user_id: z.string().cuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  min_total: z.number().positive().optional(),
  max_total: z.number().positive().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'total', 'order_number']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Type exports
export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type CreateOrderItemDto = z.infer<typeof CreateOrderItemSchema>;
export type UpdateOrderDto = z.infer<typeof UpdateOrderSchema>;
export type OrderQuery = z.infer<typeof OrderQuerySchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Payment Validation Schemas - Zod Schemas for Payment Operations
// ═══════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// Base payment schema
export const PaymentSchema = z.object({
  id: z.string().cuid(),
  tenant_id: z.string().cuid(),
  order_id: z.string().cuid(),
  amount: z.number().positive().max(999999999.99),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
  gateway: z.string().min(1).max(50),
  gateway_ref: z.string().max(255).optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.date(),
  updated_at: z.date(),
  created_by: z.string().cuid().optional(),
  updated_by: z.string().cuid().optional(),
});

// ZarinPal payment request schema
export const ZarinpalPaymentRequestSchema = z.object({
  order_id: z.string().cuid(),
  amount: z.number().positive().max(999999999.99),
  description: z.string().max(255).optional(),
  mobile: z.string().regex(/^09\d{9}$/).optional(), // Iranian mobile format
  email: z.string().email().optional(),
});

// ZarinPal callback schema
export const ZarinpalCallbackSchema = z.object({
  Authority: z.string().min(1),
  Status: z.string().min(1),
});

// Payment refund schema
export const PaymentRefundSchema = z.object({
  amount: z.number().positive().max(999999999.99).optional(),
  reason: z.string().max(500).optional(),
});

// Payment query schema
export const PaymentQuerySchema = z.object({
  order_id: z.string().cuid().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  gateway: z.string().max(50).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Type exports
export type Payment = z.infer<typeof PaymentSchema>;
export type ZarinpalPaymentRequestDto = z.infer<typeof ZarinpalPaymentRequestSchema>;
export type ZarinpalCallbackDto = z.infer<typeof ZarinpalCallbackSchema>;
export type PaymentRefundDto = z.infer<typeof PaymentRefundSchema>;
export type PaymentQuery = z.infer<typeof PaymentQuerySchema>;
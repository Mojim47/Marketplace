// ═══════════════════════════════════════════════════════════════════════════
// Product Validation Schemas - Zod Schemas for Product Operations
// ═══════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// Base product schema
export const ProductSchema = z.object({
  id: z.string().cuid(),
  tenant_id: z.string().cuid(),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price: z.number().positive().max(999999.99),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']),
  stock: z.number().int().min(0),
  reserved: z.number().int().min(0),
  metadata: z.record(z.any()).optional(),
  created_at: z.date(),
  updated_at: z.date(),
  created_by: z.string().cuid().optional(),
  updated_by: z.string().cuid().optional(),
});

// Create product schema
export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price: z.number().positive().max(999999.99),
  stock: z.number().int().min(0).default(0),
  metadata: z.record(z.any()).optional(),
});

// Update product schema
export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().positive().max(999999.99).optional(),
  stock: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
  metadata: z.record(z.any()).optional(),
});

// Product query schema
export const ProductQuerySchema = z.object({
  search: z.string().max(255).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
  price_min: z.number().positive().optional(),
  price_max: z.number().positive().optional(),
  sort_by: z.enum(['name', 'price', 'created_at', 'updated_at']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Stock update schema
export const UpdateStockSchema = z.object({
  operation: z.enum(['add', 'subtract', 'set']),
  amount: z.number().int().min(0),
});

// Type exports
export type Product = z.infer<typeof ProductSchema>;
export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
export type UpdateStockDto = z.infer<typeof UpdateStockSchema>;

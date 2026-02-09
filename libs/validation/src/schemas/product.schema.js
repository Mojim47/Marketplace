Object.defineProperty(exports, '__esModule', { value: true });
exports.UpdateStockSchema =
  exports.ProductQuerySchema =
  exports.UpdateProductSchema =
  exports.CreateProductSchema =
  exports.ProductSchema =
    void 0;
const zod_1 = require('zod');
exports.ProductSchema = zod_1.z.object({
  id: zod_1.z.string().cuid(),
  tenant_id: zod_1.z.string().cuid(),
  sku: zod_1.z.string().min(1).max(100),
  name: zod_1.z.string().min(1).max(255),
  description: zod_1.z.string().max(2000).optional(),
  price: zod_1.z.number().positive().max(999999.99),
  status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']),
  stock: zod_1.z.number().int().min(0),
  reserved: zod_1.z.number().int().min(0),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
  created_at: zod_1.z.date(),
  updated_at: zod_1.z.date(),
  created_by: zod_1.z.string().cuid().optional(),
  updated_by: zod_1.z.string().cuid().optional(),
});
exports.CreateProductSchema = zod_1.z.object({
  sku: zod_1.z.string().min(1).max(100),
  name: zod_1.z.string().min(1).max(255),
  description: zod_1.z.string().max(2000).optional(),
  price: zod_1.z.number().positive().max(999999.99),
  stock: zod_1.z.number().int().min(0).default(0),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.UpdateProductSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(255).optional(),
  description: zod_1.z.string().max(2000).optional(),
  price: zod_1.z.number().positive().max(999999.99).optional(),
  stock: zod_1.z.number().int().min(0).optional(),
  status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.ProductQuerySchema = zod_1.z.object({
  search: zod_1.z.string().max(255).optional(),
  status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
  price_min: zod_1.z.number().positive().optional(),
  price_max: zod_1.z.number().positive().optional(),
  sort_by: zod_1.z.enum(['name', 'price', 'created_at', 'updated_at']).optional(),
  sort_order: zod_1.z.enum(['asc', 'desc']).optional(),
  limit: zod_1.z.number().int().min(1).max(100).default(20),
  offset: zod_1.z.number().int().min(0).default(0),
});
exports.UpdateStockSchema = zod_1.z.object({
  operation: zod_1.z.enum(['add', 'subtract', 'set']),
  amount: zod_1.z.number().int().min(0),
});
//# sourceMappingURL=product.schema.js.map

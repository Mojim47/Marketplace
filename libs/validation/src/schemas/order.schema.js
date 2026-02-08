"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderQuerySchema = exports.UpdateOrderSchema = exports.CreateOrderSchema = exports.CreateOrderItemSchema = exports.OrderItemSchema = exports.OrderSchema = void 0;
const zod_1 = require("zod");
exports.OrderSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    tenant_id: zod_1.z.string().cuid(),
    user_id: zod_1.z.string().cuid(),
    order_number: zod_1.z.string().min(1).max(50),
    status: zod_1.z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    subtotal: zod_1.z.number().positive().max(999999999.99),
    tax: zod_1.z.number().min(0).max(999999999.99),
    total: zod_1.z.number().positive().max(999999999.99),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    created_at: zod_1.z.date(),
    updated_at: zod_1.z.date(),
    created_by: zod_1.z.string().cuid().optional(),
    updated_by: zod_1.z.string().cuid().optional(),
});
exports.OrderItemSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    tenant_id: zod_1.z.string().cuid(),
    order_id: zod_1.z.string().cuid(),
    product_id: zod_1.z.string().cuid(),
    quantity: zod_1.z.number().int().positive(),
    unit_price: zod_1.z.number().positive().max(999999.99),
    total_price: zod_1.z.number().positive().max(999999999.99),
    created_at: zod_1.z.date(),
    updated_at: zod_1.z.date(),
});
exports.CreateOrderItemSchema = zod_1.z.object({
    product_id: zod_1.z.string().cuid(),
    quantity: zod_1.z.number().int().positive().max(1000),
});
exports.CreateOrderSchema = zod_1.z.object({
    items: zod_1.z.array(exports.CreateOrderItemSchema).min(1).max(100),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.UpdateOrderSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.OrderQuerySchema = zod_1.z.object({
    user_id: zod_1.z.string().cuid().optional(),
    status: zod_1.z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
    date_from: zod_1.z.string().datetime().optional(),
    date_to: zod_1.z.string().datetime().optional(),
    min_total: zod_1.z.number().positive().optional(),
    max_total: zod_1.z.number().positive().optional(),
    sort_by: zod_1.z.enum(['created_at', 'updated_at', 'total', 'order_number']).optional(),
    sort_order: zod_1.z.enum(['asc', 'desc']).optional(),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
    offset: zod_1.z.number().int().min(0).default(0),
});
//# sourceMappingURL=order.schema.js.map
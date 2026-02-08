"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentQuerySchema = exports.PaymentRefundSchema = exports.ZarinpalCallbackSchema = exports.ZarinpalPaymentRequestSchema = exports.PaymentSchema = void 0;
const zod_1 = require("zod");
exports.PaymentSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    tenant_id: zod_1.z.string().cuid(),
    order_id: zod_1.z.string().cuid(),
    amount: zod_1.z.number().positive().max(999999999.99),
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
    gateway: zod_1.z.string().min(1).max(50),
    gateway_ref: zod_1.z.string().max(255).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    created_at: zod_1.z.date(),
    updated_at: zod_1.z.date(),
    created_by: zod_1.z.string().cuid().optional(),
    updated_by: zod_1.z.string().cuid().optional(),
});
exports.ZarinpalPaymentRequestSchema = zod_1.z.object({
    order_id: zod_1.z.string().cuid(),
    amount: zod_1.z.number().positive().max(999999999.99),
    description: zod_1.z.string().max(255).optional(),
    mobile: zod_1.z.string().regex(/^09\d{9}$/).optional(),
    email: zod_1.z.string().email().optional(),
});
exports.ZarinpalCallbackSchema = zod_1.z.object({
    Authority: zod_1.z.string().min(1),
    Status: zod_1.z.string().min(1),
});
exports.PaymentRefundSchema = zod_1.z.object({
    amount: zod_1.z.number().positive().max(999999999.99).optional(),
    reason: zod_1.z.string().max(500).optional(),
});
exports.PaymentQuerySchema = zod_1.z.object({
    order_id: zod_1.z.string().cuid().optional(),
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
    gateway: zod_1.z.string().max(50).optional(),
    date_from: zod_1.z.string().datetime().optional(),
    date_to: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
    offset: zod_1.z.number().int().min(0).default(0),
});
//# sourceMappingURL=payment.schema.js.map
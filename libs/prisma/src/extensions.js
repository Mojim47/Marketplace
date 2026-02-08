/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Prisma Client Extension - Tenant Isolation (The Firewall)
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Automatically inject organizationId into all queries for B2B isolation
 * Security: Prevents any organization from seeing another's data
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { Prisma } from '@prisma/client';
// Global context holder (set by auth middleware)
let currentTenantContext = null;
/**
 * Set tenant context for current request
 * Call this in your authentication middleware after verifying JWT
 */
export function setTenantContext(context) {
    currentTenantContext = context;
}
/**
 * Clear tenant context after request completes
 */
export function clearTenantContext() {
    currentTenantContext = null;
}
/**
 * Get current tenant context
 */
export function getTenantContext() {
    return currentTenantContext;
}
/**
 * Models that should be tenant-isolated
 * Add any model that has organizationId field
 */
const TENANT_ISOLATED_MODELS = [
    'organization',
    'b2BRelation',
    'priceList',
    'productPrice',
    'cheque',
];
/**
 * Check if a model should be tenant-isolated
 */
function shouldIsolateModel(modelName) {
    return TENANT_ISOLATED_MODELS.includes(modelName);
}
/**
 * Helper to safely spread where clause
 */
function safeSpreadWhere(where) {
    if (where && typeof where === 'object') {
        return { ...where };
    }
    return {};
}
/**
 * Helper to safely spread data
 */
function safeSpreadData(data) {
    if (data && typeof data === 'object') {
        return { ...data };
    }
    return {};
}
/**
 * Prisma Client Extension for Tenant Isolation
 */
export const tenantIsolationExtension = Prisma.defineExtension((client) => {
    return client.$extends({
        name: 'tenantIsolation',
        query: {
            $allModels: {
                async findMany({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    const isolatedArgs = {
                        ...args,
                        where: {
                            ...safeSpreadWhere(args['where']),
                            organizationId: context.organizationId,
                        },
                    };
                    return query(isolatedArgs);
                },
                async findFirst({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    const isolatedArgs = {
                        ...args,
                        where: {
                            ...safeSpreadWhere(args['where']),
                            organizationId: context.organizationId,
                        },
                    };
                    return query(isolatedArgs);
                },
                async findUnique({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    const result = await query(args);
                    if (result && typeof result === 'object' && 'organizationId' in result) {
                        if (result['organizationId'] !== context.organizationId) {
                            throw new Error('Access denied: Resource belongs to another organization');
                        }
                    }
                    return result;
                },
                async count({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    const isolatedArgs = {
                        ...args,
                        where: {
                            ...safeSpreadWhere(args['where']),
                            organizationId: context.organizationId,
                        },
                    };
                    return query(isolatedArgs);
                },
                async update({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const existing = await client[model].findUnique({
                        where: args['where'],
                        select: { organizationId: true },
                    });
                    if (!existing || existing.organizationId !== context.organizationId) {
                        throw new Error('Access denied: Cannot update resource from another organization');
                    }
                    return query(args);
                },
                async updateMany({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    const isolatedArgs = {
                        ...args,
                        where: {
                            ...safeSpreadWhere(args['where']),
                            organizationId: context.organizationId,
                        },
                    };
                    return query(isolatedArgs);
                },
                async delete({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const existing = await client[model].findUnique({
                        where: args['where'],
                        select: { organizationId: true },
                    });
                    if (!existing || existing.organizationId !== context.organizationId) {
                        throw new Error('Access denied: Cannot delete resource from another organization');
                    }
                    return query(args);
                },
                async deleteMany({ model, args, query }) {
                    const context = getTenantContext();
                    if (!context || context.role === 'ADMIN') {
                        return query(args);
                    }
                    if (!shouldIsolateModel(model)) {
                        return query(args);
                    }
                    const isolatedArgs = {
                        ...args,
                        where: {
                            ...safeSpreadWhere(args['where']),
                            organizationId: context.organizationId,
                        },
                    };
                    return query(isolatedArgs);
                },
                async create({ model, args, query }) {
                    const context = getTenantContext();
                    if (context?.organizationId && shouldIsolateModel(model)) {
                        const isolatedArgs = {
                            ...args,
                            data: {
                                ...safeSpreadData(args['data']),
                                organizationId: context.organizationId,
                            },
                        };
                        return query(isolatedArgs);
                    }
                    return query(args);
                },
                async createMany({ model, args, query }) {
                    const context = getTenantContext();
                    if (context?.organizationId && shouldIsolateModel(model)) {
                        const dataArray = Array.isArray(args['data']) ? args['data'] : [args['data']];
                        const isolatedArgs = {
                            ...args,
                            data: dataArray.map((item) => ({
                                ...safeSpreadData(item),
                                organizationId: context.organizationId,
                            })),
                        };
                        return query(isolatedArgs);
                    }
                    return query(args);
                },
            },
        },
    });
});
/**
 * Logging extension for debugging
 */
export const loggingExtension = Prisma.defineExtension((client) => {
    return client.$extends({
        name: 'logging',
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    const start = Date.now();
                    const result = await query(args);
                    const end = Date.now();
                    if (process.env['NODE_ENV'] === 'development') {
                        console.log(`[Prisma] ${model}.${operation} took ${end - start}ms`);
                    }
                    return result;
                },
            },
        },
    });
});
//# sourceMappingURL=extensions.js.map
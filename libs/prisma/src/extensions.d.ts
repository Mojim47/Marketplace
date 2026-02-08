/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Prisma Client Extension - Tenant Isolation (The Firewall)
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Automatically inject organizationId into all queries for B2B isolation
 * Security: Prevents any organization from seeing another's data
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * Get current user's organizationId from context
 * This should be set by your authentication middleware
 */
export interface TenantContext {
    organizationId?: string;
    userId?: string;
    role?: string;
}
/**
 * Set tenant context for current request
 * Call this in your authentication middleware after verifying JWT
 */
export declare function setTenantContext(context: TenantContext): void;
/**
 * Clear tenant context after request completes
 */
export declare function clearTenantContext(): void;
/**
 * Get current tenant context
 */
export declare function getTenantContext(): TenantContext | null;
/**
 * Prisma Client Extension for Tenant Isolation
 */
export declare const tenantIsolationExtension: (client: any) => import("@prisma/client").PrismaClientExtends<import("@prisma/client/runtime/library").InternalArgs<{}, {}, {}, {}> & import("@prisma/client/runtime/library").DefaultArgs>;
/**
 * Logging extension for debugging
 */
export declare const loggingExtension: (client: any) => import("@prisma/client").PrismaClientExtends<import("@prisma/client/runtime/library").InternalArgs<{}, {}, {}, {}> & import("@prisma/client/runtime/library").DefaultArgs>;
//# sourceMappingURL=extensions.d.ts.map
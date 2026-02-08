// ═══════════════════════════════════════════════════════════════════════════
// Context Interface - Multi-Tenant Context Management
// ═══════════════════════════════════════════════════════════════════════════

export interface Context {
  readonly tenantId: string;
  readonly userId?: string;
  readonly roles: readonly string[];
  readonly isAuthenticated: boolean;
  readonly requestId?: string;
  readonly locale: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly timestamp: Date;
}

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  settings: Record<string, any>;
  createdAt: Date;
}

export interface UserContext {
  id: string;
  email: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLogin?: Date;
}

export const CONTEXT_KEY = 'REQUEST_CONTEXT';
export const TENANT_KEY = 'TENANT_CONTEXT';
export const USER_KEY = 'USER_CONTEXT';
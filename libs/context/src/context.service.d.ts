import type { Context, TenantContext, UserContext } from './context.interface';
export declare class ContextService {
  private readonly logger;
  private context;
  private tenantContext;
  private userContext;
  private initialized;
  setContext(context: Context): void;
  getContext(): Context;
  getCurrentTenantId(): string;
  getCurrentUserId(): string | undefined;
  isAuthenticated(): boolean;
  hasRole(role: string): boolean;
  hasAnyRole(roles: string[]): boolean;
  setTenantContext(tenant: TenantContext): void;
  getTenantContext(): TenantContext | null;
  setUserContext(user: UserContext): void;
  getUserContext(): UserContext | null;
  getRequestId(): string | undefined;
  createChildContext(overrides: Partial<Context>): Context;
  logContextInfo(): void;
}
//# sourceMappingURL=context.service.d.ts.map

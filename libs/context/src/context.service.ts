// ═══════════════════════════════════════════════════════════════════════════
// Context Service - Request Context Management
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Scope, Logger } from '@nestjs/common';
import { Context, TenantContext, UserContext } from './context.interface';

@Injectable({ scope: Scope.REQUEST })
export class ContextService {
  private readonly logger = new Logger(ContextService.name);
  private context: Readonly<Context> | null = null;
  private tenantContext: TenantContext | null = null;
  private userContext: UserContext | null = null;
  private initialized = false;

  setContext(context: Context): void {
    if (this.initialized) {
      throw new Error('Context already initialized - immutable after first set');
    }
    this.context = Object.freeze({
      ...context,
      roles: Object.freeze([...context.roles]),
      timestamp: new Date(),
    });
    this.initialized = true;
  }

  getContext(): Context {
    if (!this.context) {
      throw new Error('Context not initialized');
    }
    return this.context;
  }

  getCurrentTenantId(): string {
    const context = this.getContext();
    return context.tenantId;
  }

  getCurrentUserId(): string | undefined {
    const context = this.getContext();
    return context.userId;
  }

  isAuthenticated(): boolean {
    const context = this.getContext();
    return context.isAuthenticated;
  }

  hasRole(role: string): boolean {
    const context = this.getContext();
    return context.roles.includes(role);
  }

  hasAnyRole(roles: string[]): boolean {
    const context = this.getContext();
    return roles.some(role => context.roles.includes(role));
  }

  setTenantContext(tenant: TenantContext): void {
    this.tenantContext = tenant;
  }

  getTenantContext(): TenantContext | null {
    return this.tenantContext;
  }

  setUserContext(user: UserContext): void {
    this.userContext = user;
  }

  getUserContext(): UserContext | null {
    return this.userContext;
  }

  getRequestId(): string | undefined {
    return this.context?.requestId;
  }

  createChildContext(overrides: Partial<Context>): Context {
    const currentContext = this.getContext();
    return {
      ...currentContext,
      ...overrides,
      timestamp: new Date(),
    };
  }

  logContextInfo(): void {
    if (this.context) {
      this.logger.log('Context Info', {
        tenantId: this.context.tenantId,
        userId: this.context.userId,
        roles: this.context.roles,
        isAuthenticated: this.context.isAuthenticated,
        requestId: this.context.requestId,
      });
    }
  }
}
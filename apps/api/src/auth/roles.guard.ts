/**
 * Enhanced Role-based Authorization Guard
 *
 * Security Features:
 * - Role-based access control (RBAC)
 * - Audit logging for authorization failures
 * - Generic 403 response (doesn't reveal resource existence)
 * - Support for multiple role formats
 *
 * Requirements: 3.1, 3.3, 3.5
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator - specify required roles for an endpoint
 *
 * @example
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * async adminOnlyMethod() {}
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Role hierarchy for permission inheritance
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY: Record<string, string[]> = {
  SUPER_ADMIN: ['ADMIN', 'SUPPORT', 'USER'],
  ADMIN: ['SUPPORT', 'USER'],
  SUPPORT: ['USER'],
  SELLER: ['USER'],
  EXECUTOR: ['USER'],
  USER: [],
};

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required - allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User not authenticated
    if (!user) {
      this.logAuthorizationFailure(request, 'NO_USER', requiredRoles);
      // Generic message - don't reveal that authentication is the issue
      throw new ForbiddenException('������ �������');
    }

    const userRole: string = user.role?.toUpperCase() || '';

    // Check if user has required role (including hierarchy)
    const hasRole = this.checkRoleWithHierarchy(userRole, requiredRoles);

    if (!hasRole) {
      this.logAuthorizationFailure(request, userRole, requiredRoles, user.id);
      // Generic message - don't reveal what roles are required
      throw new ForbiddenException('������ �������');
    }

    return true;
  }

  /**
   * Check if user role matches required roles, considering hierarchy
   */
  private checkRoleWithHierarchy(userRole: string, requiredRoles: string[]): boolean {
    // Normalize roles to uppercase
    const normalizedRequired = requiredRoles.map((r) => r.toUpperCase());
    const normalizedUserRole = userRole.toUpperCase();

    // Direct match
    if (normalizedRequired.includes(normalizedUserRole)) {
      return true;
    }

    // Check hierarchy - does user's role inherit any required role?
    const inheritedRoles = ROLE_HIERARCHY[normalizedUserRole] || [];
    return normalizedRequired.some((required) => inheritedRoles.includes(required));
  }

  /**
   * Log authorization failures for security monitoring
   */
  private logAuthorizationFailure(
    request: any,
    userRole: string,
    requiredRoles: string[],
    userId?: string
  ): void {
    const logData = {
      event: 'AUTHORIZATION_FAILURE',
      userId: userId || 'anonymous',
      userRole,
      requiredRoles,
      path: request.path,
      method: request.method,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Authorization failed: ${JSON.stringify(logData)}`);
  }
}

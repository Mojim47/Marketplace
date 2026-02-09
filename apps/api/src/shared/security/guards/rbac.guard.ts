/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - RBAC Guard
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Role-Based Access Control guard that checks user permissions based on
 * their assigned roles. Supports role hierarchy and permission inheritance.
 *
 * Features:
 * - Role-based access control
 * - Role hierarchy with inheritance
 * - Permission-based access control
 * - Audit logging for authorization failures
 * - Generic error messages (security best practice)
 *
 * @module @nextgen/api/shared/security
 * Requirements: 1.2
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWTPayload } from '@nextgen/security';
import { Request } from 'express';

// Metadata keys
export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required roles for an endpoint
 *
 * @example
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * @Get('admin/users')
 * getUsers() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to specify required permissions for an endpoint
 *
 * @example
 * @Permissions('users:read', 'users:write')
 * @Get('users')
 * getUsers() { ... }
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Role hierarchy definition
 * Higher roles inherit permissions from lower roles
 */
export const ROLE_HIERARCHY: Record<string, string[]> = {
  SUPER_ADMIN: ['ADMIN', 'SUPPORT', 'SELLER', 'EXECUTOR', 'USER'],
  ADMIN: ['SUPPORT', 'SELLER', 'EXECUTOR', 'USER'],
  SUPPORT: ['USER'],
  SELLER: ['USER'],
  EXECUTOR: ['USER'],
  USER: [],
};

/**
 * Permission definitions by role
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'], // All permissions
  ADMIN: [
    'users:read',
    'users:write',
    'users:delete',
    'products:read',
    'products:write',
    'products:delete',
    'orders:read',
    'orders:write',
    'orders:delete',
    'vendors:read',
    'vendors:write',
    'vendors:approve',
    'reports:read',
    'settings:read',
    'settings:write',
  ],
  SUPPORT: [
    'users:read',
    'products:read',
    'orders:read',
    'orders:write',
    'vendors:read',
    'reports:read',
  ],
  SELLER: ['products:read', 'products:write', 'orders:read', 'reports:read'],
  EXECUTOR: ['projects:read', 'projects:write', 'bids:read', 'bids:write'],
  USER: ['profile:read', 'profile:write', 'orders:read', 'products:read'],
};

/**
 * Request interface with user payload
 */
interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * RBAC Guard
 *
 * Checks if the authenticated user has the required roles or permissions
 * to access the requested resource.
 *
 * @example
 * // Apply to specific controller
 * @UseGuards(JWTAuthGuard, RBACGuard)
 * @Roles('ADMIN')
 * @Controller('admin')
 * export class AdminController {}
 */
@Injectable()
export class RBACGuard implements CanActivate {
  private readonly logger = new Logger(RBACGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles and permissions from decorators
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles or permissions required - allow access
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // User not authenticated
    if (!user) {
      this.logAuthorizationFailure(request, 'NO_USER', requiredRoles, requiredPermissions);
      throw new ForbiddenException('������ �������');
    }

    const userRole = (user.role || '').toUpperCase();

    // Check role-based access
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = this.checkRoleWithHierarchy(userRole, requiredRoles);
      if (!hasRole) {
        this.logAuthorizationFailure(
          request,
          userRole,
          requiredRoles,
          requiredPermissions,
          user.sub
        );
        throw new ForbiddenException('������ �������');
      }
    }

    // Check permission-based access
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = this.checkPermissions(userRole, requiredPermissions);
      if (!hasPermission) {
        this.logAuthorizationFailure(
          request,
          userRole,
          requiredRoles,
          requiredPermissions,
          user.sub
        );
        throw new ForbiddenException('������ �������');
      }
    }

    return true;
  }

  /**
   * Check if user role matches required roles, considering hierarchy
   */
  private checkRoleWithHierarchy(userRole: string, requiredRoles: string[]): boolean {
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
   * Check if user has required permissions based on their role
   */
  private checkPermissions(userRole: string, requiredPermissions: string[]): boolean {
    const normalizedUserRole = userRole.toUpperCase();
    const rolePermissions = this.getEffectivePermissions(normalizedUserRole);

    // Check if user has wildcard permission
    if (rolePermissions.includes('*')) {
      return true;
    }

    // Check if user has all required permissions
    return requiredPermissions.every(
      (permission) =>
        rolePermissions.includes(permission) ||
        rolePermissions.some((p) => this.matchPermissionPattern(p, permission))
    );
  }

  /**
   * Get effective permissions for a role (including inherited)
   */
  private getEffectivePermissions(role: string): string[] {
    const permissions = new Set<string>();

    // Add direct role permissions
    const directPermissions = ROLE_PERMISSIONS[role] || [];
    directPermissions.forEach((p) => permissions.add(p));

    // Add inherited role permissions
    const inheritedRoles = ROLE_HIERARCHY[role] || [];
    for (const inheritedRole of inheritedRoles) {
      const inheritedPermissions = ROLE_PERMISSIONS[inheritedRole] || [];
      inheritedPermissions.forEach((p) => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Match permission pattern (supports wildcards)
   * e.g., 'users:*' matches 'users:read', 'users:write'
   */
  private matchPermissionPattern(pattern: string, permission: string): boolean {
    if (pattern === '*') return true;

    const patternParts = pattern.split(':');
    const permissionParts = permission.split(':');

    if (patternParts.length !== permissionParts.length) {
      return false;
    }

    return patternParts.every((part, index) => part === '*' || part === permissionParts[index]);
  }

  /**
   * Log authorization failures for security monitoring
   */
  private logAuthorizationFailure(
    request: AuthenticatedRequest,
    userRole: string,
    requiredRoles?: string[],
    requiredPermissions?: string[],
    userId?: string
  ): void {
    const logData = {
      event: 'AUTHORIZATION_FAILURE',
      userId: userId || 'anonymous',
      userRole,
      requiredRoles,
      requiredPermissions,
      path: request.path,
      method: request.method,
      ip: request.ip || request.socket?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Authorization failed: ${JSON.stringify(logData)}`);
  }
}

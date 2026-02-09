import type { AuthenticatedUser } from '../types/authenticated-user.type';
/**
 * Resource Ownership Guard
 *
 * Verifies that the authenticated user owns the resource they're trying to access.
 *
 * Security Features:
 * - Generic ownership verification
 * - Configurable resource type and ID parameter
 * - Audit logging for unauthorized access attempts
 * - Generic 403 response (doesn't reveal resource existence)
 *
 * Requirements: 3.2, 3.4
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
import type { PrismaService } from '../../database/prisma.service';

/**
 * Metadata key for resource owner configuration
 */
export const RESOURCE_OWNER_KEY = 'resourceOwner';

/**
 * Configuration for resource ownership check
 */
export interface ResourceOwnerConfig {
  /** The Prisma model name (e.g., 'order', 'product') */
  resourceType: string;
  /** The request parameter containing the resource ID (default: 'id') */
  idParam?: string;
  /** The field in the resource that contains the owner ID (default: 'userId') */
  ownerField?: string;
  /** Allow admins to bypass ownership check */
  allowAdmin?: boolean;
  /** Custom ownership check function name */
  customCheck?: string;
}

/**
 * Decorator to specify resource ownership requirements
 *
 * @example
 * @ResourceOwner({ resourceType: 'order', idParam: 'orderId' })
 * async getOrder(@Param('orderId') orderId: string) {}
 */
export const ResourceOwner = (config: ResourceOwnerConfig) =>
  SetMetadata(RESOURCE_OWNER_KEY, config);

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  private readonly logger = new Logger(ResourceOwnerGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<ResourceOwnerConfig>(RESOURCE_OWNER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No ownership check configured
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User not authenticated
    if (!user) {
      this.logUnauthorizedAccess(request, config, 'NO_USER');
      throw new ForbiddenException('دسترسي غيرمجاز');
    }

    // Admin bypass (if configured)
    if (config.allowAdmin && this.isAdmin(user)) {
      return true;
    }

    // Get resource ID from request
    const idParam = config.idParam || 'id';
    const resourceId = request.params[idParam];

    if (!resourceId) {
      this.logUnauthorizedAccess(request, config, 'NO_RESOURCE_ID', user.id);
      throw new ForbiddenException('دسترسي غيرمجاز');
    }

    // Check ownership
    const isOwner = await this.checkOwnership(
      config.resourceType,
      resourceId,
      user.id,
      config.ownerField || 'userId'
    );

    if (!isOwner) {
      this.logUnauthorizedAccess(request, config, 'NOT_OWNER', user.id, resourceId);
      // Generic message - don't reveal if resource exists
      throw new ForbiddenException('دسترسي غيرمجاز');
    }

    return true;
  }

  /**
   * Check if user owns the resource
   */
  private async checkOwnership(
    resourceType: string,
    resourceId: string,
    userId: string,
    ownerField: string
  ): Promise<boolean> {
    try {
      // Dynamic Prisma model access
      const model = (this.prisma as any)[resourceType];

      if (!model) {
        this.logger.error(`Unknown resource type: ${resourceType}`);
        return false;
      }

      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { [ownerField]: true },
      });

      // Resource not found - return false (don't reveal existence)
      if (!resource) {
        return false;
      }

      // Check ownership
      return resource[ownerField] === userId;
    } catch (error) {
      this.logger.error(`Ownership check failed: ${error}`);
      return false;
    }
  }

  /**
   * Check if user has admin role
   */
  private isAdmin(user: AuthenticatedUser): boolean {
    const adminRoles = ['ADMIN', 'SUPER_ADMIN'];
    return adminRoles.includes(user.role?.toUpperCase());
  }

  /**
   * Log unauthorized access attempts
   */
  private logUnauthorizedAccess(
    request: any,
    config: ResourceOwnerConfig,
    reason: string,
    userId?: string,
    resourceId?: string
  ): void {
    const logData = {
      event: 'UNAUTHORIZED_RESOURCE_ACCESS',
      reason,
      userId: userId || 'anonymous',
      resourceType: config.resourceType,
      resourceId: resourceId || 'unknown',
      path: request.path,
      method: request.method,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Unauthorized access attempt: ${JSON.stringify(logData)}`);
  }
}

/**
 * Combined guard for role + ownership checks
 * Use when you need both role-based and ownership-based authorization
 */
@Injectable()
export class RoleOrOwnerGuard implements CanActivate {
  private readonly logger = new Logger(RoleOrOwnerGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('دسترسي غيرمجاز');
    }

    // Check if user has admin role
    const adminRoles = ['ADMIN', 'SUPER_ADMIN'];
    if (adminRoles.includes(user.role?.toUpperCase())) {
      return true;
    }

    // Check ownership
    const config = this.reflector.getAllAndOverride<ResourceOwnerConfig>(RESOURCE_OWNER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!config) {
      return true;
    }

    const idParam = config.idParam || 'id';
    const resourceId = request.params[idParam];

    if (!resourceId) {
      throw new ForbiddenException('دسترسي غيرمجاز');
    }

    try {
      const model = (this.prisma as any)[config.resourceType];
      const ownerField = config.ownerField || 'userId';

      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { [ownerField]: true },
      });

      if (!resource || resource[ownerField] !== user.id) {
        throw new ForbiddenException('دسترسي غيرمجاز');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Authorization check failed: ${error}`);
      throw new ForbiddenException('دسترسي غيرمجاز');
    }
  }
}

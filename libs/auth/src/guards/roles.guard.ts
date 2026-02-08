// ═══════════════════════════════════════════════════════════════════════════
// Roles Guard - Check User Roles
// ═══════════════════════════════════════════════════════════════════════════

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { REQUIRED_ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../types';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.some(role => user.roles.includes(role));

    if (!hasRole) {
      this.logger.warn('Access denied - insufficient roles', {
        user_id: user.id,
        required: requiredRoles,
        has: user.roles,
        path: request.url,
      });
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

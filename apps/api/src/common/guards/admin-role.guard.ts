/**
 * Admin Role Guard
 *
 * Verifies that the authenticated user has admin role before allowing access.
 *
 * Security Features:
 * - Admin role verification
 * - Audit logging for unauthorized access attempts
 * - Generic 403 response
 *
 * Requirements: 6.4, 6.5
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminRoleGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User not authenticated
    if (!user) {
      this.logUnauthorizedAccess(request, 'NO_USER');
      throw new ForbiddenException('������ �������');
    }

    // Check if user has admin role
    const userRoles = user.roles || [];
    const userRole = user.role;

    // Support both roles array and single role field
    const hasAdminRole =
      userRoles.includes('ADMIN') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN';

    if (!hasAdminRole) {
      this.logUnauthorizedAccess(request, 'NOT_ADMIN', user.id);
      throw new ForbiddenException('������ ����� ������ ���');
    }

    return true;
  }

  /**
   * Log unauthorized access attempts for security auditing
   */
  private logUnauthorizedAccess(request: any, reason: string, userId?: string): void {
    const logData = {
      event: 'UNAUTHORIZED_ADMIN_ACCESS',
      reason,
      userId: userId || 'anonymous',
      path: request.path,
      method: request.method,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Unauthorized admin access attempt: ${JSON.stringify(logData)}`);
  }
}

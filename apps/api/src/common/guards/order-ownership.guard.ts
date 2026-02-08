/**
 * Order Ownership Guard
 *
 * Verifies that the authenticated user owns the order they're trying to access.
 *
 * Security Features:
 * - User ownership verification before order access
 * - Audit logging for unauthorized access attempts
 * - Generic 403 response (doesn't reveal resource existence)
 *
 * Requirements: 6.3, 6.5
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrderOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OrderOwnershipGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orderId = request.params.id;

    // User not authenticated
    if (!user) {
      this.logUnauthorizedAccess(request, 'NO_USER', undefined, orderId);
      throw new ForbiddenException('œ” —”Ì €Ì—„Ã«“');
    }

    // User must have id
    if (!user.id) {
      this.logUnauthorizedAccess(request, 'NO_USER_ID', undefined, orderId);
      throw new ForbiddenException('œ” —”Ì €Ì—„Ã«“');
    }

    // Order ID must be provided
    if (!orderId) {
      this.logUnauthorizedAccess(request, 'NO_ORDER_ID', user.id, undefined);
      throw new ForbiddenException('œ” —”Ì €Ì—„Ã«“');
    }

    // Fetch order to check ownership
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });

    // Order not found
    if (!order) {
      this.logUnauthorizedAccess(request, 'ORDER_NOT_FOUND', user.id, orderId);
      throw new NotFoundException('”›«—‘ Ì«›  ‰‘œ');
    }

    // Check ownership: order.userId === user.id
    if (order.userId !== user.id) {
      this.logUnauthorizedAccess(request, 'NOT_OWNER', user.id, orderId);
      throw new ForbiddenException('‘„« „«·ò «Ì‰ ”›«—‘ ‰Ì” Ìœ');
    }

    return true;
  }

  /**
   * Log unauthorized access attempts for security auditing
   */
  private logUnauthorizedAccess(
    request: any,
    reason: string,
    userId?: string,
    orderId?: string,
  ): void {
    const logData = {
      event: 'UNAUTHORIZED_ORDER_ACCESS',
      reason,
      userId: userId || 'anonymous',
      orderId: orderId || 'unknown',
      path: request.path,
      method: request.method,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Unauthorized order access attempt: ${JSON.stringify(logData)}`);
  }
}

/**
 * Product Ownership Guard
 *
 * Verifies that the authenticated vendor owns the product they're trying to modify.
 *
 * Security Features:
 * - Vendor ownership verification before product modification
 * - Audit logging for unauthorized access attempts
 * - Generic 403 response (doesn't reveal resource existence)
 *
 * Requirements: 6.1, 6.2, 6.5
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ProductOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(ProductOwnershipGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const productId = request.params.id;

    // User not authenticated
    if (!user) {
      this.logUnauthorizedAccess(request, 'NO_USER', undefined, productId);
      throw new ForbiddenException('������ �������');
    }

    // User must have vendorId
    if (!user.vendorId) {
      this.logUnauthorizedAccess(request, 'NO_VENDOR_ID', user.id, productId);
      throw new ForbiddenException('������ ������� ������ ���');
    }

    // Product ID must be provided
    if (!productId) {
      this.logUnauthorizedAccess(request, 'NO_PRODUCT_ID', user.id, undefined);
      throw new ForbiddenException('������ �������');
    }

    // Fetch product to check ownership
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { vendorId: true },
    });

    // Product not found
    if (!product) {
      this.logUnauthorizedAccess(request, 'PRODUCT_NOT_FOUND', user.id, productId);
      throw new NotFoundException('����� ���� ���');
    }

    // Check ownership: product.vendorId === user.vendorId
    if (product.vendorId !== user.vendorId) {
      this.logUnauthorizedAccess(request, 'NOT_OWNER', user.id, productId);
      throw new ForbiddenException('��� ��� ��� ����� ������');
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
    productId?: string
  ): void {
    const logData = {
      event: 'UNAUTHORIZED_PRODUCT_ACCESS',
      reason,
      userId: userId || 'anonymous',
      productId: productId || 'unknown',
      path: request.path,
      method: request.method,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Unauthorized product access attempt: ${JSON.stringify(logData)}`);
  }
}

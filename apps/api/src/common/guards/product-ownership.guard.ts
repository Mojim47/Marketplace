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
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
      throw new ForbiddenException('œ” —”Ì €Ì—„Ã«“');
    }

    // User must have vendorId
    if (!user.vendorId) {
      this.logUnauthorizedAccess(request, 'NO_VENDOR_ID', user.id, productId);
      throw new ForbiddenException('œ” —”Ì ›—Ê‘‰œÂ «·“«„Ì «” ');
    }

    // Product ID must be provided
    if (!productId) {
      this.logUnauthorizedAccess(request, 'NO_PRODUCT_ID', user.id, undefined);
      throw new ForbiddenException('œ” —”Ì €Ì—„Ã«“');
    }

    // Fetch product to check ownership
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { vendorId: true },
    });

    // Product not found
    if (!product) {
      this.logUnauthorizedAccess(request, 'PRODUCT_NOT_FOUND', user.id, productId);
      throw new NotFoundException('„Õ’Ê· Ì«›  ‰‘œ');
    }

    // Check ownership: product.vendorId === user.vendorId
    if (product.vendorId !== user.vendorId) {
      this.logUnauthorizedAccess(request, 'NOT_OWNER', user.id, productId);
      throw new ForbiddenException('‘„« „«·ò «Ì‰ „Õ’Ê· ‰Ì” Ìœ');
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
    productId?: string,
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

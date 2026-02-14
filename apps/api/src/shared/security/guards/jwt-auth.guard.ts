/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - JWT Authentication Guard
 * ???????????????????????????????????????????????????????????????????????????
 *
 * JWT authentication guard using RS256 algorithm with key rotation support.
 * Validates access tokens and extracts user payload for request context.
 *
 * Features:
 * - RS256 token verification
 * - Automatic key rotation support
 * - Token expiration validation
 * - Issuer and audience validation
 * - Persian error messages
 *
 * @module @nextgen/api/shared/security
 * Requirements: 1.1
 */

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWTManager, JWTPayload } from '@nextgen/security';
import { Request } from 'express';
import { SECURITY_TOKENS } from '../tokens';

// Metadata key for public routes
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark routes as public (no authentication required)
 *
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() { return { status: 'ok' }; }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Extended request interface with user payload
 */
export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

/**
 * JWT Authentication Guard
 *
 * Validates JWT tokens using the JWTManager from libs/security.
 * Supports RS256 algorithm with automatic key rotation.
 *
 * @example
 * // Apply globally in AppModule
 * providers: [
 *   { provide: APP_GUARD, useClass: JWTAuthGuard }
 * ]
 *
 * @example
 * // Apply to specific controller
 * @UseGuards(JWTAuthGuard)
 * @Controller('api')
 * export class ApiController {}
 */
@Injectable()
export class JWTAuthGuard implements CanActivate {
  private readonly logger = new Logger(JWTAuthGuard.name);

  constructor(
    @Inject(SECURITY_TOKENS.JWT_MANAGER)
    private readonly jwtManager: JWTManager,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      this.logAuthFailure(request, 'NO_TOKEN');
      throw new UnauthorizedException('��� ����� ���� ���� ���');
    }

    // Verify the token
    const result = await this.jwtManager.verifyToken(token);

    if (!result.valid || !result.payload) {
      this.logAuthFailure(request, result.error || 'INVALID_TOKEN');
      throw new UnauthorizedException(this.getErrorMessage(result.error));
    }

    // Check if this is a refresh token being used as access token
    if (result.payload.scope === 'refresh') {
      this.logAuthFailure(request, 'REFRESH_TOKEN_AS_ACCESS');
      throw new UnauthorizedException('��� ������� ���');
    }

    // Attach user payload to request
    (request as AuthenticatedRequest).user = result.payload;

    return true;
  }

  /**
   * Extract JWT token from request
   * Supports Authorization header (Bearer token) and cookie
   */
  private extractToken(request: Request): string | null {
    // Try Authorization header first
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type?.toLowerCase() === 'bearer' && token) {
        return token;
      }
    }

    // Try cookie as fallback
    const cookieToken = request.cookies?.['access_token'];
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Log authentication failure for security monitoring
   */
  private logAuthFailure(request: Request, reason: string): void {
    const logData = {
      event: 'AUTH_FAILURE',
      reason,
      ip: request.ip || request.socket?.remoteAddress,
      method: request.method,
      path: request.path,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Authentication failed: ${JSON.stringify(logData)}`);
  }

  /**
   * Get user-friendly error message based on verification error
   */
  private getErrorMessage(error?: string): string {
    const messages: Record<string, string> = {
      'Invalid token format': '���� ��� ������� ���',
      'Invalid header encoding': '��� ������� ���',
      'Invalid algorithm': '��� ������� ���',
      'Unknown key ID': '��� ����� ��� ���. ����� ������ ���� ����',
      'Invalid signature': '��� ������� ���',
      'Invalid payload encoding': '��� ������� ���',
      'Token expired': '��� ����� ��� ���. ����� ������ ���� ����',
      'Invalid issuer': '��� ������� ���',
    };

    return messages[error || ''] || '��� ������� ���';
  }
}

/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - CSRF Guard
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Cross-Site Request Forgery protection guard using double-submit cookie pattern.
 * Validates CSRF tokens for state-changing requests (POST, PUT, DELETE, PATCH).
 *
 * Features:
 * - Double-submit cookie pattern
 * - Automatic token generation
 * - Token rotation support
 * - Safe method bypass (GET, HEAD, OPTIONS)
 * - Path-based exclusions
 * - Persian error messages
 *
 * @module @nextgen/api/shared/security
 * Requirements: 1.4
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CSRFManager } from '@nextgen/security';
import { Request, Response } from 'express';
import { SECURITY_TOKENS } from '../tokens';

// Metadata key for skipping CSRF validation
export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Decorator to skip CSRF validation for an endpoint
 * Use with caution - only for endpoints that don't modify state
 *
 * @example
 * @SkipCSRF()
 * @Post('webhook')
 * handleWebhook() { ... }
 */
export const SkipCSRF = () => SetMetadata(SKIP_CSRF_KEY, true);

/**
 * CSRF Guard
 *
 * Validates CSRF tokens for state-changing HTTP methods.
 * Uses double-submit cookie pattern for protection.
 *
 * @example
 * // Apply globally in AppModule
 * providers: [
 *   { provide: APP_GUARD, useClass: CSRFGuard }
 * ]
 *
 * @example
 * // Skip for specific endpoint
 * @SkipCSRF()
 * @Post('api/webhook')
 * handleWebhook() { ... }
 */
@Injectable()
export class CSRFGuard implements CanActivate {
  private readonly logger = new Logger(CSRFGuard.name);

  constructor(
    @Inject(SECURITY_TOKENS.CSRF_MANAGER)
    private readonly csrfManager: CSRFManager,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const config = this.csrfManager.getConfig();

    // Check if CSRF should be skipped for this endpoint
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCsrf) {
      return true;
    }

    // Generate token for all requests (for client to use)
    this.ensureCSRFToken(request, response);

    // Skip validation for safe methods
    if (!this.csrfManager.shouldValidate(request.method, request.path)) {
      return true;
    }

    // Get tokens from cookie and header
    const cookieToken = request.cookies?.[config.cookieName];
    const headerToken = request.headers[config.headerName.toLowerCase()] as string | undefined;

    // Validate tokens
    const result = this.csrfManager.validateToken(cookieToken, headerToken);

    if (!result.valid) {
      this.logCSRFFailure(request, result.error);
      throw new ForbiddenException(result.errorFa || '��� CSRF ������� ���');
    }

    // Rotate token if configured
    if (config.rotateToken) {
      this.rotateCSRFToken(response);
    }

    return true;
  }

  /**
   * Ensure CSRF token exists in cookie
   */
  private ensureCSRFToken(request: Request, response: Response): void {
    const config = this.csrfManager.getConfig();

    // Check if token already exists
    if (request.cookies?.[config.cookieName]) {
      return;
    }

    // Generate new token
    const csrfToken = this.csrfManager.generateToken();
    const cookieValue = this.csrfManager.createCookieValue(csrfToken);
    const cookieOptions = this.csrfManager.getCookieOptions();

    // Set cookie
    response.cookie(config.cookieName, cookieValue, cookieOptions as any);
  }

  /**
   * Rotate CSRF token
   */
  private rotateCSRFToken(response: Response): void {
    const config = this.csrfManager.getConfig();
    const newToken = this.csrfManager.generateToken();
    const cookieValue = this.csrfManager.createCookieValue(newToken);
    const cookieOptions = this.csrfManager.getCookieOptions();

    response.cookie(config.cookieName, cookieValue, cookieOptions as any);
  }

  /**
   * Log CSRF validation failure for security monitoring
   */
  private logCSRFFailure(request: Request, error?: string): void {
    const logData = {
      event: 'CSRF_VALIDATION_FAILURE',
      error,
      path: request.path,
      method: request.method,
      ip: request.ip || request.socket?.remoteAddress,
      userAgent: request.headers['user-agent'],
      origin: request.headers['origin'],
      referer: request.headers['referer'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`CSRF validation failed: ${JSON.stringify(logData)}`);
  }
}

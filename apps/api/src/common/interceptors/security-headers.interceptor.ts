/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Security Headers Interceptor
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Adds comprehensive security headers to all API responses using
 * SecurityHeadersManager from libs/security.
 *
 * Features:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * - Cross-Origin headers
 *
 * @module @nextgen/api/interceptors
 * Requirements: 1.5
 */

import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
} from '@nestjs/common';
import {
  type SecurityHeadersManager,
  createDevelopmentSecurityHeaders,
  createProductionSecurityHeaders,
} from '@nextgen/security';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { SECURITY_TOKENS } from '../../shared/security/tokens';

/**
 * Security Headers Interceptor
 *
 * Applies comprehensive security headers to all HTTP responses.
 * Uses SecurityHeadersManager from libs/security for consistent
 * header configuration across the application.
 *
 * @example
 * // Global registration in AppModule
 * providers: [
 *   {
 *     provide: APP_INTERCEPTOR,
 *     useClass: SecurityHeadersInterceptor,
 *   },
 * ]
 *
 * @example
 * // Controller-level registration
 * @UseInterceptors(SecurityHeadersInterceptor)
 * @Controller('api')
 * export class ApiController {}
 */
@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  private readonly headersManager: SecurityHeadersManager;

  constructor(
    @Optional()
    @Inject(SECURITY_TOKENS.SECURITY_HEADERS)
    injectedManager?: SecurityHeadersManager
  ) {
    // Use injected manager if available, otherwise create default
    if (injectedManager) {
      this.headersManager = injectedManager;
    } else {
      // Fallback: create manager based on environment
      const isProduction = process.env.NODE_ENV === 'production';
      this.headersManager = isProduction
        ? createProductionSecurityHeaders()
        : createDevelopmentSecurityHeaders();
    }
  }

  /**
   * Intercept HTTP requests and add security headers to responses
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    // Apply security headers before response is sent
    this.applySecurityHeaders(response);

    return next.handle();
  }

  /**
   * Apply all security headers to the response
   */
  private applySecurityHeaders(response: Response): void {
    // Remove X-Powered-By header (information disclosure prevention)
    response.removeHeader('X-Powered-By');

    // Get all headers from the manager
    const headers = this.headersManager.getHeaders();

    // Apply each header to the response
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
  }

  /**
   * Get the current security headers configuration
   * Useful for debugging and testing
   */
  getHeaders(): Record<string, string> {
    return this.headersManager.getHeaders();
  }

  /**
   * Get the number of security headers being applied
   */
  getHeaderCount(): number {
    return this.headersManager.getHeaderCount();
  }
}

/**
 * Factory function to create SecurityHeadersInterceptor with custom config
 */
export function createSecurityHeadersInterceptor(
  manager?: SecurityHeadersManager
): SecurityHeadersInterceptor {
  const interceptor = new SecurityHeadersInterceptor(manager);
  return interceptor;
}

export default SecurityHeadersInterceptor;

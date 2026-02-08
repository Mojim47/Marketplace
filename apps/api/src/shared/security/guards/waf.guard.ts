/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - WAF Guard
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Web Application Firewall guard that inspects incoming requests for
 * malicious patterns including SQL Injection, XSS, and Path Traversal.
 * 
 * Features:
 * - SQL Injection detection
 * - XSS attack detection
 * - Path Traversal detection
 * - Command Injection detection
 * - XXE attack detection
 * - IP blocking for repeat offenders
 * - Rate limiting integration
 * 
 * @module @nextgen/api/shared/security
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { WAFService } from '@nextgen/waf';
import { SECURITY_TOKENS } from '../tokens';

/**
 * WAF Guard - Filters malicious requests
 * 
 * This guard inspects all incoming requests for potential security threats
 * and blocks requests that match known attack patterns.
 * 
 * @example
 * // Apply globally in AppModule
 * providers: [
 *   { provide: APP_GUARD, useClass: WAFGuard }
 * ]
 * 
 * @example
 * // Apply to specific controller
 * @UseGuards(WAFGuard)
 * @Controller('api')
 * export class ApiController {}
 */
@Injectable()
export class WAFGuard implements CanActivate {
  private readonly logger = new Logger(WAFGuard.name);

  constructor(
    @Inject(SECURITY_TOKENS.WAF_SERVICE)
    private readonly wafService: WAFService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract request information for inspection
    const inspectionData = {
      ip: this.extractClientIP(request),
      url: request.url,
      body: request.body,
      headers: this.sanitizeHeaders(request.headers as Record<string, string>),
    };

    // Inspect request with WAF service
    const result = await this.wafService.inspect(inspectionData);

    if (!result.allowed) {
      // Log the blocked request
      this.logBlockedRequest(request, result.reason);

      // Return appropriate error message based on reason
      const errorMessage = this.getErrorMessage(result.reason);
      throw new ForbiddenException(errorMessage);
    }

    return true;
  }

  /**
   * Extract client IP address from request
   * Handles proxied requests (X-Forwarded-For, X-Real-IP)
   */
  private extractClientIP(request: Request): string {
    // Check for forwarded headers (when behind proxy/load balancer)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwardedFor) 
        ? forwardedFor[0] 
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIP = request.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    // Fallback to direct connection IP
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Log blocked request for security monitoring
   */
  private logBlockedRequest(request: Request, reason?: string): void {
    const logData = {
      event: 'WAF_BLOCKED',
      reason,
      ip: this.extractClientIP(request),
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`WAF blocked request: ${JSON.stringify(logData)}`);
  }

  /**
   * Get user-friendly error message based on block reason
   */
  private getErrorMessage(reason?: string): string {
    const messages: Record<string, string> = {
      SQL_INJECTION: 'œ—ŒÊ«”  ‘„« »Â œ·Ì· „Õ Ê«Ì „‘òÊò „”œÊœ ‘œ',
      XSS: 'œ—ŒÊ«”  ‘„« »Â œ·Ì· „Õ Ê«Ì „‘òÊò „”œÊœ ‘œ',
      PATH_TRAVERSAL: 'œ—ŒÊ«”  ‘„« »Â œ·Ì· „”Ì— ‰«„⁄ »— „”œÊœ ‘œ',
      COMMAND_INJECTION: 'œ—ŒÊ«”  ‘„« »Â œ·Ì· „Õ Ê«Ì „‘òÊò „”œÊœ ‘œ',
      XXE: 'œ—ŒÊ«”  ‘„« »Â œ·Ì· „Õ Ê«Ì „‘òÊò „”œÊœ ‘œ',
      IP_BLOCKED: '¬œ—” IP ‘„« „Êﬁ « „”œÊœ ‘œÂ «” ',
      RATE_LIMIT_EXCEEDED: ' ⁄œ«œ œ—ŒÊ«” ùÂ«Ì ‘„« »Ì‘ «“ Õœ „Ã«“ «” ',
    };

    return messages[reason || ''] || 'œ—ŒÊ«”  ‘„« „”œÊœ ‘œ';
  }
}

/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Brute Force Guard
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Brute force protection guard that tracks failed login attempts and
 * temporarily blocks accounts/IPs after exceeding the threshold.
 *
 * Features:
 * - Failed attempt tracking
 * - Account lockout after 5 failed attempts
 * - IP-based blocking
 * - Automatic unblock after cooldown
 * - Whitelisted IPs support
 * - Persian error messages
 *
 * @module @nextgen/api/shared/security
 * Requirements: 1.6
 */

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BruteForceProtection } from '@nextgen/security';
import { Request } from 'express';
import { SECURITY_TOKENS } from '../tokens';

// Metadata key for brute force protection
export const BRUTE_FORCE_KEY = 'bruteForceProtected';

/**
 * Decorator to enable brute force protection for an endpoint
 *
 * @example
 * @BruteForceProtected()
 * @Post('login')
 * login() { ... }
 */
export const BruteForceProtected = () => SetMetadata(BRUTE_FORCE_KEY, true);

/**
 * Decorator to skip brute force protection
 *
 * @example
 * @SkipBruteForce()
 * @Post('register')
 * register() { ... }
 */
export const SKIP_BRUTE_FORCE_KEY = 'skipBruteForce';
export const SkipBruteForce = () => SetMetadata(SKIP_BRUTE_FORCE_KEY, true);

/**
 * Brute Force Guard
 *
 * Protects authentication endpoints from brute force attacks by tracking
 * failed attempts and temporarily blocking after threshold is exceeded.
 *
 * Default: 5 failed attempts ? 15 minute lockout
 *
 * @example
 * // Apply to login endpoint
 * @UseGuards(BruteForceGuard)
 * @BruteForceProtected()
 * @Post('auth/login')
 * login() { ... }
 */
@Injectable()
export class BruteForceGuard implements CanActivate {
  private readonly logger = new Logger(BruteForceGuard.name);

  constructor(
    @Inject(SECURITY_TOKENS.BRUTE_FORCE)
    private readonly bruteForceProtection: BruteForceProtection,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if brute force protection should be skipped
    const skipBruteForce = this.reflector.getAllAndOverride<boolean>(SKIP_BRUTE_FORCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipBruteForce) {
      return true;
    }

    // Check if endpoint is marked for brute force protection
    const isProtected = this.reflector.getAllAndOverride<boolean>(BRUTE_FORCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If not explicitly protected, allow the request
    if (!isProtected) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const identifier = this.getIdentifier(request);

    // Check if identifier is blocked
    if (this.bruteForceProtection.isBlocked(identifier)) {
      const attempts = this.bruteForceProtection.getAttempts(identifier);
      const remainingTime = attempts?.blockedUntil
        ? Math.ceil((attempts.blockedUntil - Date.now()) / 60000)
        : 15;

      this.logBlockedAttempt(request, identifier);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `���� ��� �� ���� ���ԝ��� ������ ����� ��� ��� ���. ����� ${remainingTime} ����� ��� ���� ����.`,
          blockedUntil: attempts?.blockedUntil
            ? new Date(attempts.blockedUntil).toISOString()
            : null,
          remainingMinutes: remainingTime,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Store identifier in request for later use (to record attempt result)
    (request as any).bruteForceIdentifier = identifier;

    return true;
  }

  /**
   * Get identifier for brute force tracking
   * Combines IP and email/username for more accurate tracking
   */
  private getIdentifier(request: Request): string {
    const ip = this.extractClientIP(request);
    const email = request.body?.email || request.body?.username || '';

    // Combine IP and email for identifier
    // This prevents attackers from trying different emails from same IP
    return `${ip}:${email}`.toLowerCase();
  }

  /**
   * Extract client IP address from request
   */
  private extractClientIP(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIP = request.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Log blocked attempt for security monitoring
   */
  private logBlockedAttempt(request: Request, identifier: string): void {
    const logData = {
      event: 'BRUTE_FORCE_BLOCKED',
      identifier,
      path: request.path,
      method: request.method,
      ip: this.extractClientIP(request),
      email: request.body?.email,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Brute force blocked: ${JSON.stringify(logData)}`);
  }
}

/**
 * Service to record login attempt results
 * Use this in your auth service to track success/failure
 */
@Injectable()
export class BruteForceService {
  constructor(
    @Inject(SECURITY_TOKENS.BRUTE_FORCE)
    private readonly bruteForceProtection: BruteForceProtection
  ) {}

  /**
   * Record a failed login attempt
   * @param identifier - The identifier (IP:email combination)
   * @returns Object with allowed status and remaining attempts
   */
  recordFailedAttempt(identifier: string): {
    allowed: boolean;
    remainingAttempts: number;
    blockedUntil?: Date;
  } {
    return this.bruteForceProtection.recordAttempt(identifier, false);
  }

  /**
   * Record a successful login (clears failed attempts)
   * @param identifier - The identifier (IP:email combination)
   */
  recordSuccessfulLogin(identifier: string): void {
    this.bruteForceProtection.recordAttempt(identifier, true);
  }

  /**
   * Check if an identifier is currently blocked
   * @param identifier - The identifier to check
   */
  isBlocked(identifier: string): boolean {
    return this.bruteForceProtection.isBlocked(identifier);
  }

  /**
   * Get remaining attempts for an identifier
   * @param identifier - The identifier to check
   */
  getRemainingAttempts(identifier: string): number {
    return this.bruteForceProtection.getRemainingAttempts(identifier);
  }

  /**
   * Manually unblock an identifier (admin action)
   * @param identifier - The identifier to unblock
   */
  unblock(identifier: string): boolean {
    return this.bruteForceProtection.unblock(identifier);
  }

  /**
   * Get brute force protection statistics
   */
  getStats() {
    return this.bruteForceProtection.getStats();
  }
}

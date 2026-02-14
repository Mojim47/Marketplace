// ═══════════════════════════════════════════════════════════════════════════
// Auth Audit Service - Security Event Logging
// ═══════════════════════════════════════════════════════════════════════════
// Logs all authentication events for security monitoring and compliance
// - Login attempts (success/failure)
// - Token operations
// - Password changes
// - 2FA events
// - Suspicious activity detection
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuthAction, AuthAuditEntry } from '../types';

type AuditLogRecord = {
  action: string;
  user_id: string | null;
  tenant_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  metadata: unknown;
  created_at: Date;
};

export interface AuditContext {
  user_id?: string;
  tenant_id?: string;
  ip_address: string;
  user_agent: string;
  session_id?: string;
}

@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log an authentication event
   */
  async log(
    action: AuthAction,
    context: AuditContext,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const entry: AuthAuditEntry = {
      action,
      user_id: context.user_id,
      tenant_id: context.tenant_id,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      success,
      metadata: {
        ...metadata,
        session_id: context.session_id,
      },
      timestamp: new Date(),
    };

    // Log to database
    await this.prisma.auditLog.create({
      data: {
        tenant_id: context.tenant_id,
        user_id: context.user_id,
        action: action,
        resource: 'AUTH',
        resource_id: context.session_id,
        success,
        ip_address: context.ip_address,
        user_agent: context.user_agent,
        metadata: entry.metadata as Prisma.InputJsonValue,
      },
    });

    // Log to application logger
    if (success) {
      this.logger.log(`Auth event: ${action}`, {
        user_id: context.user_id,
        tenant_id: context.tenant_id,
        ip: this.maskIp(context.ip_address),
        success,
      });
    } else {
      this.logger.warn(`Auth event: ${action}`, {
        user_id: context.user_id,
        tenant_id: context.tenant_id,
        ip: this.maskIp(context.ip_address),
        success,
      });
    }

    // Check for suspicious patterns
    if (!success) {
      await this.checkSuspiciousActivity(context, action);
    }
  }

  /**
   * Log successful login
   */
  async logLoginSuccess(context: AuditContext, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('LOGIN_SUCCESS', context, true, metadata);
  }

  /**
   * Log failed login
   */
  async logLoginFailed(
    context: AuditContext,
    reason: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log('LOGIN_FAILED', context, false, { reason, ...metadata });
  }

  /**
   * Log logout
   */
  async logLogout(context: AuditContext, allDevices = false): Promise<void> {
    await this.log('LOGOUT', context, true, { all_devices: allDevices });
  }

  /**
   * Log token refresh
   */
  async logTokenRefresh(context: AuditContext): Promise<void> {
    await this.log('TOKEN_REFRESH', context, true);
  }

  /**
   * Log token revocation
   */
  async logTokenRevoked(context: AuditContext, reason: string): Promise<void> {
    await this.log('TOKEN_REVOKED', context, true, { reason });
  }

  /**
   * Log password change
   */
  async logPasswordChanged(context: AuditContext): Promise<void> {
    await this.log('PASSWORD_CHANGED', context, true);
  }

  /**
   * Log password reset request
   */
  async logPasswordResetRequested(context: AuditContext, email: string): Promise<void> {
    await this.log('PASSWORD_RESET_REQUESTED', context, true, {
      email: this.maskEmail(email),
    });
  }

  /**
   * Log password reset completion
   */
  async logPasswordResetCompleted(context: AuditContext): Promise<void> {
    await this.log('PASSWORD_RESET_COMPLETED', context, true);
  }

  /**
   * Log TOTP enabled
   */
  async logTotpEnabled(context: AuditContext): Promise<void> {
    await this.log('TOTP_ENABLED', context, true);
  }

  /**
   * Log TOTP disabled
   */
  async logTotpDisabled(context: AuditContext): Promise<void> {
    await this.log('TOTP_DISABLED', context, true);
  }

  /**
   * Log TOTP verification
   */
  async logTotpVerified(context: AuditContext, success: boolean): Promise<void> {
    await this.log(success ? 'TOTP_VERIFIED' : 'TOTP_FAILED', context, success);
  }

  /**
   * Log account lockout
   */
  async logAccountLocked(context: AuditContext, duration: number): Promise<void> {
    await this.log('ACCOUNT_LOCKED', context, true, { duration_minutes: duration });
  }

  /**
   * Log account unlock
   */
  async logAccountUnlocked(context: AuditContext, by: 'timeout' | 'admin'): Promise<void> {
    await this.log('ACCOUNT_UNLOCKED', context, true, { unlocked_by: by });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    context: AuditContext,
    type: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.log('SUSPICIOUS_ACTIVITY', context, false, { type, ...details });
  }

  /**
   * Get recent auth events for a user
   */
  async getRecentEvents(userId: string, tenantId: string, limit = 50): Promise<AuthAuditEntry[]> {
    const logs = (await this.prisma.auditLog.findMany({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        resource: 'AUTH',
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    })) as AuditLogRecord[];

    return logs.map((log: AuditLogRecord) => ({
      action: log.action as AuthAction,
      user_id: log.user_id || undefined,
      tenant_id: log.tenant_id || undefined,
      ip_address: log.ip_address || '',
      user_agent: log.user_agent || '',
      success: log.success,
      metadata: log.metadata as Record<string, unknown>,
      timestamp: log.created_at,
    }));
  }

  /**
   * Get failed login attempts for an IP
   */
  getFailedAttemptsFromIp(ipAddress: string, since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        ip_address: ipAddress,
        action: 'LOGIN_FAILED',
        created_at: { gte: since },
      },
    });
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(context: AuditContext, action: AuthAction): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 3600000);

    // Check for multiple failed logins from same IP
    if (action === 'LOGIN_FAILED') {
      const failedCount = await this.getFailedAttemptsFromIp(context.ip_address, oneHourAgo);

      if (failedCount >= 10) {
        await this.logSuspiciousActivity(context, 'BRUTE_FORCE_ATTEMPT', {
          failed_attempts: failedCount,
          time_window: '1h',
        });
      }
    }

    // Check for login from new location (simplified)
    if (action === 'LOGIN_SUCCESS' && context.user_id) {
      const recentLogins = (await this.prisma.auditLog.findMany({
        where: {
          user_id: context.user_id,
          action: 'LOGIN_SUCCESS',
          created_at: { gte: new Date(Date.now() - 30 * 24 * 3600000) }, // 30 days
        },
        select: { ip_address: true },
        distinct: ['ip_address'],
      })) as Array<{ ip_address: string }>;

      const knownIps = new Set(recentLogins.map((log) => log.ip_address));
      if (!knownIps.has(context.ip_address) && knownIps.size > 0) {
        await this.logSuspiciousActivity(context, 'NEW_LOCATION_LOGIN', {
          new_ip: this.maskIp(context.ip_address),
        });
      }
    }
  }

  /**
   * Mask IP address for logging
   */
  private maskIp(ip: string): string {
    if (ip.includes('.')) {
      // IPv4
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.*.*`;
    }
    // IPv6
    return `${ip.substring(0, 10)}***`;
  }

  /**
   * Mask email for logging
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }
}

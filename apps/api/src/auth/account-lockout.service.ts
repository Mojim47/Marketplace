/**
 * Account Lockout Service
 * 
 * Enterprise-grade account lockout mechanism with:
 * - Database persistence (survives restarts)
 * - User-based and IP-based tracking
 * - Exponential backoff delays
 * - Admin override capability
 * - Audit logging
 * 
 * Requirements: 1.5 - Account lockout after 5 failed attempts
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Lockout Configuration
 * Based on OWASP recommendations
 */
export const LOCKOUT_CONFIG = {
  /** Maximum failed attempts before lockout */
  MAX_ATTEMPTS: 5,
  
  /** Time window for counting attempts (15 minutes) */
  ATTEMPT_WINDOW_MS: 15 * 60 * 1000,
  
  /** Base lockout duration (15 minutes) */
  BASE_LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  
  /** Maximum lockout duration (24 hours) */
  MAX_LOCKOUT_DURATION_MS: 24 * 60 * 60 * 1000,
  
  /** Exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 2,
  
  /** Delay between attempts (exponential) - base 1 second */
  BASE_DELAY_MS: 1000,
  
  /** Maximum delay between attempts (30 seconds) */
  MAX_DELAY_MS: 30 * 1000,
};

export interface LoginAttemptResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
  delayMs?: number;
  message: string;
}

export interface LockoutStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil?: Date;
  lockoutCount: number;
}

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if login attempt is allowed and record it
   * 
   * @param identifier - Email or user ID
   * @param ipAddress - Client IP address
   * @param success - Whether the login was successful
   */
  async recordLoginAttempt(
    identifier: string,
    ipAddress: string,
    success: boolean,
  ): Promise<LoginAttemptResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOCKOUT_CONFIG.ATTEMPT_WINDOW_MS);

    // Check current lockout status
    const lockoutStatus = await this.getLockoutStatus(identifier);
    
    if (lockoutStatus.isLocked && lockoutStatus.lockedUntil && lockoutStatus.lockedUntil > now) {
      const remainingMs = lockoutStatus.lockedUntil.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: lockoutStatus.lockedUntil,
        message: `Õ”«» ò«—»—Ì ﬁ›· ‘œÂ «” . ${remainingMinutes} œﬁÌﬁÂ œÌê—  ·«‘ ò‰Ìœ`,
      };
    }

    // If successful login, clear failed attempts
    if (success) {
      await this.clearFailedAttempts(identifier);
      return {
        allowed: true,
        remainingAttempts: LOCKOUT_CONFIG.MAX_ATTEMPTS,
        message: 'Ê—Êœ „Ê›ﬁ',
      };
    }

    // Count recent failed attempts
    const recentAttempts = await this.prisma.loginAttempt.count({
      where: {
        identifier,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    // Record the failed attempt
    await this.prisma.loginAttempt.create({
      data: {
        identifier,
        ipAddress,
        success: false,
        userAgent: '', // Will be set by caller
        createdAt: now,
      },
    });

    const newAttemptCount = recentAttempts + 1;
    const remainingAttempts = Math.max(0, LOCKOUT_CONFIG.MAX_ATTEMPTS - newAttemptCount);

    // Calculate exponential delay
    const delayMs = Math.min(
      LOCKOUT_CONFIG.BASE_DELAY_MS * Math.pow(LOCKOUT_CONFIG.BACKOFF_MULTIPLIER, newAttemptCount - 1),
      LOCKOUT_CONFIG.MAX_DELAY_MS,
    );

    // Check if should lock account
    if (newAttemptCount >= LOCKOUT_CONFIG.MAX_ATTEMPTS) {
      const lockoutDuration = this.calculateLockoutDuration(lockoutStatus.lockoutCount);
      const lockedUntil = new Date(now.getTime() + lockoutDuration);

      // Create or update lockout record
      await this.prisma.accountLockout.upsert({
        where: { identifier },
        create: {
          identifier,
          lockedUntil,
          lockoutCount: 1,
          reason: ' ⁄œ«œ  ·«‘ùÂ«Ì ‰«„Ê›ﬁ »Ì‘ «“ Õœ „Ã«“',
        },
        update: {
          lockedUntil,
          lockoutCount: { increment: 1 },
          reason: ' ⁄œ«œ  ·«‘ùÂ«Ì ‰«„Ê›ﬁ »Ì‘ «“ Õœ „Ã«“',
        },
      });

      this.logger.warn(
        `Account locked: ${identifier} after ${newAttemptCount} failed attempts. ` +
        `Locked until: ${lockedUntil.toISOString()}`,
      );

      const lockoutMinutes = Math.ceil(lockoutDuration / 60000);
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil,
        delayMs,
        message: `Õ”«» ò«—»—Ì »Â „œ  ${lockoutMinutes} œﬁÌﬁÂ ﬁ›· ‘œ`,
      };
    }

    return {
      allowed: true,
      remainingAttempts,
      delayMs,
      message: `${remainingAttempts}  ·«‘ »«ﬁÌù„«‰œÂ`,
    };
  }

  /**
   * Get current lockout status for an identifier
   */
  async getLockoutStatus(identifier: string): Promise<LockoutStatus> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOCKOUT_CONFIG.ATTEMPT_WINDOW_MS);

    // Get lockout record
    const lockout = await this.prisma.accountLockout.findUnique({
      where: { identifier },
    });

    // Count recent failed attempts
    const failedAttempts = await this.prisma.loginAttempt.count({
      where: {
        identifier,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    const isLocked = lockout?.lockedUntil ? lockout.lockedUntil > now : false;

    return {
      isLocked,
      failedAttempts,
      lockedUntil: isLocked ? lockout?.lockedUntil : undefined,
      lockoutCount: lockout?.lockoutCount ?? 0,
    };
  }

  /**
   * Clear failed attempts after successful login
   */
  async clearFailedAttempts(identifier: string): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOCKOUT_CONFIG.ATTEMPT_WINDOW_MS);

    // Delete recent failed attempts
    await this.prisma.loginAttempt.deleteMany({
      where: {
        identifier,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    // Clear lockout if exists
    await this.prisma.accountLockout.deleteMany({
      where: { identifier },
    });

    this.logger.log(`Cleared failed attempts for: ${identifier}`);
  }

  /**
   * Admin override to unlock an account
   */
  async adminUnlock(identifier: string, adminId: string): Promise<boolean> {
    const lockout = await this.prisma.accountLockout.findUnique({
      where: { identifier },
    });

    if (!lockout) {
      return false;
    }

    await this.prisma.accountLockout.delete({
      where: { identifier },
    });

    // Clear recent failed attempts
    await this.clearFailedAttempts(identifier);

    this.logger.log(`Account unlocked by admin ${adminId}: ${identifier}`);

    return true;
  }

  /**
   * Calculate lockout duration with exponential backoff
   */
  private calculateLockoutDuration(previousLockouts: number): number {
    const duration = LOCKOUT_CONFIG.BASE_LOCKOUT_DURATION_MS * 
      Math.pow(LOCKOUT_CONFIG.BACKOFF_MULTIPLIER, previousLockouts);
    
    return Math.min(duration, LOCKOUT_CONFIG.MAX_LOCKOUT_DURATION_MS);
  }

  /**
   * Get all currently locked accounts (for admin dashboard)
   */
  async getLockedAccounts(): Promise<Array<{
    identifier: string;
    lockedUntil: Date;
    lockoutCount: number;
    reason: string;
  }>> {
    const now = new Date();
    
    return this.prisma.accountLockout.findMany({
      where: {
        lockedUntil: { gt: now },
      },
      select: {
        identifier: true,
        lockedUntil: true,
        lockoutCount: true,
        reason: true,
      },
      orderBy: { lockedUntil: 'desc' },
    });
  }

  /**
   * Cleanup old login attempts (run periodically)
   */
  async cleanupOldAttempts(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await this.prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} old login attempts`);
    }

    return result.count;
  }
}

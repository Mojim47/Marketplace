// ═══════════════════════════════════════════════════════════════════════════
// Account Lockout Service - Brute Force Protection
// ═══════════════════════════════════════════════════════════════════════════
// Implements account lockout after failed login attempts
// - Tracks failed attempts per user
// - Progressive lockout duration
// - Automatic unlock after timeout
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthConfig } from '../types';

export interface LockoutStatus {
  is_locked: boolean;
  failed_attempts: number;
  locked_until: Date | null;
  remaining_attempts: number;
}

@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);
  private readonly maxAttempts: number;
  private readonly baseLockoutMinutes: number;

  constructor(
    private readonly prisma: any,
    private readonly configService: ConfigService
  ) {
    const lockoutConfig = this.configService.get<AuthConfig['lockout']>('auth.lockout');
    this.maxAttempts = lockoutConfig?.max_failed_attempts || 5;
    this.baseLockoutMinutes = lockoutConfig?.lockout_duration_minutes || 30;
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedAttempt(userId: string): Promise<LockoutStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        failed_attempts: true,
        locked_until: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const newAttempts = user.failed_attempts + 1;
    let lockedUntil: Date | null = null;

    // Check if should lock
    if (newAttempts >= this.maxAttempts) {
      // Progressive lockout: doubles each time
      const lockoutMultiplier = Math.floor(newAttempts / this.maxAttempts);
      const lockoutMinutes = this.baseLockoutMinutes * 2 ** (lockoutMultiplier - 1);
      lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);

      this.logger.warn('Account locked due to failed attempts', {
        user_id: userId,
        attempts: newAttempts,
        locked_until: lockedUntil,
        lockout_minutes: lockoutMinutes,
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failed_attempts: newAttempts,
        locked_until: lockedUntil,
      },
    });

    return {
      is_locked: lockedUntil !== null && lockedUntil > new Date(),
      failed_attempts: newAttempts,
      locked_until: lockedUntil,
      remaining_attempts: Math.max(0, this.maxAttempts - newAttempts),
    };
  }

  /**
   * Reset failed attempts on successful login
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failed_attempts: 0,
        locked_until: null,
      },
    });

    this.logger.debug('Failed attempts reset', { user_id: userId });
  }

  /**
   * Check if account is locked
   */
  async checkLockout(userId: string): Promise<LockoutStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        failed_attempts: true,
        locked_until: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const isLocked = user.locked_until !== null && user.locked_until > now;

    // Auto-unlock if lockout has expired
    if (user.locked_until !== null && user.locked_until <= now) {
      // Don't reset attempts, just unlock
      await this.prisma.user.update({
        where: { id: userId },
        data: { locked_until: null },
      });
    }

    return {
      is_locked: isLocked,
      failed_attempts: user.failed_attempts,
      locked_until: isLocked ? user.locked_until : null,
      remaining_attempts: Math.max(0, this.maxAttempts - user.failed_attempts),
    };
  }

  /**
   * Manually unlock an account (admin action)
   */
  async unlockAccount(userId: string, adminId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failed_attempts: 0,
        locked_until: null,
      },
    });

    this.logger.log('Account manually unlocked', {
      user_id: userId,
      unlocked_by: adminId,
    });
  }

  /**
   * Get lockout remaining time in seconds
   */
  async getLockoutRemaining(userId: string): Promise<number> {
    const status = await this.checkLockout(userId);

    if (!status.is_locked || !status.locked_until) {
      return 0;
    }

    return Math.max(0, Math.ceil((status.locked_until.getTime() - Date.now()) / 1000));
  }
}

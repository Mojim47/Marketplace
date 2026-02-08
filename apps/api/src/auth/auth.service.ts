import { Injectable, UnauthorizedException, ConflictException, Logger, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { AccountLockoutService } from './account-lockout.service';
import { EnhancedTOTPService } from './totp.service';
import { JWTManager, BruteForceProtection } from '@nextgen/security';
import { SECURITY_TOKENS } from '../shared/security/tokens';

/**
 * Argon2id Configuration - OWASP Recommended Settings
 * Memory: 65536 KiB (64 MiB)
 * Time: 3 iterations
 * Parallelism: 4 threads
 * 
 * These settings provide strong protection against:
 * - GPU-based attacks
 * - Side-channel attacks
 * - Time-memory trade-off attacks
 */
const ARGON2_CONFIG: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MiB - OWASP minimum recommendation
  timeCost: 3,        // 3 iterations - OWASP minimum recommendation
  parallelism: 4,     // 4 threads
  hashLength: 32,     // 256-bit hash output
};

export interface LoginDto {
  email: string;
  password: string;
  totpCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  mobile: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    mobile: string | null;
    role: string;
    firstName: string | null;
    lastName: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly lockoutService: AccountLockoutService,
    private readonly totpService: EnhancedTOTPService,
    @Optional() @Inject(SECURITY_TOKENS.JWT_MANAGER)
    private readonly jwtManager?: JWTManager,
    @Optional() @Inject(SECURITY_TOKENS.BRUTE_FORCE)
    private readonly bruteForceProtection?: BruteForceProtection,
  ) {
    this.jwtIssuer = this.configService?.get<string>('JWT_ISSUER') || 'nextgen-marketplace';
    this.jwtAudience = this.configService?.get<string>('JWT_AUDIENCE') || 'nextgen-api';
  }

  /**
   * Generate JWT token with proper claims using JWTManager from libs/security
   * Falls back to NestJS JwtService if JWTManager is not available
   * 
   * Standard claims included:
   * - sub: Subject (user ID)
   * - iss: Issuer (configured via JWT_ISSUER)
   * - aud: Audience (configured via JWT_AUDIENCE)
   * - iat: Issued at (automatic)
   * - exp: Expiration (automatic based on signOptions)
   * - nbf: Not before (set to current time)
   * - jti: JWT ID (unique identifier for token revocation)
   */
  private async generateToken(payload: {
    sub: string;
    email: string;
    role: string;
    tenantId?: string;
  }): Promise<string> {
    // Use JWTManager from libs/security if available (RS256 with key rotation)
    if (this.jwtManager) {
      try {
        const tokenResult = await this.jwtManager.issueTokens(payload.sub, {
          role: payload.role,
          email: payload.email,
          tenantId: payload.tenantId,
        });
        return tokenResult.accessToken;
      } catch (error) {
        this.logger.warn(`JWTManager token generation failed, falling back to JwtService: ${error.message}`);
      }
    }

    // Fallback to NestJS JwtService
    const now = Math.floor(Date.now() / 1000);
    
    return this.jwtService.sign({
      ...payload,
      jti: randomUUID(), // Unique token ID for revocation support
      nbf: now, // Not valid before current time
    });
  }

  /**
   * Generate token pair (access + refresh) using JWTManager
   */
  async generateTokenPair(payload: {
    sub: string;
    email: string;
    role: string;
    tenantId?: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
    if (this.jwtManager) {
      try {
        const tokenResult = await this.jwtManager.issueTokens(payload.sub, {
          role: payload.role,
          email: payload.email,
          tenantId: payload.tenantId,
        });
        return {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          expiresAt: tokenResult.expiresAt,
        };
      } catch (error) {
        this.logger.warn(`JWTManager token pair generation failed: ${error.message}`);
      }
    }

    // Fallback - generate only access token
    const accessToken = await this.generateToken(payload);
    return {
      accessToken,
      refreshToken: '', // Not available without JWTManager
      expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    };
  }

  /**
   * Verify and refresh an access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
    if (!this.jwtManager) {
      this.logger.warn('JWTManager not available for token refresh');
      return null;
    }

    try {
      const result = await this.jwtManager.refreshAccessToken(refreshToken);
      if (!result) {
        return null;
      }
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      this.logger.warn(`Token refresh failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify a JWT token using JWTManager
   */
  async verifyToken(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
    if (this.jwtManager) {
      try {
        const result = await this.jwtManager.verifyToken(token);
        return result;
      } catch (error) {
        return { valid: false, error: error.message };
      }
    }

    // Fallback to NestJS JwtService
    try {
      const payload = this.jwtService.verify(token);
      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Check brute force protection status for an identifier
   * Uses BruteForceProtection from libs/security if available
   */
  private checkBruteForceStatus(identifier: string, ipAddress: string): { allowed: boolean; remainingAttempts: number; blockedUntil?: Date } {
    if (this.bruteForceProtection) {
      const combinedKey = `${ipAddress}:${identifier}`.toLowerCase();
      if (this.bruteForceProtection.isBlocked(combinedKey)) {
        const attempts = this.bruteForceProtection.getAttempts(combinedKey);
        return {
          allowed: false,
          remainingAttempts: 0,
          blockedUntil: attempts?.blockedUntil ? new Date(attempts.blockedUntil) : undefined,
        };
      }
      return {
        allowed: true,
        remainingAttempts: this.bruteForceProtection.getRemainingAttempts(combinedKey),
      };
    }
    return { allowed: true, remainingAttempts: 5 };
  }

  /**
   * Record a brute force attempt (failed or successful)
   */
  private recordBruteForceAttempt(identifier: string, ipAddress: string, success: boolean): void {
    if (this.bruteForceProtection) {
      const combinedKey = `${ipAddress}:${identifier}`.toLowerCase();
      this.bruteForceProtection.recordAttempt(combinedKey, success);
    }
  }

  /**
   * Hash password using Argon2id with OWASP-recommended settings
   * Argon2id is the winner of the Password Hashing Competition and
   * provides the best protection against both GPU and side-channel attacks
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_CONFIG);
  }

  /**
   * Verify password against Argon2id hash
   * Uses constant-time comparison to prevent timing attacks
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      // argon2.verify uses constant-time comparison internally
      return await argon2.verify(hash, password);
    } catch (error) {
      // Log error but don't expose details to prevent information leakage
      this.logger.warn('Password verification failed - invalid hash format');
      return false;
    }
  }

  /**
   * Check if a hash needs rehashing (e.g., if parameters have changed)
   */
  async needsRehash(hash: string): Promise<boolean> {
    try {
      return argon2.needsRehash(hash, ARGON2_CONFIG);
    } catch {
      return true; // If we can't check, assume it needs rehashing
    }
  }

  // Alias for login to keep API compatibility with callers using signIn
  async signIn(dto: LoginDto): Promise<AuthResponse> {
    return this.login(dto);
  }
  async login(dto: LoginDto): Promise<AuthResponse> {
    const ipAddress = dto.ipAddress || '0.0.0.0';
    
    // Check brute force protection from libs/security first
    const bruteForceStatus = this.checkBruteForceStatus(dto.email, ipAddress);
    if (!bruteForceStatus.allowed) {
      const remainingMinutes = bruteForceStatus.blockedUntil 
        ? Math.ceil((bruteForceStatus.blockedUntil.getTime() - Date.now()) / 60000)
        : 15;
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `حساب شما به دليل تلاش‌هاي ناموفق متعدد قفل شده است. لطفاً ${remainingMinutes} دقيقه ديگر تلاش کنيد.`,
          lockedUntil: bruteForceStatus.blockedUntil,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Also check database-based account lockout status
    const lockoutCheck = await this.lockoutService.recordLoginAttempt(
      dto.email,
      ipAddress,
      false, // We'll update this after verification
    );

    // If account is locked, throw immediately
    if (!lockoutCheck.allowed && lockoutCheck.lockedUntil) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: lockoutCheck.message,
          lockedUntil: lockoutCheck.lockedUntil,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Apply exponential delay if configured
    if (lockoutCheck.delayMs && lockoutCheck.delayMs > 0) {
      await this.delay(lockoutCheck.delayMs);
    }

    // Check if admin login
    const admin = await this.prisma.admin.findFirst({
      where: { email: dto.email },
    });

    if (admin) {
      if (!admin.passwordHash) {
        await this.recordFailedLogin(dto.email, ipAddress, 'INVALID_CREDENTIALS');
        this.recordBruteForceAttempt(dto.email, ipAddress, false);
        throw new UnauthorizedException('نام کاربري يا رمز عبور اشتباه است');
      }

      const isPasswordValid = await this.verifyPassword(dto.password, admin.passwordHash);
      if (!isPasswordValid) {
        await this.recordFailedLogin(dto.email, ipAddress, 'INVALID_PASSWORD');
        this.recordBruteForceAttempt(dto.email, ipAddress, false);
        throw new UnauthorizedException('نام کاربري يا رمز عبور اشتباه است');
      }

      if (!admin.isActive) {
        await this.recordFailedLogin(dto.email, ipAddress, 'ACCOUNT_INACTIVE');
        this.recordBruteForceAttempt(dto.email, ipAddress, false);
        throw new UnauthorizedException('حساب کاربري غيرفعال است');
      }

      // Enforce 2FA for admin
      if (admin.isTwoFactorEnabled) {
        if (!dto.totpCode) {
          throw new UnauthorizedException('کد 2FA الزامي است');
        }

        const verifyResult = this.totpService.verify(
          admin.twoFactorSecret!,
          dto.totpCode,
        );

        if (!verifyResult.valid) {
          await this.recordFailedLogin(dto.email, ipAddress, 'INVALID_2FA');
          this.recordBruteForceAttempt(dto.email, ipAddress, false);
          throw new UnauthorizedException('کد 2FA نامعتبر است');
        }
      }

      // Successful login - clear failed attempts
      await this.lockoutService.clearFailedAttempts(dto.email);
      this.recordBruteForceAttempt(dto.email, ipAddress, true);

      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });

      const payload = {
        sub: admin.id,
        email: admin.email,
        role: 'ADMIN',
      };

      return {
        access_token: await this.generateToken(payload),
        user: {
          id: admin.id,
          email: admin.email,
          mobile: null,
          role: 'ADMIN',
          firstName: admin.name,
          lastName: null,
        },
      };
    }

    // Regular user login
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      await this.recordFailedLogin(dto.email, ipAddress, 'USER_NOT_FOUND');
      this.recordBruteForceAttempt(dto.email, ipAddress, false);
      throw new UnauthorizedException('نام کاربري يا رمز عبور اشتباه است');
    }

    const isPasswordValid = await this.verifyPassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedLogin(dto.email, ipAddress, 'INVALID_PASSWORD');
      this.recordBruteForceAttempt(dto.email, ipAddress, false);
      throw new UnauthorizedException('نام کاربري يا رمز عبور اشتباه است');
    }

    // Check if password hash needs rehashing with updated parameters
    if (await this.needsRehash(user.passwordHash)) {
      const newHash = await this.hashPassword(dto.password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
      this.logger.log(`Rehashed password for user ${user.id} with updated Argon2id parameters`);
    }

    if (!user.isActive) {
      await this.recordFailedLogin(dto.email, ipAddress, 'ACCOUNT_INACTIVE');
      this.recordBruteForceAttempt(dto.email, ipAddress, false);
      throw new UnauthorizedException('حساب کاربري غيرفعال است');
    }

    if (user.isBanned) {
      await this.recordFailedLogin(dto.email, ipAddress, 'ACCOUNT_BANNED');
      this.recordBruteForceAttempt(dto.email, ipAddress, false);
      throw new UnauthorizedException(`حساب کاربري مسدود شده است. دليل: ${user.bannedReason || 'نامشخص'}`);
    }

    // Successful login - clear failed attempts
    await this.lockoutService.clearFailedAttempts(dto.email);
    this.recordBruteForceAttempt(dto.email, ipAddress, true);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: await this.generateToken(payload),
      user: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  /**
   * Record a failed login attempt
   */
  private async recordFailedLogin(
    identifier: string,
    ipAddress: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        identifier,
        ipAddress,
        success: false,
        failureReason: reason,
      },
    });
  }

  /**
   * Delay helper for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { mobile: dto.mobile },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('اين ايميل قبلاً ثبت شده است');
      }
      if (existingUser.mobile === dto.mobile) {
        throw new ConflictException('اين شماره موبايل قبلاً ثبت شده است');
      }
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        mobile: dto.mobile,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'USER',
        isActive: true,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: await this.generateToken(payload),
      user: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        mobile: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isBanned: true,
      },
    });
  }

  // ???????????????????????????????????????????????????????????????????????????
  // 2FA/TOTP Methods
  // Requirements: 2.1, 2.2, 2.3, 2.4
  // ???????????????????????????????????????????????????????????????????????????

  /**
   * Enable 2FA for a user - generates TOTP secret and backup codes
   * Requirements: 2.1 - Generate TOTP secret and QR code
   */
  async enable2FA(userId: string): Promise<{
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
  }> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    // Check if 2FA is already enabled
    if (user.isTwoFactorEnabled) {
      throw new ConflictException('احراز هويت دو مرحله‌اي قبلاً فعال شده است');
    }

    // Generate TOTP secret and backup codes
    const mfaSetup = await this.totpService.setupMFA(user.email);

    // Store the secret temporarily (not enabled yet until verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: mfaSetup.totp.secret,
        twoFactorBackupCodes: mfaSetup.hashedBackupCodes,
        // Don't enable yet - wait for verification
      },
    });

    this.logger.log(`2FA setup initiated for user ${userId}`);

    return {
      secret: mfaSetup.totp.base32,
      otpauthUrl: mfaSetup.totp.otpauthUrl,
      backupCodes: mfaSetup.backupCodes,
    };
  }

  /**
   * Verify TOTP code to complete 2FA setup
   * Requirements: 2.2 - Validate TOTP code
   */
  async verify2FASetup(userId: string, code: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    if (!user.twoFactorSecret) {
      throw new ConflictException('ابتدا بايد 2FA را فعال کنيد');
    }

    if (user.isTwoFactorEnabled) {
      throw new ConflictException('احراز هويت دو مرحله‌اي قبلاً تاييد شده است');
    }

    // Verify the TOTP code
    const verifyResult = this.totpService.verify(user.twoFactorSecret, code);

    if (!verifyResult.valid) {
      throw new UnauthorizedException('کد تاييد نامعتبر است');
    }

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: true,
      },
    });

    this.logger.log(`2FA enabled for user ${userId}`);

    return { success: true };
  }

  /**
   * Verify TOTP code during login
   * Requirements: 2.2, 2.3 - Validate TOTP code, reject invalid codes
   */
  async verifyTOTP(userId: string, code: string): Promise<{ valid: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new ConflictException('احراز هويت دو مرحله‌اي فعال نيست');
    }

    const verifyResult = this.totpService.verify(user.twoFactorSecret, code);

    if (!verifyResult.valid) {
      this.logger.warn(`Invalid TOTP code for user ${userId}`);
      return { valid: false };
    }

    return { valid: true };
  }

  /**
   * Disable 2FA for a user
   * Requirements: 2.4 - Delete TOTP secret when disabled
   */
  async disable2FA(userId: string, password: string, totpCode?: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    if (!user.isTwoFactorEnabled) {
      throw new ConflictException('احراز هويت دو مرحله‌اي فعال نيست');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('رمز عبور تنظيم نشده است');
    }

    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('رمز عبور نادرست است');
    }

    // Verify TOTP code if provided
    if (totpCode && user.twoFactorSecret) {
      const verifyResult = this.totpService.verify(user.twoFactorSecret, totpCode);
      if (!verifyResult.valid) {
        throw new UnauthorizedException('کد 2FA نامعتبر است');
      }
    }

    // Disable 2FA and clear secrets
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    this.logger.log(`2FA disabled for user ${userId}`);

    return { success: true };
  }

  /**
   * Verify backup code for account recovery
   */
  async verifyBackupCode(userId: string, backupCode: string): Promise<{ valid: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    if (!user.isTwoFactorEnabled || !user.twoFactorBackupCodes?.length) {
      throw new ConflictException('کد پشتيبان موجود نيست');
    }

    const result = this.totpService.verifyBackupCode(backupCode, user.twoFactorBackupCodes);

    if (!result.valid) {
      this.logger.warn(`Invalid backup code for user ${userId}`);
      return { valid: false };
    }

    // Remove used backup code
    const updatedBackupCodes = [...user.twoFactorBackupCodes];
    updatedBackupCodes.splice(result.index, 1);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: updatedBackupCodes,
      },
    });

    this.logger.log(`Backup code used for user ${userId}, ${updatedBackupCodes.length} remaining`);

    return { valid: true };
  }

  /**
   * Get 2FA status for a user
   */
  async get2FAStatus(userId: string): Promise<{ enabled: boolean; remainingBackupCodes: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isTwoFactorEnabled: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    return {
      enabled: user.isTwoFactorEnabled || false,
      remainingBackupCodes: user.twoFactorBackupCodes?.length || 0,
    };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, password: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    if (!user.isTwoFactorEnabled) {
      throw new ConflictException('احراز هويت دو مرحله‌اي فعال نيست');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('رمز عبور تنظيم نشده است');
    }

    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('رمز عبور نادرست است');
    }

    // Generate new backup codes
    const { codes, hashedCodes } = this.totpService.generateBackupCodes();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: hashedCodes,
      },
    });

    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return { backupCodes: codes };
  }
}


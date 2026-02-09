// ═══════════════════════════════════════════════════════════════════════════
// Auth Service - Main Authentication Service
// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-grade authentication with:
// - Secure password hashing (Argon2id)
// - JWT with refresh token rotation
// - 2FA/TOTP support
// - Rate limiting and account lockout
// - Session management
// - Comprehensive audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticationError } from '@nextgen/errors';
import type { PrismaClient } from '@prisma/client';
import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  PasswordChangeRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  TotpSetupResponse,
  UserRole,
} from '../types';
import type { AuditContext, AuthAuditService } from './audit.service';
import type { LockoutService } from './lockout.service';
import type { PasswordService } from './password.service';
import type { RateLimitService } from './rate-limit.service';
import type { SessionService } from './session.service';
import type { TokenService } from './token.service';
import type { TotpService } from './totp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly rateLimitService: RateLimitService,
    private readonly lockoutService: LockoutService,
    private readonly totpService: TotpService,
    private readonly auditService: AuthAuditService
  ) {}

  /**
   * User login with email and password
   */
  async login(request: LoginRequest, context: AuditContext): Promise<LoginResponse> {
    const { email, password, tenant_slug, device_fingerprint, totp_code } = request;

    // Rate limiting check
    const rateLimitKey = `${tenant_slug}:${email}`;
    const rateLimit = await this.rateLimitService.checkAndIncrement('login', rateLimitKey);

    if (!rateLimit.allowed) {
      await this.auditService.logLoginFailed(context, 'RATE_LIMITED');
      throw AuthenticationError.rateLimited(rateLimit.retry_after || 60);
    }

    // Find tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenant_slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      await this.auditService.logLoginFailed(context, 'TENANT_NOT_FOUND');
      throw AuthenticationError.invalidCredentials();
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: {
        tenant_id_email: {
          tenant_id: tenant.id,
          email: email.toLowerCase(),
        },
      },
      include: {
        roles: {
          where: { is_active: true },
          select: { role: true },
        },
        dealer_profile: {
          select: { tier: true },
        },
      },
    });

    if (!user) {
      await this.auditService.logLoginFailed(
        { ...context, tenant_id: tenant.id },
        'USER_NOT_FOUND'
      );
      throw AuthenticationError.invalidCredentials();
    }

    // Update context with user info
    const userContext: AuditContext = {
      ...context,
      user_id: user.id,
      tenant_id: tenant.id,
    };

    // Check account status
    if (!user.is_active) {
      await this.auditService.logLoginFailed(userContext, 'ACCOUNT_DISABLED');
      throw AuthenticationError.accountDisabled();
    }

    // Check lockout
    const lockoutStatus = await this.lockoutService.checkLockout(user.id);
    if (lockoutStatus.is_locked) {
      const remaining = await this.lockoutService.getLockoutRemaining(user.id);
      await this.auditService.logLoginFailed(userContext, 'ACCOUNT_LOCKED');
      throw AuthenticationError.accountLocked(remaining);
    }

    // Verify password
    const passwordValid = await this.passwordService.verify(password, user.password_hash);

    if (!passwordValid) {
      const lockout = await this.lockoutService.recordFailedAttempt(user.id);
      await this.auditService.logLoginFailed(userContext, 'INVALID_PASSWORD', {
        remaining_attempts: lockout.remaining_attempts,
      });

      if (lockout.is_locked) {
        await this.auditService.logAccountLocked(userContext, 30);
        throw AuthenticationError.accountLocked(30 * 60);
      }

      throw AuthenticationError.invalidCredentials();
    }

    // Check 2FA
    const requiresTotp = await this.checkTotp(user, totp_code, userContext);
    if (requiresTotp) {
      return {
        access_token: '',
        refresh_token: '',
        token_type: 'Bearer',
        expires_in: 0,
        user: { id: user.id, email: user.email, roles: [] },
        requires_2fa: true,
      };
    }

    // Reset failed attempts on successful login
    await this.lockoutService.resetFailedAttempts(user.id);
    await this.rateLimitService.reset('login', rateLimitKey);

    // Create session
    const session = await this.sessionService.createSession({
      user_id: user.id,
      tenant_id: tenant.id,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      device_fingerprint,
    });

    // Get user roles
    const roles = user.roles.map((r: { role: UserRole }) => r.role);
    const scopes = this.tokenService.getDefaultScopes(roles);

    // Generate tokens
    const tokenPair = await this.tokenService.createTokenPair({
      user_id: user.id,
      tenant_id: tenant.id,
      email: user.email,
      roles,
      scopes,
      session_id: session.id,
      device_fingerprint,
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        last_login_ip: context.ip_address,
      },
    });

    // Audit log
    await this.auditService.logLoginSuccess({
      ...userContext,
      session_id: session.id,
    });

    // Check if password needs rehash
    if (await this.passwordService.needsRehash(user.password_hash)) {
      const newHash = await this.passwordService.hash(password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password_hash: newHash },
      });
    }

    return {
      access_token: tokenPair.access_token,
      refresh_token: tokenPair.refresh_token,
      token_type: 'Bearer',
      expires_in: tokenPair.expires_in,
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    };
  }

  private async checkTotp(
    user: { id: string; email: string; totp_enabled: boolean },
    totpCode: string | undefined,
    context: AuditContext
  ): Promise<boolean> {
    if (!user.totp_enabled) {
      return false;
    }
    if (!totpCode) {
      return true;
    }

    const totpValid = await this.totpService.verify(user.id, totpCode);
    if (!totpValid) {
      await this.auditService.logTotpVerified(context, false);
      throw AuthenticationError.invalidTotp();
    }
    await this.auditService.logTotpVerified(context, true);
    return false;
  }

  /**
   * Register a new user
   */
  async register(request: RegisterRequest, context: AuditContext): Promise<LoginResponse> {
    const {
      email,
      password,
      tenant_slug,
      phone,
      first_name,
      last_name,
      first_name_fa,
      last_name_fa,
      national_id,
    } = request;

    // Rate limiting
    const rateLimit = await this.rateLimitService.checkAndIncrement('register', context.ip_address);
    if (!rateLimit.allowed) {
      throw AuthenticationError.rateLimited(rateLimit.retry_after || 3600);
    }

    // Validate password
    const passwordValidation = this.passwordService.validate(password, { email, name: first_name });
    if (!passwordValidation.valid) {
      throw AuthenticationError.weakPassword(passwordValidation.errors);
    }

    // Find tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenant_slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw AuthenticationError.invalidCredentials();
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenant_id_email: {
          tenant_id: tenant.id,
          email: email.toLowerCase(),
        },
      },
    });

    if (existingUser) {
      throw AuthenticationError.emailAlreadyExists();
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: {
          tenant_id_phone: {
            tenant_id: tenant.id,
            phone,
          },
        },
      });

      if (existingPhone) {
        throw AuthenticationError.phoneAlreadyExists();
      }
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email: email.toLowerCase(),
        phone,
        national_id,
        password_hash: passwordHash,
        first_name,
        last_name,
        first_name_fa,
        last_name_fa,
        is_active: true,
        is_verified: false,
      },
    });

    // Assign default role
    await this.prisma.userRoleAssignment.create({
      data: {
        user_id: user.id,
        tenant_id: tenant.id,
        role: 'CUSTOMER' as UserRole,
        is_active: true,
      },
    });

    // Login the user
    return this.login(
      { email, password, tenant_slug },
      { ...context, user_id: user.id, tenant_id: tenant.id }
    );
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    request: RefreshTokenRequest,
    context: AuditContext
  ): Promise<RefreshTokenResponse> {
    try {
      const { payload, newTokenPair } = await this.tokenService.verifyAndRotateRefreshToken(
        request.refresh_token
      );

      // Update session activity
      await this.sessionService.updateActivity(payload.sid);

      await this.auditService.logTokenRefresh({
        ...context,
        user_id: payload.sub,
        tenant_id: payload.tid,
        session_id: payload.sid,
      });

      return {
        access_token: newTokenPair.access_token,
        refresh_token: newTokenPair.refresh_token,
        token_type: 'Bearer',
        expires_in: newTokenPair.expires_in,
      };
    } catch (error) {
      this.logger.warn('Token refresh failed', { error: (error as Error).message });
      throw AuthenticationError.tokenInvalid();
    }
  }

  /**
   * Logout user
   */
  async logout(
    request: LogoutRequest,
    user: AuthenticatedUser,
    context: AuditContext
  ): Promise<void> {
    const userContext: AuditContext = {
      ...context,
      user_id: user.id,
      tenant_id: user.tenant_id,
      session_id: user.session_id,
    };

    if (request.all_devices) {
      // Revoke all sessions
      await this.sessionService.terminateAllUserSessions(user.id);
      await this.tokenService.revokeAllUserSessions(user.id, user.tenant_id);
      await this.auditService.logLogout(userContext, true);
    } else {
      // Revoke current session only
      await this.sessionService.terminateSession(user.session_id);
      await this.tokenService.revokeSession(user.session_id);

      if (request.refresh_token) {
        await this.tokenService.blacklistToken(request.refresh_token);
      }

      await this.auditService.logLogout(userContext, false);
    }
  }

  /**
   * Change password
   */
  async changePassword(
    request: PasswordChangeRequest,
    user: AuthenticatedUser,
    context: AuditContext
  ): Promise<void> {
    const userContext: AuditContext = {
      ...context,
      user_id: user.id,
      tenant_id: user.tenant_id,
    };

    // Get current password hash
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password_hash: true },
    });

    if (!dbUser) {
      throw AuthenticationError.invalidCredentials();
    }

    // Verify current password
    const currentValid = await this.passwordService.verify(
      request.current_password,
      dbUser.password_hash
    );

    if (!currentValid) {
      throw AuthenticationError.invalidCredentials();
    }

    // Validate new password
    const validation = this.passwordService.validate(request.new_password, { email: user.email });
    if (!validation.valid) {
      throw AuthenticationError.weakPassword(validation.errors);
    }

    // Hash and update
    const newHash = await this.passwordService.hash(request.new_password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    // Revoke all other sessions
    await this.sessionService.terminateAllUserSessions(user.id, user.session_id);
    await this.tokenService.revokeAllUserSessions(user.id, user.tenant_id);

    await this.auditService.logPasswordChanged(userContext);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest, context: AuditContext): Promise<void> {
    // Rate limiting
    const rateLimit = await this.rateLimitService.checkAndIncrement(
      'password_reset',
      request.email
    );

    if (!rateLimit.allowed) {
      // Don't reveal rate limiting to prevent enumeration
      return;
    }

    await this.auditService.logPasswordResetRequested(context, request.email);

    // Find user (don't reveal if exists)
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: request.tenant_slug },
    });

    if (!tenant) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenant_id_email: {
          tenant_id: tenant.id,
          email: request.email.toLowerCase(),
        },
      },
    });

    if (!user) {
      return;
    }

    // Generate reset token (in production, send via email)
    // This is a placeholder - implement email sending
    this.logger.log('Password reset requested', {
      user_id: user.id,
      email: request.email,
    });
  }

  /**
   * Confirm password reset
   */
  confirmPasswordReset(request: PasswordResetConfirm, _context: AuditContext): void {
    // Validate new password
    const validation = this.passwordService.validate(request.new_password);
    if (!validation.valid) {
      throw AuthenticationError.weakPassword(validation.errors);
    }

    // Verify token and get user (implement token verification)
    // This is a placeholder
    throw new Error('Not implemented');
  }

  /**
   * Setup TOTP for user
   */
  setupTotp(user: AuthenticatedUser): Promise<TotpSetupResponse> {
    return this.totpService.generateSetup(user.id, user.email);
  }

  /**
   * Enable TOTP after verification
   */
  async enableTotp(user: AuthenticatedUser, code: string, context: AuditContext): Promise<boolean> {
    const success = await this.totpService.verifyAndEnable(user.id, code);

    if (success) {
      await this.auditService.logTotpEnabled({
        ...context,
        user_id: user.id,
        tenant_id: user.tenant_id,
      });
    }

    return success;
  }

  /**
   * Disable TOTP
   */
  async disableTotp(
    user: AuthenticatedUser,
    password: string,
    context: AuditContext
  ): Promise<void> {
    // Verify password first
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password_hash: true },
    });

    if (!dbUser) {
      throw AuthenticationError.invalidCredentials();
    }

    const passwordValid = await this.passwordService.verify(password, dbUser.password_hash);
    if (!passwordValid) {
      throw AuthenticationError.invalidCredentials();
    }

    await this.totpService.disable(user.id);
    await this.auditService.logTotpDisabled({
      ...context,
      user_id: user.id,
      tenant_id: user.tenant_id,
    });
  }

  /**
   * Get user's active sessions
   */
  getSessions(user: AuthenticatedUser) {
    return this.sessionService.getUserSessions(user.id);
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(
    user: AuthenticatedUser,
    sessionId: string,
    context: AuditContext
  ): Promise<void> {
    // Verify session belongs to user
    const session = await this.sessionService.getSession(sessionId);
    if (!session || session.user_id !== user.id) {
      throw new Error('Session not found');
    }

    await this.sessionService.terminateSession(sessionId);
    await this.tokenService.revokeSession(sessionId);

    await this.auditService.log(
      'SESSION_TERMINATED',
      {
        ...context,
        user_id: user.id,
        tenant_id: user.tenant_id,
        session_id: sessionId,
      },
      true
    );
  }

  /**
   * Validate user for JWT strategy
   */
  async validateUser(userId: string, tenantId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        roles: {
          where: { is_active: true },
          select: { role: true },
        },
        dealer_profile: {
          select: { tier: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    const roles = user.roles.map((r: { role: UserRole }) => r.role);
    const scopes = this.tokenService.getDefaultScopes(roles);

    return {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      phone: user.phone,
      roles,
      scopes,
      session_id: '', // Will be set from token
      is_active: user.is_active,
      is_verified: user.is_verified,
      dealer_tier: user.dealer_profile?.tier,
    };
  }
}

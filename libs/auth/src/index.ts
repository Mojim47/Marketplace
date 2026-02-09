// ═══════════════════════════════════════════════════════════════════════════
// Auth Library - Barrel Export
// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-grade authentication library for NextGen Marketplace
// ═══════════════════════════════════════════════════════════════════════════

// Module
export { AuthModule } from './auth.module';

// Types
export type {
  TokenPayload,
  TokenScope,
  TokenPair,
  AuthenticatedUser,
  UserCredentials,
  SessionInfo,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  TotpSetupResponse,
  TotpVerifyRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  PasswordChangeRequest,
  RateLimitConfig,
  RateLimitResult,
  AuthAction,
  AuthAuditEntry,
  AuthConfig,
} from './types';

// Config
export { authConfig } from './config/auth.config';

// Services
export { AuthService } from './services/auth.service';
export { PasswordService, type PasswordValidationResult } from './services/password.service';
export { TokenService, type CreateTokenOptions } from './services/token.service';
export {
  SessionService,
  type CreateSessionOptions,
  type SessionMetadata,
} from './services/session.service';
export { RateLimitService, type RateLimitAction } from './services/rate-limit.service';
export { LockoutService, type LockoutStatus } from './services/lockout.service';
export { TotpService } from './services/totp.service';
export { AuthAuditService, type AuditContext } from './services/audit.service';

// Strategies
export { JwtStrategy } from './strategies/jwt.strategy';

// Guards
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RolesGuard } from './guards/roles.guard';

// Decorators
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator';
export { CurrentUser, CurrentTenant } from './decorators/current-user.decorator';
export { RequireScopes, REQUIRED_SCOPES_KEY } from './decorators/scopes.decorator';
export { RequireRoles, REQUIRED_ROLES_KEY } from './decorators/roles.decorator';

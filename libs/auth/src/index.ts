// ═══════════════════════════════════════════════════════════════════════════
// Auth Library - Barrel Export
// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-grade authentication library for NextGen Marketplace
// ═══════════════════════════════════════════════════════════════════════════

// Module
export { AuthModule } from './auth.module';
// Config
export { authConfig } from './config/auth.config';
export { CurrentTenant, CurrentUser } from './decorators/current-user.decorator';
// Decorators
export { IS_PUBLIC_KEY, Public } from './decorators/public.decorator';
export { REQUIRED_ROLES_KEY, RequireRoles } from './decorators/roles.decorator';
export { REQUIRED_SCOPES_KEY, RequireScopes } from './decorators/scopes.decorator';
// Guards
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RolesGuard } from './guards/roles.guard';
export { type AuditContext, AuthAuditService } from './services/audit.service';
// Services
export { AuthService } from './services/auth.service';
export { LockoutService, type LockoutStatus } from './services/lockout.service';
export { PasswordService, type PasswordValidationResult } from './services/password.service';
export { type RateLimitAction, RateLimitService } from './services/rate-limit.service';
export {
  type CreateSessionOptions,
  type SessionMetadata,
  SessionService,
} from './services/session.service';
export { type CreateTokenOptions, TokenService } from './services/token.service';
export { TotpService } from './services/totp.service';
// Strategies
export { JwtStrategy } from './strategies/jwt.strategy';
// Types
export type {
  AuthAction,
  AuthAuditEntry,
  AuthConfig,
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  PasswordChangeRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RateLimitConfig,
  RateLimitResult,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  SessionInfo,
  TokenPair,
  TokenPayload,
  TokenScope,
  TotpSetupResponse,
  TotpVerifyRequest,
  UserCredentials,
} from './types';

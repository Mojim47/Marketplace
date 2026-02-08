// ═══════════════════════════════════════════════════════════════════════════
// Auth Types - Type Definitions for Authentication System
// ═══════════════════════════════════════════════════════════════════════════

import type { UserRole, DealerTier } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// Token Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TokenPayload {
  /** User ID (subject) */
  sub: string;
  /** Tenant ID for multi-tenancy */
  tid: string;
  /** User email */
  email: string;
  /** User roles */
  roles: UserRole[];
  /** Token scopes for fine-grained access */
  scopes: TokenScope[];
  /** Session ID for token binding */
  sid: string;
  /** Device fingerprint hash */
  dfp?: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Token type */
  type: 'access' | 'refresh';
}

export type TokenScope =
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'order:read'
  | 'order:create'
  | 'order:update'
  | 'order:cancel'
  | 'product:read'
  | 'product:create'
  | 'product:update'
  | 'product:delete'
  | 'vendor:read'
  | 'vendor:manage'
  | 'vendor:product:manage'
  | 'admin:user:read'
  | 'admin:user:manage'
  | 'admin:system:manage'
  | 'dealer:read'
  | 'dealer:order:create'
  | 'executor:read'
  | 'executor:bid:create'
  | 'executor:project:manage';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// User Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AuthenticatedUser {
  id: string;
  tenant_id: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  scopes: TokenScope[];
  session_id: string;
  is_active: boolean;
  is_verified: boolean;
  dealer_tier?: DealerTier;
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface SessionInfo {
  id: string;
  user_id: string;
  tenant_id: string;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
  expires_at: Date;
  last_activity_at: Date;
  is_active: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Request/Response DTOs
// ═══════════════════════════════════════════════════════════════════════════

export interface LoginRequest {
  email: string;
  password: string;
  tenant_slug: string;
  device_fingerprint?: string;
  totp_code?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: {
    id: string;
    email: string;
    roles: UserRole[];
  };
  requires_2fa?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  first_name_fa?: string;
  last_name_fa?: string;
  tenant_slug: string;
  national_id?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface LogoutRequest {
  refresh_token?: string;
  all_devices?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2FA Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TotpSetupResponse {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

export interface TotpVerifyRequest {
  code: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Password Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PasswordResetRequest {
  email: string;
  tenant_slug: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting Types
// ═══════════════════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  /** Maximum attempts allowed */
  max_attempts: number;
  /** Window duration in seconds */
  window_seconds: number;
  /** Block duration in seconds after exceeding limit */
  block_seconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: Date;
  retry_after?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Audit Types
// ═══════════════════════════════════════════════════════════════════════════

export type AuthAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'TOKEN_REVOKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'TOTP_ENABLED'
  | 'TOTP_DISABLED'
  | 'TOTP_VERIFIED'
  | 'TOTP_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'SESSION_CREATED'
  | 'SESSION_TERMINATED'
  | 'SUSPICIOUS_ACTIVITY';

export interface AuthAuditEntry {
  action: AuthAction;
  user_id?: string;
  tenant_id?: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AuthConfig {
  jwt: {
    secret: string;
    refresh_secret: string;
    access_expiration: string;
    refresh_expiration: string;
    issuer: string;
    audience: string;
  };
  password: {
    min_length: number;
    require_uppercase: boolean;
    require_lowercase: boolean;
    require_numbers: boolean;
    require_special: boolean;
    bcrypt_rounds: number;
  };
  rate_limit: {
    login: RateLimitConfig;
    register: RateLimitConfig;
    password_reset: RateLimitConfig;
  };
  lockout: {
    max_failed_attempts: number;
    lockout_duration_minutes: number;
  };
  session: {
    max_concurrent_sessions: number;
    idle_timeout_minutes: number;
    absolute_timeout_hours: number;
  };
  totp: {
    issuer: string;
    window: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Auth Configuration - Environment-based Configuration
// ═══════════════════════════════════════════════════════════════════════════

import { registerAs } from '@nestjs/config';
import type { AuthConfig } from '../types';

export const authConfig = registerAs(
  'auth',
  (): AuthConfig => ({
    jwt: {
      secret: process.env.JWT_SECRET || '',
      refresh_secret: process.env.JWT_REFRESH_SECRET || '',
      access_expiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
      refresh_expiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
      issuer: process.env.JWT_ISSUER || 'nextgen-marketplace',
      audience: process.env.JWT_AUDIENCE || 'nextgen-api',
    },
    password: {
      min_length: Number.parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
      require_uppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
      require_lowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
      require_numbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
      require_special: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
      bcrypt_rounds: Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    },
    rate_limit: {
      login: {
        max_attempts: Number.parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
        window_seconds: Number.parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW || '60', 10),
        block_seconds: Number.parseInt(process.env.RATE_LIMIT_LOGIN_BLOCK || '900', 10),
      },
      register: {
        max_attempts: Number.parseInt(process.env.RATE_LIMIT_REGISTER_MAX || '3', 10),
        window_seconds: Number.parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || '3600', 10),
        block_seconds: Number.parseInt(process.env.RATE_LIMIT_REGISTER_BLOCK || '86400', 10),
      },
      password_reset: {
        max_attempts: Number.parseInt(process.env.RATE_LIMIT_RESET_MAX || '3', 10),
        window_seconds: Number.parseInt(process.env.RATE_LIMIT_RESET_WINDOW || '3600', 10),
        block_seconds: Number.parseInt(process.env.RATE_LIMIT_RESET_BLOCK || '3600', 10),
      },
    },
    lockout: {
      max_failed_attempts: Number.parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10),
      lockout_duration_minutes: Number.parseInt(process.env.LOCKOUT_DURATION || '30', 10),
    },
    session: {
      max_concurrent_sessions: Number.parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
      idle_timeout_minutes: Number.parseInt(process.env.SESSION_IDLE_TIMEOUT || '30', 10),
      absolute_timeout_hours: Number.parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '24', 10),
    },
    totp: {
      issuer: process.env.TOTP_ISSUER || 'NextGen Marketplace',
      window: Number.parseInt(process.env.TOTP_WINDOW || '1', 10),
    },
  })
);

export default authConfig;

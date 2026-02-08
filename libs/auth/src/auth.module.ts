// ═══════════════════════════════════════════════════════════════════════════
// Auth Module - Authentication and Authorization Module
// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-grade authentication with:
// - JWT with refresh token rotation
// - 2FA/TOTP support
// - Rate limiting and account lockout
// - Session management
// - Comprehensive audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

// Config
import { authConfig } from './config/auth.config';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Services
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { RateLimitService } from './services/rate-limit.service';
import { LockoutService } from './services/lockout.service';
import { TotpService } from './services/totp.service';
import { AuthAuditService } from './services/audit.service';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.secret') || configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('auth.jwt.access_expiration', '15m'),
          issuer: configService.get<string>('auth.jwt.issuer', 'nextgen-marketplace'),
          audience: configService.get<string>('auth.jwt.audience', 'nextgen-api'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Database
    PrismaClient,

    // Strategies
    JwtStrategy,

    // Guards
    JwtAuthGuard,
    RolesGuard,

    // Services
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    RateLimitService,
    LockoutService,
    TotpService,
    AuthAuditService,
  ],
  exports: [
    // Guards
    JwtAuthGuard,
    RolesGuard,

    // Services
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    RateLimitService,
    LockoutService,
    TotpService,
    AuthAuditService,

    // Modules
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}

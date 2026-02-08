import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AccountLockoutService } from './account-lockout.service';
import { EnhancedTOTPService } from './totp.service';
import { SMSVerificationService } from './sms-verification.service';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../shared/security/security.module';

/**
 * Authentication Module
 * 
 * Security Features:
 * - RS256 asymmetric JWT signing (2048-bit RSA keys) via JWTManager from libs/security
 * - Proper JWT claims (issuer, audience, not-before)
 * - Argon2id password hashing
 * - TOTP 2FA support
 * - Brute force protection via BruteForceProtection from libs/security
 * - SMS verification via KavehNegar
 * 
 * Environment Variables Required:
 * - JWT_PRIVATE_KEY: RSA private key (PEM format)
 * - JWT_PUBLIC_KEY: RSA public key (PEM format)
 * - JWT_ISSUER: Token issuer (e.g., 'nextgen-marketplace')
 * - JWT_AUDIENCE: Token audience (e.g., 'nextgen-api')
 * - KAVEHNEGAR_API_KEY: KavehNegar SMS API key (for production)
 * 
 * Requirements: 1.1, 1.6, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SecurityModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const privateKey = config.get<string>('JWT_PRIVATE_KEY');
        const publicKey = config.get<string>('JWT_PUBLIC_KEY');
        const issuer = config.get<string>('JWT_ISSUER') || 'nextgen-marketplace';
        const audience = config.get<string>('JWT_AUDIENCE') || 'nextgen-api';

        // Validate that RS256 keys are provided in production
        if (config.get('NODE_ENV') === 'production') {
          if (!privateKey || !publicKey) {
            throw new Error(
              'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production. ' +
              'Generate RSA keys with: openssl genrsa -out private.pem 2048 && ' +
              'openssl rsa -in private.pem -pubout -out public.pem'
            );
          }
        }

        // Use RS256 with RSA keys if available, otherwise fall back to HS256 for development
        if (privateKey && publicKey) {
          return {
            privateKey: privateKey.replace(/\\n/g, '\n'),
            publicKey: publicKey.replace(/\\n/g, '\n'),
            signOptions: {
              algorithm: 'RS256' as const,
              expiresIn: '24h',
              issuer,
              audience,
              notBefore: '0', // Token valid immediately
            },
            verifyOptions: {
              algorithms: ['RS256'] as const,
              issuer,
              audience,
            },
          };
        }

        // Development fallback - HS256 with warning
        console.warn(
          '??  WARNING: Using HS256 JWT algorithm. ' +
          'Configure JWT_PRIVATE_KEY and JWT_PUBLIC_KEY for RS256 in production.'
        );

        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must be at least 32 characters');
        }

        return {
          secret,
          signOptions: {
            algorithm: 'HS256' as const,
            expiresIn: '24h',
            issuer,
            audience,
          },
          verifyOptions: {
            algorithms: ['HS256'] as const,
            issuer,
            audience,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    JwtStrategy, 
    AccountLockoutService, 
    EnhancedTOTPService,
    SMSVerificationService,
  ],
  exports: [
    AuthService, 
    JwtStrategy, 
    AccountLockoutService, 
    EnhancedTOTPService,
    SMSVerificationService,
  ],
})
export class AuthModule {}

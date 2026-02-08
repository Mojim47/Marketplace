// ═══════════════════════════════════════════════════════════════════════════
// JWT Strategy - Passport JWT Strategy for Token Validation
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { TokenPayload, AuthenticatedUser, AuthConfig } from '../types';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {
    const jwtConfig = configService.get<AuthConfig['jwt']>('auth.jwt');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig?.secret || configService.get<string>('JWT_SECRET', ''),
      issuer: jwtConfig?.issuer || 'nextgen-marketplace',
      audience: jwtConfig?.audience || 'nextgen-api',
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: TokenPayload): Promise<AuthenticatedUser> {
    // Verify token type
    if (payload.type !== 'access') {
      this.logger.warn('Invalid token type used for authentication', {
        type: payload.type,
        user_id: payload.sub,
      });
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify session is still valid
    const session = await this.sessionService.getSession(payload.sid);
    if (!session) {
      this.logger.warn('Session not found or expired', {
        session_id: payload.sid,
        user_id: payload.sub,
      });
      throw new UnauthorizedException('Session expired');
    }

    // Validate device fingerprint if present
    const deviceFingerprint = request.headers['x-device-fingerprint'] as string | undefined;
    if (payload.dfp && deviceFingerprint) {
      const validation = await this.sessionService.validateSession(
        payload.sid,
        deviceFingerprint,
        request.ip,
      );

      if (!validation.valid) {
        this.logger.warn('Session validation failed', {
          reason: validation.reason,
          session_id: payload.sid,
        });
        throw new UnauthorizedException(validation.reason);
      }
    }

    // Get full user data
    const user = await this.authService.validateUser(payload.sub, payload.tid);
    if (!user) {
      this.logger.warn('User not found or inactive', {
        user_id: payload.sub,
        tenant_id: payload.tid,
      });
      throw new UnauthorizedException('User not found');
    }

    // Update session activity
    await this.sessionService.updateActivity(payload.sid);

    // Return authenticated user with session info
    return {
      ...user,
      session_id: payload.sid,
      scopes: payload.scopes,
    };
  }
}

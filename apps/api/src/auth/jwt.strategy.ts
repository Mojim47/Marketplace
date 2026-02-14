import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';
import type { AuthService } from './auth.service';

/**
 * JWT Payload Interface
 *
 * Standard JWT claims:
 * - sub: Subject (user ID)
 * - iss: Issuer
 * - aud: Audience
 * - iat: Issued at
 * - exp: Expiration
 * - nbf: Not before
 * - jti: JWT ID (unique identifier)
 *
 * Custom claims:
 * - email: User email
 * - role: User role
 * - tenantId: Multi-tenant identifier (optional)
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  nbf?: number;
  jti?: string;
  tenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    // Get config from environment directly since we can't inject before super()
    const rawPublicKey = process.env.JWT_PUBLIC_KEY;
    const publicKey =
      rawPublicKey && rawPublicKey !== 'undefined' && rawPublicKey.trim().length > 0
        ? rawPublicKey
        : '';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const secret =
      process.env.JWT_SECRET || (nodeEnv !== 'production' ? process.env.JWT_SECRET_DEV : undefined);
    const issuer = process.env.JWT_ISSUER || 'nextgen-marketplace';
    const audience = process.env.JWT_AUDIENCE || 'nextgen-api';

    if (nodeEnv === 'production' && !publicKey) {
      throw new Error('FATAL: JWT_PUBLIC_KEY must be defined in production environment');
    }

    // Build strategy options based on available keys
    let strategyOptions: StrategyOptionsWithoutRequest;

    // Use RS256 with public key if available
    if (publicKey) {
      strategyOptions = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        issuer,
        audience,
        secretOrKey: publicKey.replace(/\\n/g, '\n'),
        algorithms: ['RS256'],
      };
    } else if (secret && secret.length >= 32 && nodeEnv !== 'production') {
      // Fall back to HS256 for development
      strategyOptions = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        issuer,
        audience,
        secretOrKey: secret,
        algorithms: ['HS256'],
      };
    } else {
      throw new Error(
        'JWT configuration error: JWT_PUBLIC_KEY (RS256) is required in production. ' +
          'For non-production, provide JWT_SECRET (min 32 chars) for HS256.'
      );
    }

    super(strategyOptions);
  }

  /**
   * Validate JWT payload and return user
   *
   * This method is called after passport-jwt verifies:
   * - Token signature (RS256 or HS256)
   * - Token expiration (exp claim)
   * - Issuer (iss claim)
   * - Audience (aud claim)
   * - Not before (nbf claim)
   */
  async validate(payload: JwtPayload) {
    // Validate required claims
    if (!payload.sub) {
      this.logger.warn('JWT validation failed: missing sub claim');
      throw new UnauthorizedException('توکن نامعتبر است');
    }

    if (!payload.email) {
      this.logger.warn('JWT validation failed: missing email claim');
      throw new UnauthorizedException('توکن نامعتبر است');
    }

    if (!payload.role) {
      this.logger.warn('JWT validation failed: missing role claim');
      throw new UnauthorizedException('توکن نامعتبر است');
    }

    // Validate not-before claim if present
    if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) {
      this.logger.warn(`JWT validation failed: token not yet valid (nbf: ${payload.nbf})`);
      throw new UnauthorizedException('توکن هنوز معتبر نيست');
    }

    // Fetch user from database
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      this.logger.warn(`JWT validation failed: user not found (sub: ${payload.sub})`);
      throw new UnauthorizedException('کاربر يافت نشد');
    }

    if (!user.isActive) {
      this.logger.warn(`JWT validation failed: user inactive (sub: ${payload.sub})`);
      throw new UnauthorizedException('حساب کاربري غيرفعال است');
    }

    if (user.isBanned) {
      this.logger.warn(`JWT validation failed: user banned (sub: ${payload.sub})`);
      throw new UnauthorizedException('حساب کاربري مسدود شده است');
    }

    // Return user with additional JWT claims for downstream use
    return {
      ...user,
      jti: payload.jti,
      tenantId: payload.tenantId,
    };
  }
}

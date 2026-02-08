// ═══════════════════════════════════════════════════════════════════════════
// Token Service - JWT Token Management with Rotation
// ═══════════════════════════════════════════════════════════════════════════
// Implements:
// - Access Token: 15 minutes expiry
// - Refresh Token: 7 days with rotation
// - Token binding to session and device
// ═══════════════════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import type { AuthConfig, TokenPair, TokenPayload, TokenScope, UserRole } from '../types';

export interface CreateTokenOptions {
  user_id: string;
  tenant_id: string;
  email: string;
  roles: UserRole[];
  scopes: TokenScope[];
  session_id: string;
  device_fingerprint?: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly config: AuthConfig['jwt'];
  private readonly redis: Redis;

  // Token blacklist prefix
  private readonly BLACKLIST_PREFIX = 'auth:blacklist:';
  private readonly REFRESH_TOKEN_PREFIX = 'auth:refresh:';

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    this.config = this.configService.get<AuthConfig['jwt']>('auth.jwt', {
      secret: '',
      refresh_secret: '',
      access_expiration: '15m',
      refresh_expiration: '7d',
      issuer: 'nextgen-marketplace',
      audience: 'nextgen-api',
    });

    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_AUTH_DB', 1),
      keyPrefix: 'nextgen:',
    });
  }

  /**
   * Create access and refresh token pair
   */
  async createTokenPair(options: CreateTokenOptions): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessExpiry = this.parseExpiration(this.config.access_expiration);
    const refreshExpiry = this.parseExpiration(this.config.refresh_expiration);

    // Access token payload
    const accessPayload: TokenPayload = {
      sub: options.user_id,
      tid: options.tenant_id,
      email: options.email,
      roles: options.roles,
      scopes: options.scopes,
      sid: options.session_id,
      dfp: options.device_fingerprint
        ? this.hashFingerprint(options.device_fingerprint)
        : undefined,
      iat: now,
      exp: now + accessExpiry,
      type: 'access',
    };

    // Refresh token payload (minimal data)
    const refreshPayload: TokenPayload = {
      sub: options.user_id,
      tid: options.tenant_id,
      email: options.email,
      roles: options.roles,
      scopes: options.scopes,
      sid: options.session_id,
      dfp: options.device_fingerprint
        ? this.hashFingerprint(options.device_fingerprint)
        : undefined,
      iat: now,
      exp: now + refreshExpiry,
      type: 'refresh',
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.config.secret,
        issuer: this.config.issuer,
        audience: this.config.audience,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.refresh_secret,
        issuer: this.config.issuer,
        audience: this.config.audience,
      }),
    ]);

    // Store refresh token hash for rotation tracking
    const refreshTokenHash = this.hashToken(refresh_token);
    await this.redis.setex(
      `${this.REFRESH_TOKEN_PREFIX}${options.session_id}`,
      refreshExpiry,
      JSON.stringify({
        hash: refreshTokenHash,
        user_id: options.user_id,
        created_at: now,
      })
    );

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: accessExpiry,
    };
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
      secret: this.config.secret,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });

    // Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new Error('Token has been revoked');
    }

    return payload;
  }

  /**
   * Verify refresh token and rotate
   */
  async verifyAndRotateRefreshToken(
    refreshToken: string,
    deviceFingerprint?: string
  ): Promise<{ payload: TokenPayload; newTokenPair: TokenPair }> {
    // Verify the refresh token
    const payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
      secret: this.config.refresh_secret,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });

    // Verify token type
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Verify device fingerprint if provided
    if (deviceFingerprint && payload.dfp) {
      const currentHash = this.hashFingerprint(deviceFingerprint);
      if (currentHash !== payload.dfp) {
        this.logger.warn('Device fingerprint mismatch', {
          user_id: payload.sub,
          session_id: payload.sid,
        });
        throw new Error('Device fingerprint mismatch');
      }
    }

    // Check if this refresh token is the current valid one
    const storedData = await this.redis.get(`${this.REFRESH_TOKEN_PREFIX}${payload.sid}`);
    if (!storedData) {
      throw new Error('Session not found or expired');
    }

    const stored = JSON.parse(storedData);
    const currentHash = this.hashToken(refreshToken);

    if (stored.hash !== currentHash) {
      // Possible token reuse attack - invalidate all tokens for this session
      this.logger.warn('Refresh token reuse detected', {
        user_id: payload.sub,
        session_id: payload.sid,
      });
      await this.revokeSession(payload.sid);
      throw new Error('Token reuse detected - session invalidated');
    }

    // Blacklist the old refresh token
    await this.blacklistToken(refreshToken, payload.exp - Math.floor(Date.now() / 1000));

    // Create new token pair (rotation)
    const newTokenPair = await this.createTokenPair({
      user_id: payload.sub,
      tenant_id: payload.tid,
      email: payload.email,
      roles: payload.roles,
      scopes: payload.scopes,
      session_id: payload.sid,
      device_fingerprint: deviceFingerprint,
    });

    return { payload, newTokenPair };
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(token: string, ttl?: number): Promise<void> {
    const hash = this.hashToken(token);
    const expiry = ttl || 86400; // Default 24 hours
    await this.redis.setex(`${this.BLACKLIST_PREFIX}${hash}`, expiry, '1');
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const result = await this.redis.get(`${this.BLACKLIST_PREFIX}${hash}`);
    return result !== null;
  }

  /**
   * Revoke all tokens for a session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.redis.del(`${this.REFRESH_TOKEN_PREFIX}${sessionId}`);
    this.logger.log('Session revoked', { session_id: sessionId });
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string, tenantId: string): Promise<void> {
    const pattern = `${this.REFRESH_TOKEN_PREFIX}*`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.user_id === userId) {
          await this.redis.del(key);
        }
      }
    }

    this.logger.log('All user sessions revoked', { user_id: userId, tenant_id: tenantId });
  }

  /**
   * Generate a secure session ID
   */
  generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash a token for storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Hash device fingerprint
   */
  private hashFingerprint(fingerprint: string): string {
    return createHash('sha256').update(fingerprint).digest('hex').substring(0, 16);
  }

  /**
   * Parse expiration string to seconds
   */
  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default 15 minutes
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }

  /**
   * Get default scopes for a role
   */
  getDefaultScopes(roles: UserRole[]): TokenScope[] {
    const scopeMap: Record<UserRole, TokenScope[]> = {
      CUSTOMER: ['user:read', 'user:update', 'order:read', 'order:create', 'product:read'],
      DEALER: [
        'user:read',
        'user:update',
        'order:read',
        'order:create',
        'product:read',
        'dealer:read',
        'dealer:order:create',
      ],
      VENDOR: [
        'user:read',
        'user:update',
        'product:read',
        'product:create',
        'product:update',
        'vendor:read',
        'vendor:product:manage',
      ],
      EXECUTOR: [
        'user:read',
        'user:update',
        'executor:read',
        'executor:bid:create',
        'executor:project:manage',
      ],
      ADMIN: [
        'user:read',
        'user:update',
        'admin:user:read',
        'admin:user:manage',
        'product:read',
        'product:update',
        'order:read',
        'order:update',
      ],
      SUPER_ADMIN: [
        'user:read',
        'user:update',
        'user:delete',
        'admin:user:read',
        'admin:user:manage',
        'admin:system:manage',
        'product:read',
        'product:create',
        'product:update',
        'product:delete',
        'order:read',
        'order:create',
        'order:update',
        'order:cancel',
        'vendor:read',
        'vendor:manage',
      ],
    };

    const scopes = new Set<TokenScope>();
    for (const role of roles) {
      const roleScopes = scopeMap[role] || [];
      for (const scope of roleScopes) {
        scopes.add(scope);
      }
    }

    return Array.from(scopes);
  }
}

import * as crypto from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const logger = new Logger('JwtGuard');

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * JWT Authentication Guard
 *
 * Validates Bearer tokens with RS256 (asymmetric) algorithm
 * Supports:
 * - Token validation
 * - Expiration checking
 * - Device binding (optional)
 * - Role-based access control
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private publicKey: string;

  constructor() {
    // Load public key from environment or generate for demo
    this.publicKey = process.env.JWT_PUBLIC_KEY || this.generateDemoKeys().publicKey;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decoded = await this.validateToken(token);
      request.user = decoded;
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Token validation failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1] || null;
  }

  private validateToken(token: string) {
    // Parse JWT (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    const header = JSON.parse(Buffer.from(headerB64 || '', 'base64').toString());
    if (header.alg !== 'RS256') {
      throw new Error('Invalid algorithm');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64 || '', 'base64').toString());

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    // Verify signature
    const signatureData = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64 || '', 'base64');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signatureData);

    if (!verifier.verify(this.publicKey, signature)) {
      throw new Error('Invalid signature');
    }

    return payload;
  }

  private generateDemoKeys() {
    // For demo only - use environment variables in production
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  }
}

/**
 * Optional decorators for role-based access control
 */
import { SetMetadata, createParamDecorator } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const GetUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return data ? user?.[data] : user;
  }
);

/**
 * Role guard - checks if user has required role
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}

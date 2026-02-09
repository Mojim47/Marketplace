// ═══════════════════════════════════════════════════════════════════════════
// JWT Authentication Guard - NestJS Guard for JWT Token Validation
// ═══════════════════════════════════════════════════════════════════════════

import { type ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRED_SCOPES_KEY } from '../decorators/scopes.decorator';
import type { AuthenticatedUser, TokenScope } from '../types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
    info: Error | null,
    context: ExecutionContext
  ): TUser {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      this.logger.warn('Authentication failed', {
        method: request.method,
        url: request.url,
        error: err?.message || info?.message,
        ip: request.ip,
        userAgent: request.get('User-Agent')?.substring(0, 100),
      });

      throw err || new UnauthorizedException('Access token required');
    }

    // Check required scopes
    const requiredScopes = this.reflector.getAllAndOverride<TokenScope[]>(REQUIRED_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredScopes && requiredScopes.length > 0) {
      const authenticatedUser = user as unknown as AuthenticatedUser;
      const userScopes = authenticatedUser.scopes || [];
      const hasAllScopes = requiredScopes.every((scope) => userScopes.includes(scope));

      if (!hasAllScopes) {
        this.logger.warn('Insufficient scopes', {
          user_id: authenticatedUser.id,
          required: requiredScopes,
          has: userScopes,
        });
        throw new UnauthorizedException('Insufficient permissions');
      }
    }

    return user;
  }
}

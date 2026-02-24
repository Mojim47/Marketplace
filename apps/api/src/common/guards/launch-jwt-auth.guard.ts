import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

type LaunchJwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  tenantId?: string;
};

@Injectable()
export class LaunchJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string | undefined = request.headers?.authorization;
    const token = typeof authorization === 'string' ? this.extractBearerToken(authorization) : null;

    if (!token) {
      throw new UnauthorizedException('missing_bearer_token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<LaunchJwtPayload>(token);
      if (!payload?.sub) {
        throw new UnauthorizedException('jwt_missing_subject');
      }

      request.user = {
        id: payload.sub,
        email: payload.email ?? '',
        role: payload.role ?? 'CUSTOMER',
        tenantId: payload.tenantId ?? null,
      };
      return true;
    } catch {
      throw new UnauthorizedException('invalid_or_expired_token');
    }
  }

  private extractBearerToken(authorization: string): string | null {
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }
    return token;
  }
}

import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest(err: unknown, user: AuthenticatedUser | undefined) {
    if (err || !user) {
      throw (
        (err instanceof Error ? err : null) || new UnauthorizedException('لطفاً وارد سيستم شويد')
      );
    }
    return user;
  }
}

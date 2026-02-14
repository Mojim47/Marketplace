import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  override handleRequest(err: any, user: AuthenticatedUser, _info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('لطفاً وارد سيستم شويد');
    }
    return user;
  }
}

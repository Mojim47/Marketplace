import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context)
  }

  override handleRequest(err: any, user: AuthenticatedUser, _info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('لطفاً وارد سيستم شويد')
    }
    return user
  }
}


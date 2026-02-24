// ═══════════════════════════════════════════════════════════════════════════
// Current User Decorator - Extract Current User from Request
// ═══════════════════════════════════════════════════════════════════════════

import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthenticatedUser } from '../types';

/**
 * Extract the authenticated user from the request
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  }
);

/**
 * Extract the tenant ID from the authenticated user
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenant_id || null;
  }
);

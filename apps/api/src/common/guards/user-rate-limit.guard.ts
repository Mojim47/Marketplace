import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { sub?: string; id?: string; userId?: string };
}

@Injectable()
export class UserRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: AuthenticatedRequest): Promise<string> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (userId) {
      return `user:${userId}`;
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return `ip:${forwardedFor.split(',')[0].trim()}`;
    }
    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return `ip:${forwardedFor[0].trim()}`;
    }

    return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  }
}

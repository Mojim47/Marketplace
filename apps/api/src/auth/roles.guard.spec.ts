import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard';

const createContext = (user?: { role?: string }) => {
  const request = {
    user,
    path: '/admin',
    method: 'GET',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'vitest' },
  };

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
};

describe('RolesGuard', () => {
  it('allows ADMIN user to access ADMIN endpoint', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const { context } = createContext({ role: 'ADMIN' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException for USER accessing ADMIN endpoint', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const { context } = createContext({ role: 'USER' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access when no roles are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const { context } = createContext({ role: 'USER' });

    expect(guard.canActivate(context)).toBe(true);
  });
});

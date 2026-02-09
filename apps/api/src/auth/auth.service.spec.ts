import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

const createService = () => {
  const prisma = {
    admin: { findFirst: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  } as any;

  const jwtService = {
    sign: vi.fn(),
  } as any;

  const configService = {
    get: vi.fn(),
  } as any;

  const lockoutService = {
    recordLoginAttempt: vi.fn().mockResolvedValue({
      allowed: true,
      remainingAttempts: 5,
      message: 'ok',
    }),
    clearFailedAttempts: vi.fn(),
  } as any;

  const totpService = {
    verify: vi.fn().mockReturnValue({ valid: true }),
  } as any;

  const service = new AuthService(
    prisma,
    jwtService,
    configService,
    lockoutService,
    totpService,
  );

  return { service, prisma, jwtService, lockoutService };
};

describe('AuthService.signIn', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns access token on successful login', async () => {
    const { service, prisma, jwtService } = createService();

    const user = {
      id: 'user_1',
      email: 'user@nextgen.ir',
      passwordHash: 'argon2_hash',
      role: 'USER',
      mobile: '+989100000000',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      isBanned: false,
      bannedReason: null,
    };

    prisma.admin.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    vi.spyOn(service, 'verifyPassword').mockResolvedValue(true);
    vi.spyOn(service, 'needsRehash').mockResolvedValue(false);

    jwtService.sign.mockReturnValue('mock_access_token');

    const result = await service.signIn({
      email: user.email,
      password: 'correct-password',
      ipAddress: '127.0.0.1',
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.id,
        email: user.email,
        role: user.role,
        jti: expect.any(String),
        nbf: expect.any(Number),
      }),
    );

    expect(result).toEqual({
      access_token: 'mock_access_token',
      user: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  });
});

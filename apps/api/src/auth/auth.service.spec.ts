import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('argon2', () => ({
  argon2id: 2,
  default: {
    argon2id: 2,
    hash: vi.fn(async (value: string) => `$argon2id$mock$${value}`),
    verify: vi.fn(async (hashed: string, plain: string) => hashed === `$argon2id$mock$${plain}`),
    needsRehash: vi.fn(async () => false),
  },
  hash: vi.fn(async (value: string) => `$argon2id$mock$${value}`),
  verify: vi.fn(async (hashed: string, plain: string) => hashed === `$argon2id$mock$${plain}`),
  needsRehash: vi.fn(async () => false),
}));
import { AuthService } from './auth.service';

const createService = () => {
  const prisma = {
    admin: { findFirst: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    loginAttempt: { create: vi.fn() },
  } as any;

  const jwtService = {
    sign: vi.fn(),
    verify: vi.fn(),
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
    setupMFA: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
  } as any;

  const service = new AuthService(prisma, jwtService, configService, lockoutService, totpService);

  return { service, prisma, jwtService, lockoutService, totpService };
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
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        access_token: 'mock_access_token',
        refresh_token: undefined,
        expires_at: expect.any(Number),
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
    );
  });

  it('hashes and verifies passwords with argon2id', async () => {
    const { service } = createService();

    const hash = await service.hashPassword('StrongPassword!123');
    expect(hash).toMatch(/^\$argon2id\$/);

    await expect(service.verifyPassword('StrongPassword!123', hash)).resolves.toBe(true);
    await expect(service.verifyPassword('WrongPassword', hash)).resolves.toBe(false);
  });

  it('returns invalid token result when jwt verify throws', async () => {
    const { service, jwtService } = createService();

    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(service.verifyToken('bad-token')).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        error: expect.stringContaining('invalid token'),
      })
    );
  });

  it('registers with mobile-only flow and synthetic email', async () => {
    const { service, prisma, jwtService } = createService();

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user_new',
      email: '09120000000@mobile.nextgen.local',
      mobile: '09120000000',
      role: 'USER',
      firstName: 'Ali',
      lastName: 'Test',
    });
    jwtService.sign.mockReturnValue('token-register');

    const result = await service.register({
      mobile: '09120000000',
      password: 'StrongPassword!123',
      firstName: 'Ali',
      lastName: 'Test',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: '09120000000@mobile.nextgen.local',
          mobile: '09120000000',
          isActive: true,
        }),
      })
    );

    expect(result.access_token).toBe('token-register');
    expect(result.user.mobile).toBe('09120000000');
  });

  it('enables 2FA and persists secret + backup hashes', async () => {
    const { service, prisma, totpService } = createService();

    prisma.user.findUnique.mockResolvedValue({
      id: 'u-2fa',
      email: 'u2fa@nextgen.ir',
      isTwoFactorEnabled: false,
    });
    totpService.setupMFA.mockResolvedValue({
      totp: {
        secret: 'totp-secret',
        base32: 'BASE32SECRET',
        otpauthUrl: 'otpauth://totp/nextgen:u2fa',
      },
      hashedBackupCodes: ['hash-1', 'hash-2'],
      backupCodes: ['plain-1', 'plain-2'],
    });

    const result = await service.enable2FA('u-2fa');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-2fa' },
        data: expect.objectContaining({
          twoFactorSecret: 'totp-secret',
          twoFactorBackupCodes: ['hash-1', 'hash-2'],
        }),
      })
    );
    expect(result).toEqual({
      secret: 'BASE32SECRET',
      otpauthUrl: 'otpauth://totp/nextgen:u2fa',
      backupCodes: ['plain-1', 'plain-2'],
    });
  });

  it('verifies 2FA setup and marks account as enabled', async () => {
    const { service, prisma, totpService } = createService();

    prisma.user.findUnique.mockResolvedValue({
      id: 'u-verify',
      twoFactorSecret: 'totp-secret',
      isTwoFactorEnabled: false,
    });
    totpService.verify.mockReturnValue({ valid: true });

    await expect(service.verify2FASetup('u-verify', '123456')).resolves.toEqual({ success: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-verify' },
      data: { isTwoFactorEnabled: true },
    });
  });

  it('disables 2FA and clears secrets after password verification', async () => {
    const { service, prisma, totpService } = createService();

    prisma.user.findUnique.mockResolvedValue({
      id: 'u-disable',
      passwordHash: 'argon2-hash',
      isTwoFactorEnabled: true,
      twoFactorSecret: 'totp-secret',
    });
    vi.spyOn(service, 'verifyPassword').mockResolvedValue(true);
    totpService.verify.mockReturnValue({ valid: true });

    await expect(service.disable2FA('u-disable', 'StrongPassword!123', '123456')).resolves.toEqual({
      success: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-disable' },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });
  });

  it('consumes backup code and persists remaining hashed codes', async () => {
    const { service, prisma, totpService } = createService();

    prisma.user.findUnique.mockResolvedValue({
      id: 'u-backup',
      isTwoFactorEnabled: true,
      twoFactorBackupCodes: ['hash-1', 'hash-2', 'hash-3'],
    });
    totpService.verifyBackupCode.mockReturnValue({ valid: true, index: 1 });

    await expect(service.verifyBackupCode('u-backup', 'backup-plain')).resolves.toEqual({
      valid: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-backup' },
      data: { twoFactorBackupCodes: ['hash-1', 'hash-3'] },
    });
  });
});

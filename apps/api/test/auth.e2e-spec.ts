import { execSync } from 'node:child_process';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nextgen/waf', () => ({
  WAFService: class WAFService {},
}));

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let container: PostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('nextgen_test')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    const databaseUrl = `${container.getConnectionUri()}?schema=public`;
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'test_jwt_secret__very_long_and_secure__64chars_minimum__v1';
    process.env.JWT_ISSUER = 'nextgen-test';
    process.env.JWT_AUDIENCE = 'nextgen-test-api';

    execSync('corepack pnpm prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PNPM_STORE_DIR: 'C:\\Users\\moji\\AppData\\Local\\pnpm\\store\\v3',
      },
    });

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "user_role_assignments" CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "tenants" CASCADE');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await container.stop();
  });

  it('registers a user and prevents duplicate email', async () => {
    const payload = {
      email: 'user@nextgen.ir',
      password: 'StrongPassw0rd!1234567890',
      mobile: '+989100000000',
      firstName: 'Test',
      lastName: 'User',
    };

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload);

    expect(registerResponse.status).toBe(201);

    const createdUser = await prisma.user.findFirst({
      where: { email: payload.email },
    });
    expect(createdUser).not.toBeNull();

    const duplicateResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload);

    expect(duplicateResponse.status).toBe(409);
  });

  it('logs in with valid credentials and rejects invalid password', async () => {
    const payload = {
      email: 'login@nextgen.ir',
      password: 'StrongPassw0rd!1234567890',
      mobile: '+989100000001',
      firstName: 'Login',
      lastName: 'User',
    };

    await request(app.getHttpServer()).post('/auth/register').send(payload);

    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('access_token');

    const invalidLoginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: payload.email,
      password: 'wrong-password',
    });

    expect(invalidLoginResponse.status).toBe(401);
  });
});

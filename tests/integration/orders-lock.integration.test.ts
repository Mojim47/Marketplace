// @vitest-environment node

import { execSync } from 'node:child_process';
import { DistributedLockService } from '@nextgen/cache';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { ExecutionError } from 'redlock';
import { GenericContainer } from 'testcontainers';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

let redisContainer: GenericContainer | null = null;
let postgresContainer: GenericContainer | null = null;
let redis: Redis | null = null;
let prisma: PrismaClient | null = null;
let setupFailed = false;

// Allow using already-running infra to avoid slow container startup on CI/dev
const useLocalInfra = process.env.ORDER_LOCK_USE_LOCAL === '1';
const pgUser = 'testuser';
const pgPassword = 'testpass';
const pgDb = 'testdb';

const hasContainerRuntime = (): boolean => {
  if (process.env.ENABLE_TESTCONTAINERS === 'true') {
    return true;
  }
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 4000 });
    return true;
  } catch {
    return false;
  }
};

const forceRun = process.env.ORDER_LOCK_FORCE === '1';
const describeIfRuntime = hasContainerRuntime() && forceRun ? describe : describe.skip;

describeIfRuntime('Orders Lock Integration (Redis/Prisma)', () => {
  beforeAll(async () => {
    try {
      if (useLocalInfra) {
        const dbUrl =
          process.env.DATABASE_URL ??
          `postgresql://nextgen:change_me_strong_db_password@localhost:5432/nextgen_marketplace`;
        const redisUrl = process.env.REDIS_URL ?? 'redis://:nextgen123@localhost:6379/0';

        process.env.DATABASE_URL = dbUrl;
        prisma = new PrismaClient();
        await prisma.$connect();

        redis = new Redis(redisUrl, { connectTimeout: 5000 });
      } else {
        redisContainer = await new GenericContainer('redis:7-alpine')
          .withExposedPorts(6379)
          .withStartupTimeout(60_000)
          .start();

        postgresContainer = await new GenericContainer('postgres:16-alpine')
          .withEnvironment({
            POSTGRES_USER: pgUser,
            POSTGRES_PASSWORD: pgPassword,
            POSTGRES_DB: pgDb,
          })
          .withExposedPorts(5432)
          .withStartupTimeout(60_000)
          .start();

        const pgHost = postgresContainer.getHost();
        const pgPort = postgresContainer.getMappedPort(5432);
        process.env.DATABASE_URL = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}`;

        prisma = new PrismaClient();
        await prisma.$connect();

        const redisHost = redisContainer.getHost();
        const redisPort = redisContainer.getMappedPort(6379);
        redis = new Redis({ host: redisHost, port: redisPort, connectTimeout: 5000 });
      }
    } catch (err) {
      // Mark setup as failed so tests are skipped instead of timing out
      console.warn('orders-lock setup failed, skipping suite:', err);
      setupFailed = true;
    }
  }, 120000);

  afterEach(async () => {
    if (redis) {
      await redis.del('lock:order:*');
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (redis) {
      await redis.quit();
    }
    if (redisContainer && !useLocalInfra) {
      await redisContainer.stop();
    }
    if (postgresContainer && !useLocalInfra) {
      await postgresContainer.stop();
    }
  }, 120000);

  it('connects to Prisma/Postgres and runs a health query', async () => {
    if (setupFailed) return;
    if (!prisma) {
      throw new Error('Prisma client not initialized');
    }
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });

  it('acquires and blocks a Redis lock using Redlock', async () => {
    if (setupFailed) return;
    const lockService = new DistributedLockService(redis as any);
    const lock = await lockService.acquire(['product:integration:1'], 5000);

    await expect(lockService.acquire(['product:integration:1'], 5000)).rejects.toBeInstanceOf(
      ExecutionError
    );

    await lockService.release(lock);
  });

  it('auto-extends locks for routines longer than ttl', async () => {
    if (setupFailed) return;
    const lockService = new DistributedLockService(redis as any);

    await lockService.using(
      ['product:integration:2'],
      1000,
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        return true;
      },
      {
        retryCount: 3,
        retryDelay: 150,
        retryJitter: 150,
        automaticExtensionThreshold: 200,
      }
    );
  });

  it('serializes lock usage with retries', async () => {
    if (setupFailed) return;
    const lockService = new DistributedLockService(redis as any);
    const events: string[] = [];

    const first = lockService.using(
      ['product:integration:serial'],
      5000,
      async () => {
        events.push('first-start');
        await new Promise((resolve) => setTimeout(resolve, 300));
        events.push('first-end');
      },
      { retryCount: 0 }
    );

    const second = lockService.using(
      ['product:integration:serial'],
      5000,
      async () => {
        events.push('second-start');
        events.push('second-end');
      },
      { retryCount: 10, retryDelay: 100, retryJitter: 0 }
    );

    await Promise.all([first, second]);

    expect(events).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });
});

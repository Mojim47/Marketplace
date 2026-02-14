/**
 * ???????????????????????????????????????????????????????????????????????????
 * TESTCONTAINERS SETUP - ISOLATED DOCKER ENVIRONMENT
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: Sandboxed PostgreSQL + Redis for Integration Tests
 * Zero Op Risk: Tests run in isolated containers, no impact on production/dev DBs
 * ???????????????????????????????????????????????????????????????????????????
 */

import { execSync } from 'node:child_process';
import type { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Redis } from 'ioredis';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

let postgresContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;
let prisma: PrismaClient;
let redis: Redis;

export async function setupTestEnvironment() {
  postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  const databaseUrl = postgresContainer.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;
  redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();

  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);
  const rootDir = process.cwd().replace(/apps[\\/]api.*$/, '');
  execSync('npx prisma generate', {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  execSync('npx prisma db push --accept-data-loss', {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  // Import PrismaClient dynamically after generation
  const { PrismaClient: GeneratedPrismaClient } = await import('@prisma/client');

  // Initialize Prisma Client
  prisma = new GeneratedPrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  await prisma.$connect();

  // Initialize Redis client
  redis = new Redis({
    host: redisHost,
    port: redisPort,
  });

  // Set Redis environment variables for PriceEngine
  process.env.REDIS_HOST = redisHost;
  process.env.REDIS_PORT = redisPort.toString();

  return {
    prisma,
    redis,
    databaseUrl,
    redisHost,
    redisPort,
  };
}

export async function teardownTestEnvironment() {
  if (redis) {
    await redis.quit();
  }

  if (prisma) {
    await prisma.$disconnect();
  }

  if (redisContainer) {
    await redisContainer.stop();
  }

  if (postgresContainer) {
    await postgresContainer.stop();
  }
}

export function getTestPrisma() {
  return prisma;
}

export function getTestRedis() {
  return redis;
}

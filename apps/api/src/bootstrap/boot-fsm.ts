import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

export enum BootState {
  INIT = 'INIT',
  CONFIG_VALIDATED = 'CONFIG_VALIDATED',
  DB_CONNECTED = 'DB_CONNECTED',
  REDIS_READY = 'REDIS_READY',
  MIGRATION_CHECKED = 'MIGRATION_CHECKED',
  QUEUE_SYNCED = 'QUEUE_SYNCED',
  READY = 'READY',
}

type BootStep = {
  state: BootState;
  code: string;
  run: () => Promise<void>;
  maxAttempts: number;
  timeoutMs: number;
  retryDelayMs: number;
};

type BootLogPayload = {
  traceId: string;
  prevState: BootState;
  nextState: BootState;
  success: boolean;
  code: string;
  reason?: string;
  attempt: number;
};

class BootFailure extends Error {
  constructor(
    readonly code: string,
    readonly state: BootState,
    readonly reason: string
  ) {
    super(`${code}:${reason}`);
  }
}

function emitBootLog(payload: BootLogPayload): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: payload.success ? 'info' : 'error',
      type: 'boot_transition',
      traceId: payload.traceId,
      prevState: payload.prevState,
      nextState: payload.nextState,
      success: payload.success,
      code: payload.code,
      reason: payload.reason,
      attempt: payload.attempt,
    })
  );
}

async function withTimeout<T>(work: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      work(),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('timeout_exceeded')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function runStepWithBudget(
  traceId: string,
  prevState: BootState,
  step: BootStep
): Promise<void> {
  for (let attempt = 1; attempt <= step.maxAttempts; attempt++) {
    try {
      await withTimeout(step.run, step.timeoutMs);
      emitBootLog({
        traceId,
        prevState,
        nextState: step.state,
        success: true,
        code: step.code,
        attempt,
      });
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_boot_error';
      emitBootLog({
        traceId,
        prevState,
        nextState: step.state,
        success: false,
        code: step.code,
        reason,
        attempt,
      });

      if (attempt === step.maxAttempts) {
        throw new BootFailure(step.code, step.state, reason);
      }

      await new Promise((resolve) => setTimeout(resolve, step.retryDelayMs));
    }
  }
}

function assertRequiredConfig(): void {
  const required = ['DATABASE_URL', 'REDIS_URL'];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key]?.trim().length === 0
  );
  const hasJwtSecret = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
  const hasRsaKeys = Boolean(process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY);

  if (!hasJwtSecret && !hasRsaKeys) {
    missing.push('JWT_SECRET_OR_RSA_KEYS');
  }

  if (missing.length > 0) {
    throw new Error(`missing_required_config:${missing.join(',')}`);
  }
}

async function assertMigrations(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ pending: bigint | number }>>(
    'SELECT COUNT(*)::bigint AS pending FROM "_prisma_migrations" WHERE finished_at IS NULL'
  );
  const pending = Number(rows[0]?.pending ?? 0);
  if (pending > 0) {
    throw new Error(`migration_pending:${pending}`);
  }
}

async function assertQueueLag(redis: Redis): Promise<void> {
  const queueKey = process.env.QUEUE_WAIT_KEY || 'bull:email:wait';
  const threshold = Number.parseInt(process.env.QUEUE_LAG_THRESHOLD || '1000', 10);
  const lag = await redis.llen(queueKey);
  if (lag > threshold) {
    throw new Error(`queue_lag_exceeded:${lag}/${threshold}`);
  }
}

export async function runDeterministicStartupBarrier(app: INestApplication): Promise<void> {
  const traceId = `boot-${randomUUID()}`;
  const prisma = app.get<PrismaService>(PrismaService);
  const redis = app.get<Redis>('REDIS_CLIENT');

  let current = BootState.INIT;
  emitBootLog({
    traceId,
    prevState: BootState.INIT,
    nextState: BootState.INIT,
    success: true,
    code: 'BOOT_INIT',
    attempt: 1,
  });

  const steps: BootStep[] = [
    {
      state: BootState.CONFIG_VALIDATED,
      code: 'BOOT_CONFIG_VALIDATION_FAILED',
      run: async () => assertRequiredConfig(),
      maxAttempts: 1,
      timeoutMs: 1000,
      retryDelayMs: 0,
    },
    {
      state: BootState.DB_CONNECTED,
      code: 'BOOT_DB_CONNECT_FAILED',
      run: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
      maxAttempts: 3,
      timeoutMs: 10000,
      retryDelayMs: 500,
    },
    {
      state: BootState.REDIS_READY,
      code: 'BOOT_REDIS_READY_FAILED',
      run: async () => {
        await redis.ping();
      },
      maxAttempts: 3,
      timeoutMs: 1500,
      retryDelayMs: 300,
    },
    {
      state: BootState.MIGRATION_CHECKED,
      code: 'BOOT_MIGRATION_CHECK_FAILED',
      run: async () => assertMigrations(prisma),
      maxAttempts: 1,
      timeoutMs: 2000,
      retryDelayMs: 0,
    },
    {
      state: BootState.QUEUE_SYNCED,
      code: 'BOOT_QUEUE_SYNC_FAILED',
      run: async () => assertQueueLag(redis),
      maxAttempts: 2,
      timeoutMs: 1500,
      retryDelayMs: 300,
    },
  ];

  for (const step of steps) {
    await runStepWithBudget(traceId, current, step);
    current = step.state;
  }

  emitBootLog({
    traceId,
    prevState: current,
    nextState: BootState.READY,
    success: true,
    code: 'BOOT_READY',
    attempt: 1,
  });
}

export function asBootFailure(error: unknown): BootFailure {
  if (error instanceof BootFailure) {
    return error;
  }
  const reason = error instanceof Error ? error.message : 'unknown_boot_failure';
  return new BootFailure('BOOT_UNKNOWN_FAILURE', BootState.INIT, reason);
}

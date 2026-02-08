import { Inject, Injectable, Logger } from '@nestjs/common';
import Redlock, { Lock, ResourceLockedError, ExecutionError, Settings, RedlockAbortSignal } from 'redlock';
import type Redis from 'ioredis';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redlock: Redlock;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.redlock = new Redlock([this.redis], {
      retryCount: 3,
      retryDelay: 150,
      retryJitter: 150,
    });

    this.redlock.on('error', (error) => {
      this.logger.warn(`Redlock error: ${(error as Error).message}`);
    });
  }

  async acquire(resources: string[], ttlMs: number): Promise<Lock> {
    return this.redlock.acquire(resources, ttlMs);
  }

  async release(lock: Lock): Promise<void> {
    await this.redlock.release(lock);
  }

  async using<T>(
    resources: string[],
    ttlMs: number,
    routine: (signal: RedlockAbortSignal) => Promise<T>,
    settings?: Partial<Settings>
  ): Promise<T> {
    return this.redlock.using(resources, ttlMs, settings ?? {}, routine);
  }

  isLockConflict(error: unknown): boolean {
    return error instanceof ResourceLockedError;
  }

  isLockInfrastructureError(error: unknown): boolean {
    return error instanceof ExecutionError;
  }
}

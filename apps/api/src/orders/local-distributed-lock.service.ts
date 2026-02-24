import { Inject, Injectable } from '@nestjs/common';

interface IStateService {
  acquireLock(
    key: string,
    options?: { ttlMs?: number; retryAttempts?: number }
  ): Promise<{ key: string; token: string } | null>;
  releaseLock(lock: { key: string; token: string }): Promise<boolean>;
}

type LockSettings = {
  retryCount: number;
  retryDelay: number;
  retryJitter: number;
  automaticExtensionThreshold: number;
};

@Injectable()
export class LocalDistributedLockService {
  constructor(@Inject('STATE_SERVICE') private readonly stateService: IStateService) {}

  async using<T>(
    resources: string[],
    ttlMs: number,
    callback: (signal: { aborted: boolean }) => Promise<T>,
    _settings: LockSettings
  ): Promise<T> {
    const acquired: Array<{ key: string; token: string }> = [];
    try {
      for (const resource of resources) {
        const lock = await this.stateService.acquireLock(resource, {
          ttlMs,
          retryAttempts: 3,
        });
        if (!lock) {
          const err = new Error('lock_conflict');
          (err as any).code = 'LOCK_CONFLICT';
          throw err;
        }
        acquired.push(lock);
      }
      return await callback({ aborted: false });
    } finally {
      for (const lock of acquired.reverse()) {
        await this.stateService.releaseLock(lock);
      }
    }
  }

  isLockConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'LOCK_CONFLICT';
  }

  isLockInfrastructureError(_error: unknown): boolean {
    return false;
  }
}

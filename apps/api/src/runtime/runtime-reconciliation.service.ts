import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LoggingService } from '../_observability/logging.service';
import { DependencyGuardrailsService } from './dependency-guardrails.service';
import type Redis from 'ioredis';

export enum RuntimeState {
  INIT = 'INIT',
  CONFIG_VALIDATED = 'CONFIG_VALIDATED',
  DB_CONNECTED = 'DB_CONNECTED',
  REDIS_READY = 'REDIS_READY',
  MIGRATION_CHECKED = 'MIGRATION_CHECKED',
  QUEUE_SYNCED = 'QUEUE_SYNCED',
  PAYMENT_READY = 'PAYMENT_READY',
  READY = 'READY',
  DEGRADED = 'DEGRADED',
}

export type RuntimeDependencyStatus = {
  name: 'db' | 'redis' | 'migration' | 'queue' | 'payment';
  healthy: boolean;
  reason?: string;
  latencyMs: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastCheckedAt: string;
};

export type RuntimeSnapshot = {
  state: RuntimeState;
  ready: boolean;
  reason: string | null;
  updatedAt: string;
  traceId: string;
  dependencies: RuntimeDependencyStatus[];
};

type Step = {
  name: RuntimeDependencyStatus['name'];
  successState: RuntimeState;
  check: () => Promise<void>;
  policy: {
    timeoutMs: number;
    retryAttempts: number;
    failureThreshold: number;
    resetTimeoutMs: number;
    bulkheadMaxConcurrent: number;
  };
};

@Injectable()
export class RuntimeReconciliationService implements OnModuleInit, OnModuleDestroy {
  private state: RuntimeState = RuntimeState.INIT;
  private ready = false;
  private reason: string | null = null;
  private updatedAt = new Date().toISOString();
  private traceId = `runtime-${randomUUID()}`;
  private dependencies = new Map<RuntimeDependencyStatus['name'], RuntimeDependencyStatus>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logging: LoggingService,
    private readonly guardrails: DependencyGuardrailsService,
    // REDIS_CLIENT is provided globally by RedisModule
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis
  ) {}

  onModuleInit(): void {
    const intervalMs = Number.parseInt(process.env.RUNTIME_RECONCILE_INTERVAL_MS || '5000', 10);
    this.timer = setInterval(() => {
      void this.reconcileNow('periodic');
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async reconcileNow(trigger: 'periodic' | 'readiness_probe' | 'startup_probe'): Promise<RuntimeSnapshot> {
    const traceId = `reconcile-${randomUUID()}`;
    const previousState = this.state;
    const previousReady = this.ready;

    try {
      this.assertConfig();
      this.applyState(RuntimeState.CONFIG_VALIDATED, true, null, traceId, 'config_validated');

      const steps: Step[] = [
        {
          name: 'db',
          successState: RuntimeState.DB_CONNECTED,
          check: async () => {
            await this.prisma.$queryRaw`SELECT 1`;
          },
          policy: {
            timeoutMs: Number.parseInt(process.env.DB_TIMEOUT_MS || '1200', 10),
            retryAttempts: 1,
            failureThreshold: 3,
            resetTimeoutMs: 5000,
            bulkheadMaxConcurrent: Number.parseInt(process.env.DB_BULKHEAD_MAX || '32', 10),
          },
        },
        {
          name: 'redis',
          successState: RuntimeState.REDIS_READY,
          check: async () => {
            await this.redis.ping();
          },
          policy: {
            timeoutMs: Number.parseInt(process.env.REDIS_TIMEOUT_MS || '1000', 10),
            retryAttempts: 1,
            failureThreshold: 3,
            resetTimeoutMs: 5000,
            bulkheadMaxConcurrent: Number.parseInt(process.env.REDIS_BULKHEAD_MAX || '64', 10),
          },
        },
        {
          name: 'migration',
          successState: RuntimeState.MIGRATION_CHECKED,
          check: async () => {
            const rows = await this.prisma.$queryRawUnsafe<Array<{ pending: bigint | number }>>(
              'SELECT COUNT(*)::bigint AS pending FROM "_prisma_migrations" WHERE finished_at IS NULL'
            );
            const pending = Number(rows[0]?.pending ?? 0);
            if (pending > 0) {
              throw new Error(`migration_pending:${pending}`);
            }
          },
          policy: {
            timeoutMs: 1500,
            retryAttempts: 0,
            failureThreshold: 1,
            resetTimeoutMs: 3000,
            bulkheadMaxConcurrent: 8,
          },
        },
        {
          name: 'queue',
          successState: RuntimeState.QUEUE_SYNCED,
          check: async () => {
            const key = process.env.QUEUE_WAIT_KEY || 'bull:email:wait';
            const threshold = Number.parseInt(process.env.QUEUE_LAG_THRESHOLD || '1000', 10);
            const lag = await this.redis.llen(key);
            if (lag > threshold) {
              throw new Error(`queue_lag_exceeded:${lag}/${threshold}`);
            }
          },
          policy: {
            timeoutMs: 1000,
            retryAttempts: 1,
            failureThreshold: 2,
            resetTimeoutMs: 4000,
            bulkheadMaxConcurrent: 16,
          },
        },
        {
          name: 'payment',
          successState: RuntimeState.PAYMENT_READY,
          check: async () => {
            const url = process.env.PAYMENT_HEALTHCHECK_URL;
            const required = process.env.PAYMENT_REQUIRED === 'true';
            if (!url) {
              if (required) {
                throw new Error('payment_healthcheck_missing');
              }
              return;
            }
            const controller = new AbortController();
            const timeout = setTimeout(
              () => controller.abort(),
              Number.parseInt(process.env.PAYMENT_TIMEOUT_MS || '1500', 10)
            );
            try {
              const response = await fetch(url, { signal: controller.signal });
              if (response.status >= 500) {
                throw new Error(`payment_http_${response.status}`);
              }
            } finally {
              clearTimeout(timeout);
            }
          },
          policy: {
            timeoutMs: Number.parseInt(process.env.PAYMENT_TIMEOUT_MS || '1500', 10),
            retryAttempts: 1,
            failureThreshold: 2,
            resetTimeoutMs: 5000,
            bulkheadMaxConcurrent: Number.parseInt(process.env.PAYMENT_BULKHEAD_MAX || '16', 10),
          },
        },
      ];

      for (const step of steps) {
        const startedAt = Date.now();
        const result = await this.guardrails.execute(step.name, step.check, step.policy);
        const latencyMs = Date.now() - startedAt;
        if (!result.ok) {
          const failureReason = 'reason' in result ? result.reason : 'dependency_check_failed';
          this.setDependencyStatus({
            name: step.name,
            healthy: false,
            reason: failureReason,
            latencyMs,
            circuitState: result.circuitState,
            lastCheckedAt: new Date().toISOString(),
          });
          this.applyState(RuntimeState.DEGRADED, false, `${step.name}:${failureReason}`, traceId, trigger);
          return this.snapshot();
        }

        this.setDependencyStatus({
          name: step.name,
          healthy: true,
          latencyMs,
          circuitState: result.circuitState,
          lastCheckedAt: new Date().toISOString(),
        });
        this.applyState(step.successState, true, null, traceId, trigger);
      }

      this.applyState(RuntimeState.READY, true, null, traceId, trigger);
      return this.snapshot();
    } finally {
      if (previousState !== this.state || previousReady !== this.ready) {
        this.logging.log('runtime_fsm_transition', RuntimeReconciliationService.name, {
          traceId,
          prevState: previousState,
          nextState: this.state,
          prevReady: previousReady,
          nextReady: this.ready,
          reason: this.reason,
          trigger,
        });
      }
    }
  }

  getSnapshot(): RuntimeSnapshot {
    return this.snapshot();
  }

  private setDependencyStatus(status: RuntimeDependencyStatus): void {
    this.dependencies.set(status.name, status);
  }

  private assertConfig(): void {
    const required = ['DATABASE_URL', 'REDIS_URL'];
    for (const key of required) {
      const value = process.env[key];
      if (!value || value.trim().length === 0) {
        throw new Error(`missing_env_${key}`);
      }
    }
    const hasJwtSecret = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32;
    const hasRsaKeys = Boolean(process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY);
    if (!hasJwtSecret && !hasRsaKeys) {
      throw new Error('missing_env_jwt_secret_or_rsa_keys');
    }
  }

  private applyState(
    state: RuntimeState,
    ready: boolean,
    reason: string | null,
    traceId: string,
    trigger: string
  ): void {
    if (this.state === state && this.ready === ready && this.reason === reason) {
      return;
    }
    this.state = state;
    this.ready = ready;
    this.reason = reason;
    this.traceId = traceId;
    this.updatedAt = new Date().toISOString();
    this.logging.log('runtime_state_updated', RuntimeReconciliationService.name, {
      traceId,
      state,
      ready,
      reason,
      trigger,
    });
  }

  private snapshot(): RuntimeSnapshot {
    return {
      state: this.state,
      ready: this.ready,
      reason: this.reason,
      updatedAt: this.updatedAt,
      traceId: this.traceId,
      dependencies: Array.from(this.dependencies.values()),
    };
  }
}

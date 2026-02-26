import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { LoggingService } from '../_observability/logging.service';
import { PrismaService } from '../database/prisma.service';

type OutboxRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  dedupKey: string;
  traceId: string;
  retryCount: number;
  maxRetries: number;
};

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly logging: LoggingService
  ) {}

  onModuleInit(): void {
    const enabled = process.env.OUTBOX_DISPATCH_ENABLED !== 'false';
    if (!enabled) {
      this.logging.warn('outbox_dispatch_disabled', OutboxDispatcherService.name, {});
      return;
    }

    const intervalMs = Number.parseInt(process.env.OUTBOX_DISPATCH_INTERVAL_MS || '1000', 10);
    this.timer = setInterval(() => {
      void this.dispatchOnce();
    }, intervalMs);
    this.timer.unref();
    void this.dispatchOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async dispatchOnce(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const batchSize = Number.parseInt(process.env.OUTBOX_DISPATCH_BATCH_SIZE || '50', 10);
      const queueKey = process.env.OUTBOX_DISPATCH_QUEUE_KEY || 'outbox:events';
      const rows = await this.claimBatch(batchSize);

      for (const row of rows) {
        try {
          await this.redis.lpush(
            queueKey,
            JSON.stringify({
              outboxId: row.id,
              aggregateType: row.aggregateType,
              aggregateId: row.aggregateId,
              eventType: row.eventType,
              payload: row.payload,
              dedupKey: row.dedupKey,
              traceId: row.traceId,
              occurredAt: new Date().toISOString(),
            })
          );

          await this.prisma.$executeRawUnsafe(
            `
              UPDATE outbox_messages
              SET status = 'dispatched',
                  processed_at = NOW(),
                  updated_at = NOW()
              WHERE id = $1
            `,
            row.id
          );

          this.logging.log('outbox_dispatched', OutboxDispatcherService.name, {
            outboxId: row.id,
            aggregateType: row.aggregateType,
            aggregateId: row.aggregateId,
            eventType: row.eventType,
            traceId: row.traceId,
          });
        } catch (error) {
          await this.markRetry(row, error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(batchSize: number): Promise<OutboxRow[]> {
    return this.prisma.$queryRawUnsafe<OutboxRow[]>(
      `
        WITH claim AS (
          SELECT id
          FROM outbox_messages
          WHERE status IN ('pending', 'retry')
            AND available_at <= NOW()
          ORDER BY created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_messages o
        SET status = 'processing',
            updated_at = NOW()
        FROM claim
        WHERE o.id = claim.id
        RETURNING
          o.id,
          o.aggregate_type AS "aggregateType",
          o.aggregate_id AS "aggregateId",
          o.event_type AS "eventType",
          o.payload AS payload,
          o.dedup_key AS "dedupKey",
          o.trace_id AS "traceId",
          o.retry_count AS "retryCount",
          o.max_retries AS "maxRetries"
      `,
      batchSize
    );
  }

  private async markRetry(row: OutboxRow, error: unknown): Promise<void> {
    const retryCount = row.retryCount + 1;
    const dead = retryCount >= row.maxRetries;
    const nextStatus = dead ? 'dead' : 'retry';
    const backoffSeconds = Math.min(60, 2 ** Math.min(retryCount, 10));
    const reason = error instanceof Error ? error.message : 'outbox_dispatch_unknown_error';

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE outbox_messages
        SET status = $2,
            retry_count = $3,
            last_error = $4,
            available_at = CASE
              WHEN $2 = 'retry' THEN NOW() + ($5 * INTERVAL '1 second')
              ELSE available_at
            END,
            processed_at = CASE
              WHEN $2 = 'dead' THEN NOW()
              ELSE processed_at
            END,
            updated_at = NOW()
        WHERE id = $1
      `,
      row.id,
      nextStatus,
      retryCount,
      reason,
      backoffSeconds
    );

    const metadata = {
      outboxId: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      retryCount,
      maxRetries: row.maxRetries,
      status: nextStatus,
      backoffSeconds,
      reason,
      traceId: row.traceId,
    };

    if (dead) {
      this.logging.error(
        'outbox_dispatch_failed',
        undefined,
        OutboxDispatcherService.name,
        metadata
      );
      return;
    }

    this.logging.warn('outbox_dispatch_failed', OutboxDispatcherService.name, metadata);
  }
}

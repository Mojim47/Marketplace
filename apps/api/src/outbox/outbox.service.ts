import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getCurrentCorrelationContext } from '../_middleware/correlation-id.middleware';
import { LoggingService } from '../_observability/logging.service';

export type OutboxEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  dedupKey: string;
  maxRetries?: number;
};

@Injectable()
export class OutboxService {
  constructor(private readonly logging: LoggingService) {}

  async enqueueInTransaction(tx: any, event: OutboxEventInput): Promise<boolean> {
    const traceId = getCurrentCorrelationContext()?.traceId || `trace-${randomUUID()}`;
    const maxRetries = event.maxRetries ?? 5;

    const inserted = await tx.$executeRawUnsafe(
      `
        INSERT INTO outbox_messages (
          id,
          aggregate_type,
          aggregate_id,
          event_type,
          payload,
          dedup_key,
          trace_id,
          status,
          retry_count,
          max_retries,
          available_at,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4::jsonb,
          $5,
          $6,
          'pending',
          0,
          $7,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (dedup_key) DO NOTHING
      `,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      JSON.stringify(event.payload),
      event.dedupKey,
      traceId,
      maxRetries
    );

    const created = Number(inserted) > 0;
    if (!created) {
      this.logging.warn('outbox_duplicate_dedup_key', OutboxService.name, {
        dedupKey: event.dedupKey,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        traceId,
      });
    }

    return created;
  }
}


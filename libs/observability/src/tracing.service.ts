// ═══════════════════════════════════════════════════════════════════════════
// Tracing Service - Distributed Tracing
// ═══════════════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, any>;
  status: 'active' | 'completed' | 'error';
  error?: string;
}

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private readonly activeTraces = new Map<string, TraceSpan>();

  async startTrace(operationName: string, metadata?: Record<string, any>): Promise<string> {
    const traceId = randomUUID();
    const spanId = randomUUID();

    const span: TraceSpan = {
      traceId,
      spanId,
      operationName,
      startTime: new Date(),
      metadata,
      status: 'active',
    };

    this.activeTraces.set(traceId, span);

    this.logger.debug(`Started trace: ${operationName} [${traceId}]`);
    return traceId;
  }

  async endTrace(traceId: string, result?: any): Promise<void> {
    const span = this.activeTraces.get(traceId);
    if (!span) {
      this.logger.warn(`Trace not found: ${traceId}`);
      return;
    }

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = 'completed';

    if (result?.error) {
      span.status = 'error';
      span.error = result.error;
    }

    this.logger.debug(`Completed trace: ${span.operationName} [${traceId}] in ${span.duration}ms`);

    // In production, this would send to a tracing backend like Jaeger
    this.activeTraces.delete(traceId);
  }

  async addSpanEvent(
    traceId: string,
    event: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const span = this.activeTraces.get(traceId);
    if (!span) {
      this.logger.warn(`Trace not found for event: ${traceId}`);
      return;
    }

    this.logger.debug(`Trace event: ${event} [${traceId}]`, metadata);
  }

  getActiveTraces(): TraceSpan[] {
    return Array.from(this.activeTraces.values());
  }

  getTraceCount(): number {
    return this.activeTraces.size;
  }
}

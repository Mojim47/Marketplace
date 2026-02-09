// ═══════════════════════════════════════════════════════════════════════════
// Observability Service - Monitoring, Tracing, and Metrics
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

interface TraceData {
  traceId: string;
  operationName: string;
  startTime: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly activeTraces = new Map<string, TraceData>();

  async startTrace(operationName: string, metadata?: Record<string, any>): Promise<string> {
    const traceId = uuidv4();
    const startTime = Date.now();

    this.activeTraces.set(traceId, {
      traceId,
      operationName,
      startTime,
      metadata,
    });

    this.logger.debug(`Trace started: ${operationName}`, {
      traceId,
      metadata,
    });

    return traceId;
  }

  async endTrace(traceId: string, result?: Record<string, any>): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      this.logger.warn(`Trace not found: ${traceId}`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - trace.startTime;

    this.logger.debug(`Trace completed: ${trace.operationName}`, {
      traceId,
      duration: `${duration}ms`,
      result,
    });

    // Log slow operations
    if (duration > 1000) {
      this.logger.warn(`Slow operation detected: ${trace.operationName}`, {
        traceId,
        duration: `${duration}ms`,
        metadata: trace.metadata,
      });
    }

    this.activeTraces.delete(traceId);
  }

  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    this.logger.debug(`Metric recorded: ${name}`, {
      value,
      tags,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, this would send to Prometheus/Grafana
    // For now, we just log it
  }

  async recordEvent(event: string, data?: Record<string, any>): Promise<void> {
    this.logger.log(`Event recorded: ${event}`, {
      data,
      timestamp: new Date().toISOString(),
    });
  }

  getActiveTraces(): TraceData[] {
    return Array.from(this.activeTraces.values());
  }

  getTraceCount(): number {
    return this.activeTraces.size;
  }

  async healthCheck(): Promise<{ status: string; activeTraces: number }> {
    return {
      status: 'healthy',
      activeTraces: this.activeTraces.size,
    };
  }
}

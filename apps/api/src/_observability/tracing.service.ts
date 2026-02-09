import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

/**
 * Distributed Tracing Service
 *
 * Provides trace ID propagation across services:
 * - Generates and propagates trace IDs
 * - Extracts trace IDs from incoming headers
 * - Adds trace IDs to outgoing requests
 *
 * Note: For full OpenTelemetry integration, configure the SDK
 * in a separate instrumentation file loaded before the app.
 *
 * Validates: Requirements 7.4
 */
@Injectable()
export class TracingService implements OnModuleInit, OnModuleDestroy {
  private readonly serviceName: string;
  private currentTraceId: string | null = null;
  private currentSpanId: string | null = null;

  constructor() {
    this.serviceName = process.env.OTEL_SERVICE_NAME || 'nextgen-api';
  }

  async onModuleInit(): Promise<void> {
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (otlpEndpoint) {
    } else {
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup if needed
  }

  /**
   * Generate a new trace ID (32 hex characters)
   */
  generateTraceId(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Generate a new span ID (16 hex characters)
   */
  generateSpanId(): string {
    return randomUUID().replace(/-/g, '').substring(0, 16);
  }

  /**
   * Set the current trace context
   */
  setTraceContext(traceId: string, spanId?: string): void {
    this.currentTraceId = traceId;
    this.currentSpanId = spanId || this.generateSpanId();
  }

  /**
   * Get the current trace ID
   */
  getCurrentTraceId(): string | null {
    return this.currentTraceId;
  }

  /**
   * Get the current span ID
   */
  getCurrentSpanId(): string | null {
    return this.currentSpanId;
  }

  /**
   * Clear the current trace context
   */
  clearTraceContext(): void {
    this.currentTraceId = null;
    this.currentSpanId = null;
  }

  /**
   * Extract trace context from headers for propagation
   * Supports W3C Trace Context and Jaeger formats
   */
  static extractTraceIdFromHeaders(
    headers: Record<string, string | string[] | undefined>
  ): string | null {
    // W3C Trace Context format: traceparent header
    const traceparent = headers.traceparent;
    if (traceparent) {
      const value = Array.isArray(traceparent) ? traceparent[0] : traceparent;
      // Format: version-traceId-spanId-flags (e.g., 00-traceId-spanId-01)
      const parts = value.split('-');
      if (parts.length >= 2 && parts[1].length === 32) {
        return parts[1];
      }
    }

    // Jaeger format: uber-trace-id header
    const jaegerHeader = headers['uber-trace-id'];
    if (jaegerHeader) {
      const value = Array.isArray(jaegerHeader) ? jaegerHeader[0] : jaegerHeader;
      // Format: traceId:spanId:parentSpanId:flags
      const parts = value.split(':');
      if (parts.length >= 1 && parts[0].length > 0) {
        return parts[0];
      }
    }

    // X-Trace-Id custom header (for internal services)
    const xTraceId = headers['x-trace-id'];
    if (xTraceId) {
      const value = Array.isArray(xTraceId) ? xTraceId[0] : xTraceId;
      if (value.length > 0) {
        return value;
      }
    }

    return null;
  }

  /**
   * Extract span ID from headers
   */
  static extractSpanIdFromHeaders(
    headers: Record<string, string | string[] | undefined>
  ): string | null {
    // W3C Trace Context format: traceparent header
    const traceparent = headers.traceparent;
    if (traceparent) {
      const value = Array.isArray(traceparent) ? traceparent[0] : traceparent;
      const parts = value.split('-');
      if (parts.length >= 3 && parts[2].length === 16) {
        return parts[2];
      }
    }

    // Jaeger format
    const jaegerHeader = headers['uber-trace-id'];
    if (jaegerHeader) {
      const value = Array.isArray(jaegerHeader) ? jaegerHeader[0] : jaegerHeader;
      const parts = value.split(':');
      if (parts.length >= 2) {
        return parts[1];
      }
    }

    return null;
  }

  /**
   * Generate trace context headers for outgoing requests
   * Uses W3C Trace Context format
   */
  getTraceContextHeaders(): Record<string, string> {
    const traceId = this.currentTraceId;
    const spanId = this.currentSpanId;

    if (!traceId) {
      return {};
    }

    const headers: Record<string, string> = {
      'X-Trace-Id': traceId,
    };

    if (spanId) {
      // W3C Trace Context format: version-traceId-spanId-flags
      headers.traceparent = `00-${traceId}-${spanId}-01`;
    }

    return headers;
  }

  /**
   * Create a child span context for nested operations
   */
  createChildContext(): { traceId: string; spanId: string; parentSpanId: string | null } {
    const traceId = this.currentTraceId || this.generateTraceId();
    const parentSpanId = this.currentSpanId;
    const spanId = this.generateSpanId();

    return {
      traceId,
      spanId,
      parentSpanId,
    };
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { randomUUID } from 'crypto';

/**
 * Extract trace ID from request headers
 */
function extractTraceIdFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  const traceId = headers['x-trace-id'] || headers['traceparent'];
  if (typeof traceId === 'string') {
    // If traceparent format (00-traceId-spanId-flags), extract traceId
    if (traceId.includes('-')) {
      const parts = traceId.split('-');
      return parts[1] || null;
    }
    return traceId;
  }
  return null;
}

/**
 * Extract span ID from request headers
 */
function extractSpanIdFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  const spanId = headers['x-span-id'];
  if (typeof spanId === 'string') {
    return spanId;
  }
  // Try to extract from traceparent
  const traceparent = headers['traceparent'];
  if (typeof traceparent === 'string' && traceparent.includes('-')) {
    const parts = traceparent.split('-');
    return parts[2] || null;
  }
  return null;
}

/**
 * Tracing Interceptor
 * 
 * Automatically propagates trace IDs across requests:
 * - Extracts trace ID from incoming request headers
 * - Generates new trace ID if not present
 * - Adds trace ID to response headers
 * - Stores trace ID in request for downstream use
 * 
 * Validates: Requirements 7.4
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private currentTraceId: string | null = null;
  private currentSpanId: string | null = null;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { headers } = request;

    // Extract trace ID from incoming headers or generate new one
    let traceId = request.traceId || extractTraceIdFromHeaders(headers);
    const spanId = extractSpanIdFromHeaders(headers);

    if (!traceId) {
      traceId = randomUUID();
    }

    // Set trace context for this request
    this.currentTraceId = traceId;
    this.currentSpanId = spanId || randomUUID().substring(0, 16);

    // Add trace ID to request for downstream use (logging, error handling)
    request.traceId = traceId;
    request.spanId = this.currentSpanId;

    return next.handle().pipe(
      tap(() => {
        // Add trace ID to response headers for client correlation
        response.setHeader('X-Trace-Id', traceId);
        
        // Clear trace context after request completes
        this.currentTraceId = null;
        this.currentSpanId = null;
      }),
      catchError((error) => {
        // Add trace ID to error response headers
        response.setHeader('X-Trace-Id', traceId);
        
        // Clear trace context after request completes
        this.currentTraceId = null;
        this.currentSpanId = null;

        throw error;
      }),
    );
  }
}

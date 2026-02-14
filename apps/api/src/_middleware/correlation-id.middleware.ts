import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Correlation context stored in AsyncLocalStorage
 */
export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  traceId: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

/**
 * AsyncLocalStorage for correlation context
 * Allows access to correlation ID from anywhere in the request lifecycle
 */
export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Header names for correlation ID
 */
export const CORRELATION_HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
  TRACE_ID: 'x-trace-id',
} as const;

/**
 * Response header names
 */
export const RESPONSE_HEADERS = {
  CORRELATION_ID: 'X-Correlation-ID',
  REQUEST_ID: 'X-Request-ID',
} as const;

/**
 * Validate UUID format
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Extract correlation ID from request headers
 * Supports multiple header formats for compatibility
 */
function extractCorrelationId(request: Request): string | null {
  const headers = [
    CORRELATION_HEADERS.CORRELATION_ID,
    CORRELATION_HEADERS.REQUEST_ID,
    CORRELATION_HEADERS.TRACE_ID,
  ];

  for (const header of headers) {
    const value = request.headers[header];
    if (typeof value === 'string' && value.length > 0) {
      // Validate format to prevent injection
      if (isValidUUID(value) || /^[a-zA-Z0-9-_]{8,64}$/.test(value)) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Extract trace ID from request headers
 */
function extractTraceId(request: Request): string | null {
  const traceHeader = request.headers[CORRELATION_HEADERS.TRACE_ID];
  if (typeof traceHeader === 'string' && traceHeader.length > 0) {
    return traceHeader;
  }
  return null;
}

/**
 * Get current correlation ID from AsyncLocalStorage
 * Returns undefined if not in a request context
 */
export function getCurrentCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

/**
 * Get current correlation context from AsyncLocalStorage
 */
export function getCurrentCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

/**
 * Run a function with a specific correlation context
 * Useful for background jobs or async operations
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  const context: CorrelationContext = {
    correlationId,
    requestId: randomUUID(),
    timestamp: Date.now(),
  };
  return correlationStorage.run(context, fn);
}

/**
 * Correlation ID Middleware
 *
 * Features:
 * - Extracts or generates correlation ID for each request
 * - Stores in AsyncLocalStorage for access throughout request lifecycle
 * - Adds correlation ID to response headers
 * - Supports multiple incoming header formats
 * - Validates correlation ID format to prevent injection
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    // Extract existing correlation ID or generate new one
    const existingId = extractCorrelationId(request);
    const correlationId = existingId || randomUUID();
    const requestId = randomUUID();
    const traceId = extractTraceId(request) || randomUUID();

    // Create correlation context
    const context: CorrelationContext = {
      correlationId,
      requestId,
      traceId,
      timestamp: Date.now(),
    };

    // Store correlation ID on request object for easy access
    (request as any).correlationId = correlationId;
    (request as any).requestId = requestId;
    (request as any).traceId = traceId;

    // Set response headers
    response.setHeader(RESPONSE_HEADERS.CORRELATION_ID, correlationId);
    response.setHeader(RESPONSE_HEADERS.REQUEST_ID, requestId);

    // Log request start with correlation ID
    this.logger.debug(`[${correlationId}] ${request.method} ${request.url} - Request started`);

    // Track response time
    const startTime = Date.now();

    // Add response finish listener for logging
    response.on('finish', () => {
      const duration = Date.now() - startTime;
      this.logger.debug(
        `[${correlationId}] ${request.method} ${request.url} - ${response.statusCode} (${duration}ms)`
      );
    });

    // Run the rest of the request in correlation context
    correlationStorage.run(context, () => {
      next();
    });
  }
}

/**
 * Decorator to inject correlation ID into method parameters
 * Usage: @CorrelationId() correlationId: string
 */
export function CorrelationId(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    // This is a marker decorator - actual injection happens via interceptor
    Reflect.defineMetadata('correlation:paramIndex', parameterIndex, target, propertyKey as string);
  };
}

/**
 * Logger wrapper that automatically includes correlation ID
 */
export class CorrelatedLogger {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  private formatMessage(message: string): string {
    const correlationId = getCurrentCorrelationId();
    return correlationId ? `[${correlationId}] ${message}` : message;
  }

  log(message: string, ...args: any[]): void {
    this.logger.log(this.formatMessage(message), ...args);
  }

  error(message: string, trace?: string, ...args: any[]): void {
    this.logger.error(this.formatMessage(message), trace, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn(this.formatMessage(message), ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.logger.debug(this.formatMessage(message), ...args);
  }

  verbose(message: string, ...args: any[]): void {
    this.logger.verbose(this.formatMessage(message), ...args);
  }
}

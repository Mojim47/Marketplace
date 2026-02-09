import { Injectable, Logger } from '@nestjs/common';
import {
  getCurrentCorrelationContext,
  getCurrentCorrelationId,
} from '../_middleware/correlation-id.middleware';

/**
 * Structured log entry format
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  service: string;
  context?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Structured Logging Service
 *
 * Provides JSON-formatted logging with automatic correlation ID inclusion:
 * - All logs include correlation ID when available
 * - Structured JSON format for log aggregation
 * - Error logs include full error details
 * - Supports metadata for additional context
 *
 * Validates: Requirements 7.5
 */
@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly serviceName: string;
  private readonly sensitiveKeys = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'token',
    'secret',
    'password',
  ]);

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'nextgen-api';
  }

  /**
   * Create a structured log entry
   */
  private createLogEntry(
    level: string,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): StructuredLogEntry {
    const correlationContext = getCurrentCorrelationContext();

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
    };

    // Add correlation context if available
    if (correlationContext) {
      entry.correlationId = correlationContext.correlationId;
      entry.requestId = correlationContext.requestId;
      entry.traceId = correlationContext.traceId;
    }

    // Add context if provided
    if (context) {
      entry.context = context;
    }

    // Add metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = this.redactSensitiveMetadata(metadata);
    }

    // Add error details if provided
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private redactSensitiveMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const redact = (value: unknown, key?: string): unknown => {
      if (key && this.sensitiveKeys.has(key.toLowerCase())) {
        return '[REDACTED]';
      }
      if (Array.isArray(value)) {
        return value.map((item) => redact(item));
      }
      if (value && typeof value === 'object') {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          obj[k] = redact(v, k);
        }
        return obj;
      }
      return value;
    };

    return redact(metadata) as Record<string, unknown>;
  }

  /**
   * Format log entry as JSON string
   */
  private formatAsJson(entry: StructuredLogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Log at INFO level
   */
  log(message: string, context?: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry('info', message, context, metadata);

    if (process.env.LOG_FORMAT === 'json') {
      console.log(this.formatAsJson(entry));
    } else {
      const prefix = entry.correlationId ? `[${entry.correlationId}] ` : '';
      this.logger.log(`${prefix}${message}`, context);
    }
  }

  /**
   * Log at ERROR level with error details
   * All errors include correlation ID for debugging
   *
   * Validates: Requirements 7.5
   */
  error(
    message: string,
    error?: Error | string,
    context?: string,
    metadata?: Record<string, unknown>
  ): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const entry = this.createLogEntry('error', message, context, metadata, errorObj);

    if (process.env.LOG_FORMAT === 'json') {
      console.error(this.formatAsJson(entry));
    } else {
      const prefix = entry.correlationId ? `[${entry.correlationId}] ` : '';
      this.logger.error(`${prefix}${message}`, errorObj?.stack, context);
    }
  }

  /**
   * Log at WARN level
   */
  warn(message: string, context?: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry('warn', message, context, metadata);

    if (process.env.LOG_FORMAT === 'json') {
      console.warn(this.formatAsJson(entry));
    } else {
      const prefix = entry.correlationId ? `[${entry.correlationId}] ` : '';
      this.logger.warn(`${prefix}${message}`, context);
    }
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, context?: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry('debug', message, context, metadata);

    if (process.env.LOG_FORMAT === 'json') {
      console.debug(this.formatAsJson(entry));
    } else {
      const prefix = entry.correlationId ? `[${entry.correlationId}] ` : '';
      this.logger.debug(`${prefix}${message}`, context);
    }
  }

  /**
   * Log at VERBOSE level
   */
  verbose(message: string, context?: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry('verbose', message, context, metadata);

    if (process.env.LOG_FORMAT === 'json') {
      console.debug(this.formatAsJson(entry));
    } else {
      const prefix = entry.correlationId ? `[${entry.correlationId}] ` : '';
      this.logger.verbose(`${prefix}${message}`, context);
    }
  }

  /**
   * Log HTTP request with correlation
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    const entry = this.createLogEntry(
      'info',
      `${method} ${url} ${statusCode} - ${duration}ms`,
      'HTTP',
      {
        ...metadata,
        http: {
          method,
          url,
          statusCode,
          duration,
        },
      }
    );

    if (process.env.LOG_FORMAT === 'json') {
      console.log(this.formatAsJson(entry));
    } else {
      const prefix = entry.correlationId ? `[${entry.correlationId}] ` : '';
      this.logger.log(`${prefix}${method} ${url} ${statusCode} - ${duration}ms`);
    }
  }

  /**
   * Get current correlation ID
   * Useful for including in error responses
   */
  getCurrentCorrelationId(): string | undefined {
    return getCurrentCorrelationId();
  }

  /**
   * Create a structured log entry for external use
   * Useful for custom logging scenarios
   */
  createStructuredEntry(
    level: string,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): StructuredLogEntry {
    return this.createLogEntry(level, message, context, metadata, error);
  }
}

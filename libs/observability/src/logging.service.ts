// ═══════════════════════════════════════════════════════════════════════════
// Logging Service - Structured Logging
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';

export interface LogEvent {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
  traceId?: string;
  tenantId?: string;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);

  async logEvent(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logEvent: LogEvent = {
      timestamp: new Date(),
      level,
      message,
      metadata,
    };

    // Extract trace and tenant info from metadata if available
    if (metadata?.traceId) {
      logEvent.traceId = metadata.traceId;
    }
    if (metadata?.tenantId) {
      logEvent.tenantId = metadata.tenantId;
    }

    // Log using NestJS logger with structured data
    switch (level) {
      case 'info':
        this.logger.log(message, metadata);
        break;
      case 'warn':
        this.logger.warn(message, metadata);
        break;
      case 'error':
        this.logger.error(message, metadata);
        break;
    }

    // In production, this would send to a logging backend like ELK stack
    await this.sendToLogBackend(logEvent);
  }

  async logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent('info', `${method} ${path} ${statusCode} ${duration}ms`, {
      type: 'api_request',
      method,
      path,
      statusCode,
      duration,
      ...metadata,
    });
  }

  async logDatabaseQuery(
    query: string,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent('info', `Database query completed in ${duration}ms`, {
      type: 'database_query',
      query: query.substring(0, 100), // Truncate for security
      duration,
      ...metadata,
    });
  }

  async logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent('warn', `Security event: ${event}`, {
      type: 'security_event',
      event,
      severity,
      ...metadata,
    });
  }

  async logBusinessEvent(event: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent('info', `Business event: ${event}`, {
      type: 'business_event',
      event,
      ...metadata,
    });
  }

  private async sendToLogBackend(_logEvent: LogEvent): Promise<void> {
    // In production, this would send to ELK, Datadog, or similar
    // For now, we'll just simulate the operation
    if (process.env.NODE_ENV === 'development') {
      // Only log in development to avoid noise
      return;
    }
  }
}

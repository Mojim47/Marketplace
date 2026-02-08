/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Audit Interceptor
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Logs all API requests and responses using EnterpriseAuditLogger from libs/audit.
 * Provides comprehensive audit trail with chain integrity for compliance.
 * 
 * Features:
 * - Automatic request/response logging
 * - User identification from JWT
 * - Request context capture (IP, User-Agent, etc.)
 * - Response timing measurement
 * - Error logging with details
 * - Chain integrity for tamper detection
 * 
 * @module @nextgen/api/interceptors
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  EnterpriseAuditLogger,
  AuditLoggerConfig,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
  AuditActor,
  AuditContext,
  InMemoryAuditStorage,
} from '@nextgen/audit';

/**
 * Metadata key for skipping audit logging
 */
export const SKIP_AUDIT_KEY = 'skipAudit';

/**
 * Decorator to skip audit logging for specific endpoints
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

/**
 * Metadata key for custom audit event type
 */
export const AUDIT_EVENT_KEY = 'auditEvent';

/**
 * Decorator to set custom audit event type for an endpoint
 */
export const AuditEvent = (eventType: AuditEventType) =>
  SetMetadata(AUDIT_EVENT_KEY, eventType);

/**
 * Provider token for audit logger
 */
export const AUDIT_LOGGER_TOKEN = 'AUDIT_LOGGER';

/**
 * Configuration options for AuditInterceptor
 */
export interface AuditInterceptorConfig {
  /** Paths to exclude from audit logging */
  excludePaths?: string[];
  /** HTTP methods to exclude from audit logging */
  excludeMethods?: string[];
  /** Whether to log request body (be careful with sensitive data) */
  logRequestBody?: boolean;
  /** Whether to log response body */
  logResponseBody?: boolean;
  /** Maximum body size to log (in characters) */
  maxBodyLogSize?: number;
  /** Fields to redact from logs */
  redactFields?: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AuditInterceptorConfig = {
  excludePaths: ['/health', '/metrics', '/api/health', '/api/metrics', '/livez'],
  excludeMethods: ['OPTIONS'],
  logRequestBody: false,
  logResponseBody: false,
  maxBodyLogSize: 1000,
  redactFields: ['password', 'token', 'secret', 'apiKey', 'authorization', 'creditCard'],
};

/**
 * Map HTTP methods to audit event types
 */
const METHOD_TO_EVENT_TYPE: Record<string, AuditEventType> = {
  GET: AuditEventType.DATA_READ,
  POST: AuditEventType.DATA_CREATED,
  PUT: AuditEventType.DATA_UPDATED,
  PATCH: AuditEventType.DATA_UPDATED,
  DELETE: AuditEventType.DATA_DELETED,
};

/**
 * Extended Request interface with user information
 */
interface AuthenticatedRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
    email?: string;
    name?: string;
    roles?: string[];
    organizationId?: string;
    sessionId?: string;
  };
}

/**
 * Audit Interceptor
 * 
 * Automatically logs all API requests and responses for audit compliance.
 * Captures user identity, request context, timing, and outcomes.
 * 
 * @example
 * // Global registration in AppModule
 * providers: [
 *   {
 *     provide: APP_INTERCEPTOR,
 *     useClass: AuditInterceptor,
 *   },
 * ]
 * 
 * @example
 * // Skip audit for specific endpoint
 * @SkipAudit()
 * @Get('internal')
 * internalEndpoint() {}
 * 
 * @example
 * // Custom audit event type
 * @AuditEvent(AuditEventType.PAYMENT_INITIATED)
 * @Post('payment')
 * initiatePayment() {}
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditInterceptor');
  private readonly config: AuditInterceptorConfig;
  private readonly auditLogger: EnterpriseAuditLogger;
  private readonly excludePathsSet: Set<string>;
  private readonly excludeMethodsSet: Set<string>;
  private readonly redactFieldsSet: Set<string>;
  private isInitialized = false;

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(AUDIT_LOGGER_TOKEN)
    injectedLogger?: EnterpriseAuditLogger,
    config?: Partial<AuditInterceptorConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Use injected logger or create default
    if (injectedLogger) {
      this.auditLogger = injectedLogger;
    } else {
      // Create default in-memory audit logger
      this.auditLogger = new EnterpriseAuditLogger({
        storage: new InMemoryAuditStorage(10000),
        enableChaining: true,
        batchSize: 50,
        flushInterval: 5000,
        onError: (error, entry) => {
          this.logger.error(`Audit log error: ${error.message}`, { entryId: entry.id });
        },
      });
    }

    // Create sets for O(1) lookup
    this.excludePathsSet = new Set(this.config.excludePaths);
    this.excludeMethodsSet = new Set(this.config.excludeMethods);
    this.redactFieldsSet = new Set(this.config.redactFields?.map(f => f.toLowerCase()));

    // Initialize audit logger
    this.initializeLogger();
  }

  /**
   * Initialize the audit logger asynchronously
   */
  private async initializeLogger(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await this.auditLogger.initialize();
      this.isInitialized = true;
      this.logger.log('Audit logger initialized');
    } catch (error) {
      this.logger.error('Failed to initialize audit logger', error);
    }
  }

  /**
   * Intercept HTTP requests and log audit events
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Check if audit should be skipped
    if (this.shouldSkipAudit(context, request)) {
      return next.handle();
    }

    // Get custom event type if specified
    const customEventType = this.reflector.get<AuditEventType>(
      AUDIT_EVENT_KEY,
      context.getHandler(),
    );

    // Build audit context
    const auditContext = this.buildAuditContext(request);
    const actor = this.buildAuditActor(request);
    const eventType = customEventType || this.getEventTypeForMethod(request.method);

    return next.handle().pipe(
      tap(async (responseData) => {
        // Log successful request
        const duration = Date.now() - startTime;
        await this.logAuditEvent({
          eventType,
          actor,
          context: auditContext,
          outcome: AuditOutcome.SUCCESS,
          severity: AuditSeverity.INFO,
          duration,
          statusCode: response.statusCode,
          path: request.path,
          method: request.method,
          responseData: this.config.logResponseBody ? responseData : undefined,
        });
      }),
      catchError(async (error) => {
        // Log failed request
        const duration = Date.now() - startTime;
        await this.logAuditEvent({
          eventType,
          actor,
          context: auditContext,
          outcome: AuditOutcome.FAILURE,
          severity: this.getSeverityForError(error),
          duration,
          statusCode: error.status || 500,
          path: request.path,
          method: request.method,
          error: error.message,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Check if audit should be skipped for this request
   */
  private shouldSkipAudit(context: ExecutionContext, request: Request): boolean {
    // Check decorator
    const skipAudit = this.reflector.get<boolean>(SKIP_AUDIT_KEY, context.getHandler());
    if (skipAudit) return true;

    // Check excluded paths
    if (this.excludePathsSet.has(request.path)) return true;

    // Check excluded methods
    if (this.excludeMethodsSet.has(request.method)) return true;

    return false;
  }

  /**
   * Build audit context from request
   */
  private buildAuditContext(request: AuthenticatedRequest): AuditContext {
    return {
      ipAddress: this.getClientIP(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string,
      correlationId: request.headers['x-correlation-id'] as string,
      traceId: (request.headers['x-trace-id'] as string) || (request as any).traceId,
      spanId: request.headers['x-span-id'] as string,
    };
  }

  /**
   * Build audit actor from request
   */
  private buildAuditActor(request: AuthenticatedRequest): AuditActor {
    const user = request.user;

    if (user) {
      return {
        id: user.sub || user.id || 'unknown',
        type: 'user',
        email: user.email,
        name: user.name,
        roles: user.roles,
        organizationId: user.organizationId,
        sessionId: user.sessionId,
      };
    }

    return {
      id: this.getClientIP(request) || 'anonymous',
      type: 'anonymous',
    };
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ips.trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Get audit event type for HTTP method
   */
  private getEventTypeForMethod(method: string): AuditEventType {
    return METHOD_TO_EVENT_TYPE[method.toUpperCase()] || AuditEventType.DATA_READ;
  }

  /**
   * Get severity level for error
   */
  private getSeverityForError(error: any): AuditSeverity {
    const status = error.status || 500;
    
    if (status >= 500) return AuditSeverity.ERROR;
    if (status === 401 || status === 403) return AuditSeverity.WARNING;
    if (status === 429) return AuditSeverity.WARNING;
    
    return AuditSeverity.INFO;
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(params: {
    eventType: AuditEventType;
    actor: AuditActor;
    context: AuditContext;
    outcome: AuditOutcome;
    severity: AuditSeverity;
    duration: number;
    statusCode: number;
    path: string;
    method: string;
    responseData?: any;
    error?: string;
  }): Promise<void> {
    try {
      await this.auditLogger.log({
        eventType: params.eventType,
        actor: params.actor,
        context: params.context,
        outcome: params.outcome,
        severity: params.severity,
        message: `${params.method} ${params.path} - ${params.statusCode} (${params.duration}ms)`,
        metadata: {
          duration: params.duration,
          statusCode: params.statusCode,
          path: params.path,
          method: params.method,
          ...(params.error && { error: params.error }),
          ...(params.responseData && { 
            responseSize: JSON.stringify(params.responseData).length 
          }),
        },
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
    }
  }

  /**
   * Redact sensitive fields from an object
   */
  private redactSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const redacted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.redactFieldsSet.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Flush pending audit logs (call on application shutdown)
   */
  async flush(): Promise<void> {
    await this.auditLogger.flush();
  }

  /**
   * Shutdown the audit logger (call on application shutdown)
   */
  async shutdown(): Promise<void> {
    await this.auditLogger.shutdown();
  }
}

/**
 * Factory function to create AuditInterceptor with custom config
 */
export function createAuditInterceptor(
  reflector: Reflector,
  logger?: EnterpriseAuditLogger,
  config?: Partial<AuditInterceptorConfig>,
): AuditInterceptor {
  return new AuditInterceptor(reflector, logger, config);
}

export default AuditInterceptor;

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

interface Request {
  method: string;
  url: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string };
  correlationId?: string;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

/**
 * Production-ready error response structure
 * Follows security best practices:
 * - No stack traces in production
 * - Generic messages for auth errors
 * - Correlation ID for tracing
 */
export interface SecureErrorResponse {
  statusCode: number;
  timestamp: string;
  correlationId: string;
  message: string;
  error?: string;
  // Only in development
  details?: unknown;
}

/**
 * Patterns that indicate sensitive database information
 */
const SENSITIVE_DB_PATTERNS = [
  /unique constraint/i,
  /foreign key/i,
  /duplicate key/i,
  /violates.*constraint/i,
  /relation.*does not exist/i,
  /column.*does not exist/i,
  /table.*does not exist/i,
  /syntax error/i,
  /permission denied/i,
  /authentication failed/i,
  /connection refused/i,
  /timeout expired/i,
  /deadlock/i,
  /prisma/i,
  /postgresql/i,
  /mysql/i,
  /mongodb/i,
  /redis/i,
];

/**
 * Auth-related status codes that should use generic messages
 */
const AUTH_STATUS_CODES = [
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
];

/**
 * Generic messages for different error types (Persian)
 */
const GENERIC_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'ÏÑÎæÇÓÊ äÇãÚÊÈÑ ÇÓÊ',
  [HttpStatus.UNAUTHORIZED]: 'ÇÍÑÇÒ åæíÊ äÇãæÝÞ ÈæÏ',
  [HttpStatus.FORBIDDEN]: 'ÏÓÊÑÓí ÛíÑãÌÇÒ',
  [HttpStatus.NOT_FOUND]: 'ãäÈÚ ÏÑÎæÇÓÊí íÇÝÊ äÔÏ',
  [HttpStatus.CONFLICT]: 'ÊÏÇÎá ÏÑ ÏÑÎæÇÓÊ',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'ÏÇÏååÇí ÇÑÓÇáí ÞÇÈá ÑÏÇÒÔ äíÓÊäÏ',
  [HttpStatus.TOO_MANY_REQUESTS]: 'ÊÚÏÇÏ ÏÑÎæÇÓÊåÇ ÈíÔ ÇÒ ÍÏ ãÌÇÒ ÇÓÊ',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'ÎØÇí ÏÇÎáí ÓÑæÑ',
  [HttpStatus.BAD_GATEWAY]: 'ÎØÇ ÏÑ ÇÑÊÈÇØ ÈÇ ÓÑæíÓ',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'ÓÑæíÓ ãæÞÊÇð ÏÑ ÏÓÊÑÓ äíÓÊ',
  [HttpStatus.GATEWAY_TIMEOUT]: 'ÒãÇä ÇÓÎÏåí ÓÑæíÓ Èå ÇíÇä ÑÓíÏ',
};

/**
 * Check if running in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if message contains sensitive database information
 */
function containsSensitiveDbInfo(message: string): boolean {
  return SENSITIVE_DB_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Sanitize error message for production
 * - Removes stack traces
 * - Removes database-specific information
 * - Uses generic messages for auth errors
 */
function sanitizeErrorMessage(
  status: number,
  originalMessage: string,
): string {
  // Always use generic message for auth errors
  if (AUTH_STATUS_CODES.includes(status)) {
    return GENERIC_MESSAGES[status] || 'ÇÍÑÇÒ åæíÊ äÇãæÝÞ ÈæÏ';
  }

  // In production, sanitize all messages
  if (isProduction()) {
    // Check for sensitive database information
    if (containsSensitiveDbInfo(originalMessage)) {
      return GENERIC_MESSAGES[status] || GENERIC_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];
    }

    // For 5xx errors, always use generic message
    if (status >= 500) {
      return GENERIC_MESSAGES[status] || GENERIC_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];
    }
  }

  // For client errors in non-production, return original message
  // unless it contains sensitive info
  if (containsSensitiveDbInfo(originalMessage)) {
    return GENERIC_MESSAGES[status] || 'ÎØÇ ÏÑ ÑÏÇÒÔ ÏÑÎæÇÓÊ';
  }

  return originalMessage;
}

/**
 * Extract correlation ID from request or generate new one
 */
export function getCorrelationId(request: Request): string {
  const existingId = request.headers['x-correlation-id'] ||
                     request.headers['x-request-id'] ||
                     (request as any).correlationId;
  
  if (typeof existingId === 'string' && existingId.length > 0) {
    return existingId;
  }
  
  return randomUUID();
}

/**
 * Secure exception filter for production environments
 * 
 * Security features:
 * - No stack traces in production responses
 * - Sanitized database error messages
 * - Generic messages for authentication errors
 * - Correlation ID for request tracing
 * - Structured logging with sanitized data
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Get or generate correlation ID
    const correlationId = getCorrelationId(request);

    // Determine status code
    const status = this.getStatusCode(exception);

    // Extract original message
    const originalMessage = this.extractMessage(exception);

    // Sanitize message for response
    const sanitizedMessage = sanitizeErrorMessage(status, originalMessage);

    // Build secure error response
    const errorResponse: SecureErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      correlationId,
      message: sanitizedMessage,
    };

    // Add error type name in non-production
    if (!isProduction() && exception instanceof Error) {
      errorResponse.error = exception.name;
    }

    // Add details only in development (never in production)
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = this.extractDetails(exception);
    }

    // Log the error with full details (server-side only)
    this.logError(request, exception, correlationId, status);

    // Set correlation ID in response header
    response.setHeader('X-Correlation-ID', correlationId);

    // Send sanitized response
    response.status(status).json(errorResponse);
  }

  /**
   * Extract HTTP status code from exception
   */
  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Prisma/Database errors
    if (this.isPrismaError(exception)) {
      return this.getPrismaErrorStatus(exception);
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Extract message from exception
   */
  private extractMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null) {
        const resp = response as Record<string, unknown>;
        if (typeof resp.message === 'string') {
          return resp.message;
        }
        if (Array.isArray(resp.message)) {
          return resp.message.join(', ');
        }
      }
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'ÎØÇí äÇÔäÇÎÊå';
  }

  /**
   * Extract additional details for development
   */
  private extractDetails(exception: unknown): unknown {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object') {
        return response;
      }
    }

    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
        stack: exception.stack?.split('\n').slice(0, 5),
      };
    }

    return undefined;
  }

  /**
   * Check if exception is a Prisma error
   */
  private isPrismaError(exception: unknown): boolean {
    if (exception instanceof Error) {
      return exception.constructor.name.includes('Prisma') ||
             exception.name.includes('Prisma') ||
             (exception as any).code?.startsWith?.('P');
    }
    return false;
  }

  /**
   * Map Prisma error codes to HTTP status codes
   */
  private getPrismaErrorStatus(exception: unknown): number {
    const code = (exception as any).code;
    
    switch (code) {
      case 'P2002': // Unique constraint violation
        return HttpStatus.CONFLICT;
      case 'P2025': // Record not found
        return HttpStatus.NOT_FOUND;
      case 'P2003': // Foreign key constraint
        return HttpStatus.BAD_REQUEST;
      case 'P2024': // Connection timeout
        return HttpStatus.SERVICE_UNAVAILABLE;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Log error with full details (server-side only)
   * Sensitive data is NOT included in client response
   */
  private logError(
    request: Request,
    exception: unknown,
    correlationId: string,
    status: number,
  ): void {
    const logContext = {
      correlationId,
      method: request.method,
      url: request.url,
      statusCode: status,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.headers['x-forwarded-for'],
      userId: (request as any).user?.id,
    };

    // Log level based on status code
    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(logContext),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} - ${status}`,
        JSON.stringify(logContext),
      );
    }
  }
}

/**
 * Utility to check if an error message is sanitized
 * Used for testing
 */
export function isMessageSanitized(message: string): boolean {
  return !SENSITIVE_DB_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Export for testing
 */
export const __testing = {
  containsSensitiveDbInfo,
  sanitizeErrorMessage,
  isProduction,
  SENSITIVE_DB_PATTERNS,
  AUTH_STATUS_CODES,
  GENERIC_MESSAGES,
};

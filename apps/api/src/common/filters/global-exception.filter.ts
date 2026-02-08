/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Global Exception Filter
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Production-ready exception filter with Persian error messages.
 * Handles all exceptions and returns consistent, localized error responses.
 * 
 * Features:
 * - Persian error messages for all HTTP status codes
 * - Sanitized error messages in production (no stack traces, no DB info)
 * - Correlation ID for request tracing
 * - Structured logging with full details (server-side only)
 * - Prisma/Database error handling
 * - Validation error formatting
 * 
 * @module @nextgen/api/filters
 * Requirements: 4.4
 */

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
  path: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string; sub?: string };
  correlationId?: string;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

/**
 * Secure error response structure with Persian messages
 */
export interface PersianErrorResponse {
  success: false;
  statusCode: number;
  timestamp: string;
  correlationId: string;
  message: string;
  messageFa: string;
  error?: string;
  path: string;
  // Only in development
  details?: unknown;
}

/**
 * Persian error messages for all HTTP status codes
 */
export const PERSIAN_ERROR_MESSAGES: Record<number, string> = {
  // 4xx Client Errors
  [HttpStatus.BAD_REQUEST]: 'œ—ŒÊ«”  ‰«„⁄ »— «” ',
  [HttpStatus.UNAUTHORIZED]: '«Õ—«“ ÂÊÌ  ‰«„Ê›ﬁ »Êœ',
  [HttpStatus.PAYMENT_REQUIRED]: 'Å—œ«Œ  „Ê—œ ‰Ì«“ «” ',
  [HttpStatus.FORBIDDEN]: 'œ” —”Ì €Ì—„Ã«“',
  [HttpStatus.NOT_FOUND]: '„‰»⁄ œ—ŒÊ«” Ì Ì«›  ‰‘œ',
  [HttpStatus.METHOD_NOT_ALLOWED]: '„ œ œ—ŒÊ«” Ì „Ã«“ ‰Ì” ',
  [HttpStatus.NOT_ACCEPTABLE]: '›—„  œ—ŒÊ«” Ì ﬁ«»· ﬁ»Ê· ‰Ì” ',
  [HttpStatus.PROXY_AUTHENTICATION_REQUIRED]: '«Õ—«“ ÂÊÌ  Å—Êò”Ì „Ê—œ ‰Ì«“ «” ',
  [HttpStatus.REQUEST_TIMEOUT]: '“„«‰ œ—ŒÊ«”  »Â Å«Ì«‰ —”Ìœ',
  [HttpStatus.CONFLICT]: ' œ«Œ· œ— œ—ŒÊ«” ',
  [HttpStatus.GONE]: '„‰»⁄ œ—ŒÊ«” Ì œÌê— œ— œ” —” ‰Ì” ',
  [HttpStatus.LENGTH_REQUIRED]: 'ÿÊ· „Õ Ê« „Ê—œ ‰Ì«“ «” ',
  [HttpStatus.PRECONDITION_FAILED]: 'ÅÌ‘ù‘—ÿùÂ« »—¬Ê—œÂ ‰‘œÂ «” ',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'ÕÃ„ œ—ŒÊ«”  »Ì‘ «“ Õœ „Ã«“ «” ',
  [HttpStatus.URI_TOO_LONG]: '¬œ—” œ—ŒÊ«”  »Ì‘ «“ Õœ ÿÊ·«‰Ì «” ',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: '‰Ê⁄ „Õ Ê« Å‘ Ì»«‰Ì ‰„Ìù‘Êœ',
  [HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE]: '„ÕœÊœÂ œ—ŒÊ«” Ì ﬁ«»· «—«∆Â ‰Ì” ',
  [HttpStatus.EXPECTATION_FAILED]: '«‰ Ÿ«—«  »—¬Ê—œÂ ‰‘œ',
  [HttpStatus.I_AM_A_TEAPOT]: '„‰ Ìò ﬁÊ—Ì Â” „!',
  [HttpStatus.MISDIRECTED]: 'œ—ŒÊ«”  »Â ”—Ê— «‘ »«Â «—”«· ‘œÂ',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'œ«œÂùÂ«Ì «—”«·Ì ﬁ«»· Å—œ«“‘ ‰Ì” ‰œ',
  [HttpStatus.FAILED_DEPENDENCY]: 'Ê«»” êÌ ‰«„Ê›ﬁ',
  [HttpStatus.PRECONDITION_REQUIRED]: 'ÅÌ‘ù‘—ÿ „Ê—œ ‰Ì«“ «” ',
  [HttpStatus.TOO_MANY_REQUESTS]: ' ⁄œ«œ œ—ŒÊ«” ùÂ« »Ì‘ «“ Õœ „Ã«“ «” ',
  
  // 5xx Server Errors
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Œÿ«Ì œ«Œ·Ì ”—Ê—',
  [HttpStatus.NOT_IMPLEMENTED]: '«Ì‰ ﬁ«»·Ì  ÅÌ«œÂù”«“Ì ‰‘œÂ «” ',
  [HttpStatus.BAD_GATEWAY]: 'Œÿ« œ— «— »«ÿ »« ”—ÊÌ”',
  [HttpStatus.SERVICE_UNAVAILABLE]: '”—ÊÌ” „Êﬁ « œ— œ” —” ‰Ì” ',
  [HttpStatus.GATEWAY_TIMEOUT]: '“„«‰ Å«”ŒùœÂÌ ”—ÊÌ” »Â Å«Ì«‰ —”Ìœ',
  [HttpStatus.HTTP_VERSION_NOT_SUPPORTED]: '‰”ŒÂ HTTP Å‘ Ì»«‰Ì ‰„Ìù‘Êœ',
};

/**
 * Specific Persian messages for common error scenarios
 */
export const SPECIFIC_ERROR_MESSAGES: Record<string, string> = {
  // Authentication
  INVALID_CREDENTIALS: '«Ì„Ì· Ì« —„“ ⁄»Ê— «‘ »«Â «” ',
  ACCOUNT_LOCKED: 'Õ”«» ò«—»—Ì ﬁ›· ‘œÂ «” ',
  INVALID_TOKEN: ' Êò‰ ‰«„⁄ »— «” ',
  TOKEN_EXPIRED: ' Êò‰ „‰ﬁ÷Ì ‘œÂ «” ',
  INVALID_TOTP: 'òœ  «ÌÌœ ‰«„⁄ »— «” ',
  SESSION_EXPIRED: '‰‘”  ‘„« „‰ﬁ÷Ì ‘œÂ «” . ·ÿ›« œÊ»«—Â Ê«—œ ‘ÊÌœ',
  
  // Validation
  INVALID_MOBILE: '‘„«—Â „Ê»«Ì· ‰«„⁄ »— «” ',
  INVALID_NATIONAL_ID: 'òœ „·Ì ‰«„⁄ »— «” ',
  INVALID_BANK_CARD: '‘„«—Â ò«—  ‰«„⁄ »— «” ',
  INVALID_IBAN: '‘„«—Â ‘»« ‰«„⁄ »— «” ',
  INVALID_POSTAL_CODE: 'òœ Å” Ì ‰«„⁄ »— «” ',
  INVALID_EMAIL: '¬œ—” «Ì„Ì· ‰«„⁄ »— «” ',
  
  // Payment
  PAYMENT_FAILED: 'Å—œ«Œ  ‰«„Ê›ﬁ »Êœ',
  INSUFFICIENT_BALANCE: '„ÊÃÊœÌ ò«›Ì ‰Ì” ',
  PAYMENT_CANCELLED: 'Å—œ«Œ  ·€Ê ‘œ',
  PAYMENT_TIMEOUT: '“„«‰ Å—œ«Œ  »Â Å«Ì«‰ —”Ìœ',
  
  // Security
  CSRF_INVALID: ' Êò‰ CSRF ‰«„⁄ »— «” ',
  ACCESS_DENIED: 'œ” —”Ì €Ì—„Ã«“',
  BLOCKED_IP: '¬œ—” IP ‘„« „”œÊœ ‘œÂ «” ',
  RATE_LIMIT_EXCEEDED: ' ⁄œ«œ œ—ŒÊ«” ùÂ«Ì ‘„« »Ì‘ «“ Õœ „Ã«“ «” ',
  
  // Resources
  USER_NOT_FOUND: 'ò«—»— Ì«›  ‰‘œ',
  PRODUCT_NOT_FOUND: '„Õ’Ê· Ì«›  ‰‘œ',
  ORDER_NOT_FOUND: '”›«—‘ Ì«›  ‰‘œ',
  RESOURCE_NOT_FOUND: '„‰»⁄ œ—ŒÊ«” Ì Ì«›  ‰‘œ',
  
  // Database
  DUPLICATE_ENTRY: '«Ì‰ „Ê—œ ﬁ»·« À»  ‘œÂ «” ',
  FOREIGN_KEY_VIOLATION: '«„ò«‰ Õ–› «Ì‰ „Ê—œ ÊÃÊœ ‰œ«—œ',
};

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
 * Get Persian message for error
 */
function getPersianMessage(status: number, originalMessage: string, errorCode?: string): string {
  // Check for specific error code first
  if (errorCode && SPECIFIC_ERROR_MESSAGES[errorCode]) {
    return SPECIFIC_ERROR_MESSAGES[errorCode];
  }

  // Check for specific message patterns
  const lowerMessage = originalMessage.toLowerCase();
  
  if (lowerMessage.includes('invalid credentials') || lowerMessage.includes('wrong password')) {
    return SPECIFIC_ERROR_MESSAGES.INVALID_CREDENTIALS;
  }
  if (lowerMessage.includes('account locked') || lowerMessage.includes('too many attempts')) {
    return SPECIFIC_ERROR_MESSAGES.ACCOUNT_LOCKED;
  }
  if (lowerMessage.includes('token expired') || lowerMessage.includes('jwt expired')) {
    return SPECIFIC_ERROR_MESSAGES.TOKEN_EXPIRED;
  }
  if (lowerMessage.includes('invalid token') || lowerMessage.includes('jwt malformed')) {
    return SPECIFIC_ERROR_MESSAGES.INVALID_TOKEN;
  }
  if (lowerMessage.includes('csrf')) {
    return SPECIFIC_ERROR_MESSAGES.CSRF_INVALID;
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return SPECIFIC_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED;
  }
  if (lowerMessage.includes('duplicate') || lowerMessage.includes('already exists')) {
    return SPECIFIC_ERROR_MESSAGES.DUPLICATE_ENTRY;
  }

  // Always use generic message for auth errors
  if (AUTH_STATUS_CODES.includes(status)) {
    return PERSIAN_ERROR_MESSAGES[status] || '«Õ—«“ ÂÊÌ  ‰«„Ê›ﬁ »Êœ';
  }

  // In production, sanitize all messages
  if (isProduction()) {
    if (containsSensitiveDbInfo(originalMessage)) {
      return PERSIAN_ERROR_MESSAGES[status] || PERSIAN_ERROR_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];
    }

    if (status >= 500) {
      return PERSIAN_ERROR_MESSAGES[status] || PERSIAN_ERROR_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];
    }
  }

  // Return generic Persian message for status code
  return PERSIAN_ERROR_MESSAGES[status] || 'Œÿ« œ— Å—œ«“‘ œ—ŒÊ«” ';
}

/**
 * Extract correlation ID from request or generate new one
 */
function getCorrelationId(request: Request): string {
  const existingId = request.headers['x-correlation-id'] ||
                     request.headers['x-request-id'] ||
                     (request as any).correlationId;
  
  if (typeof existingId === 'string' && existingId.length > 0) {
    return existingId;
  }
  
  return randomUUID();
}

/**
 * Global Exception Filter with Persian Messages
 * 
 * Handles all exceptions and returns consistent, localized error responses.
 * 
 * @example
 * // Global registration in AppModule
 * providers: [
 *   {
 *     provide: APP_FILTER,
 *     useClass: GlobalExceptionFilter,
 *   },
 * ]
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Get or generate correlation ID
    const correlationId = getCorrelationId(request);

    // Determine status code
    const status = this.getStatusCode(exception);

    // Extract original message and error code
    const { message: originalMessage, errorCode } = this.extractMessageAndCode(exception);

    // Get Persian message
    const persianMessage = getPersianMessage(status, originalMessage, errorCode);

    // Sanitize English message for response
    const sanitizedMessage = this.sanitizeMessage(status, originalMessage);

    // Build error response
    const errorResponse: PersianErrorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      correlationId,
      message: sanitizedMessage,
      messageFa: persianMessage,
      path: request.path || request.url,
    };

    // Add error type name in non-production
    if (!isProduction() && exception instanceof Error) {
      errorResponse.error = exception.name;
    }

    // Add details only in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = this.extractDetails(exception);
    }

    // Log the error with full details (server-side only)
    this.logError(request, exception, correlationId, status);

    // Set correlation ID in response header
    response.setHeader('X-Correlation-ID', correlationId);

    // Send response
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
   * Extract message and error code from exception
   */
  private extractMessageAndCode(exception: unknown): { message: string; errorCode?: string } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { message: response };
      }
      if (typeof response === 'object' && response !== null) {
        const resp = response as Record<string, unknown>;
        let message = 'Œÿ«Ì ‰«‘‰«Œ Â';
        
        if (typeof resp.message === 'string') {
          message = resp.message;
        } else if (Array.isArray(resp.message)) {
          message = resp.message.join(', ');
        }
        
        return {
          message,
          errorCode: typeof resp.errorCode === 'string' ? resp.errorCode : undefined,
        };
      }
    }

    if (exception instanceof Error) {
      return { message: exception.message };
    }

    return { message: 'Œÿ«Ì ‰«‘‰«Œ Â' };
  }

  /**
   * Sanitize message for response
   */
  private sanitizeMessage(status: number, originalMessage: string): string {
    // Always use generic message for auth errors
    if (AUTH_STATUS_CODES.includes(status)) {
      return 'Authentication failed';
    }

    // In production, sanitize all messages
    if (isProduction()) {
      if (containsSensitiveDbInfo(originalMessage)) {
        return 'An error occurred';
      }

      if (status >= 500) {
        return 'Internal server error';
      }
    }

    // For client errors, check for sensitive info
    if (containsSensitiveDbInfo(originalMessage)) {
      return 'An error occurred';
    }

    return originalMessage;
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
      path: request.path,
      statusCode: status,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.headers['x-forwarded-for'],
      userId: request.user?.id || request.user?.sub,
      traceId: (request as any).traceId || request.headers['x-trace-id'],
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

export default GlobalExceptionFilter;


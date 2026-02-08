/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Global Exception Filter - Catches all errors and normalizes responses
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ErrorCode, ErrorResponse } from './app-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || undefined;
    const path = request.url;

    const errorResponse = this.buildErrorResponse(exception, path, requestId);

    // Log error (never log stack traces in response)
    this.logError(exception, errorResponse, request);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    path: string,
    requestId?: string
  ): ErrorResponse {
    // AppError - our custom errors
    if (exception instanceof AppError) {
      return exception.toResponse(path, requestId);
    }

    // NestJS HttpException
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, path, requestId);
    }

    // FORBIDDEN: Raw string throws
    if (typeof exception === 'string') {
      this.logger.warn(`String thrown as error: "${exception}" - this is forbidden`);
      return this.createInternalErrorResponse(path, requestId);
    }

    // FORBIDDEN: Raw Error objects (leaks stack trace)
    if (exception instanceof Error) {
      this.logger.warn(`Raw Error thrown: ${exception.message} - wrap in AppError`);
      return this.createInternalErrorResponse(path, requestId);
    }

    // Unknown error type
    this.logger.error('Unknown error type thrown', exception);
    return this.createInternalErrorResponse(path, requestId);
  }

  private handleHttpException(
    exception: HttpException,
    path: string,
    requestId?: string
  ): ErrorResponse {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Map NestJS exceptions to our error codes
    const codeMap: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.RESOURCE_NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.BUSINESS_RULE_VIOLATION,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMIT_EXCEEDED,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.INTERNAL_ERROR,
      [HttpStatus.BAD_GATEWAY]: ErrorCode.BAD_GATEWAY,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
      [HttpStatus.GATEWAY_TIMEOUT]: ErrorCode.GATEWAY_TIMEOUT,
    };

    const code = codeMap[status] || ErrorCode.INTERNAL_ERROR;

    let message = 'An error occurred';
    let details: Record<string, unknown> | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp.message as string) || message;
      if (resp.details) {
        details = resp.details as Record<string, unknown>;
      }
    }

    return {
      statusCode: status,
      code,
      message,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
      path,
      ...(requestId && { requestId }),
    };
  }

  private createInternalErrorResponse(path: string, requestId?: string): ErrorResponse {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      messageFA: 'خطای غیرمنتظره رخ داد',
      timestamp: new Date().toISOString(),
      path,
      ...(requestId && { requestId }),
    };
  }

  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request: Request
  ): void {
    const logContext = {
      code: errorResponse.code,
      statusCode: errorResponse.statusCode,
      path: request.url,
      method: request.method,
      requestId: errorResponse.requestId,
      userId: (request as any).user?.id,
      tenantId: request.headers['x-tenant-id'],
    };

    // Only log stack traces for 500 errors in development
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${errorResponse.code}] ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : undefined,
        logContext
      );
    } else {
      this.logger.warn(`[${errorResponse.code}] ${errorResponse.message}`, logContext);
    }
  }
}

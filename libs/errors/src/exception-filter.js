/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Global Exception Filter - Catches all errors and normalizes responses
 * ═══════════════════════════════════════════════════════════════════════════
 */
const __decorate =
  (this && this.__decorate) ||
  ((decorators, target, key, desc) => {
    const c = arguments.length;
    let r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc;
    let d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
      r = Reflect.decorate(decorators, target, key, desc);
    } else {
      for (let i = decorators.length - 1; i >= 0; i--) {
        if ((d = decorators[i])) {
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        }
      }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  });
let GlobalExceptionFilter_1;
Object.defineProperty(exports, '__esModule', { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require('@nestjs/common');
const app_error_1 = require('./app-error');
let GlobalExceptionFilter = (GlobalExceptionFilter_1 = class GlobalExceptionFilter {
  constructor() {
    Object.defineProperty(this, 'logger', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new common_1.Logger(GlobalExceptionFilter_1.name),
    });
  }
  catch(exception, host) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const requestId = request.headers['x-request-id'] || undefined;
    const path = request.url;
    const errorResponse = this.buildErrorResponse(exception, path, requestId);
    // Log error (never log stack traces in response)
    this.logError(exception, errorResponse, request);
    response.status(errorResponse.statusCode).json(errorResponse);
  }
  buildErrorResponse(exception, path, requestId) {
    // AppError - our custom errors
    if (exception instanceof app_error_1.AppError) {
      return exception.toResponse(path, requestId);
    }
    // NestJS HttpException
    if (exception instanceof common_1.HttpException) {
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
  handleHttpException(exception, path, requestId) {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    // Map NestJS exceptions to our error codes
    const codeMap = {
      [common_1.HttpStatus.BAD_REQUEST]: app_error_1.ErrorCode.VALIDATION_FAILED,
      [common_1.HttpStatus.UNAUTHORIZED]: app_error_1.ErrorCode.UNAUTHORIZED,
      [common_1.HttpStatus.FORBIDDEN]: app_error_1.ErrorCode.FORBIDDEN,
      [common_1.HttpStatus.NOT_FOUND]: app_error_1.ErrorCode.RESOURCE_NOT_FOUND,
      [common_1.HttpStatus.CONFLICT]: app_error_1.ErrorCode.CONFLICT,
      [common_1.HttpStatus.UNPROCESSABLE_ENTITY]: app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION,
      [common_1.HttpStatus.TOO_MANY_REQUESTS]: app_error_1.ErrorCode.RATE_LIMIT_EXCEEDED,
      [common_1.HttpStatus.INTERNAL_SERVER_ERROR]: app_error_1.ErrorCode.INTERNAL_ERROR,
      [common_1.HttpStatus.BAD_GATEWAY]: app_error_1.ErrorCode.BAD_GATEWAY,
      [common_1.HttpStatus.SERVICE_UNAVAILABLE]: app_error_1.ErrorCode.SERVICE_UNAVAILABLE,
      [common_1.HttpStatus.GATEWAY_TIMEOUT]: app_error_1.ErrorCode.GATEWAY_TIMEOUT,
    };
    const code = codeMap[status] || app_error_1.ErrorCode.INTERNAL_ERROR;
    let message = 'An error occurred';
    let details;
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse;
      message = resp.message || message;
      if (resp.details) {
        details = resp.details;
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
  createInternalErrorResponse(path, requestId) {
    return {
      statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
      code: app_error_1.ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      messageFA: 'خطای غیرمنتظره رخ داد',
      timestamp: new Date().toISOString(),
      path,
      ...(requestId && { requestId }),
    };
  }
  logError(exception, errorResponse, request) {
    const logContext = {
      code: errorResponse.code,
      statusCode: errorResponse.statusCode,
      path: request.url,
      method: request.method,
      requestId: errorResponse.requestId,
      userId: request.user?.id,
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
});
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter =
  GlobalExceptionFilter =
  GlobalExceptionFilter_1 =
    __decorate([(0, common_1.Catch)()], GlobalExceptionFilter);
//# sourceMappingURL=exception-filter.js.map

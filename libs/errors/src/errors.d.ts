/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Concrete Error Classes - One class per HTTP status
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Error Taxonomy:
 * - ValidationError (400): Schema/format validation ONLY
 * - AuthenticationError (401): Identity verification
 * - AuthorizationError (403): Permission/access control
 * - NotFoundError (404): Resource not found
 * - ConflictError (409): Resource state conflicts (duplicate, concurrent modification)
 * - BusinessRuleError (422): Business logic violations
 * - RateLimitError (429): Request throttling
 * - InternalError (500): Infrastructure/system failures
 * - UnavailableError (503): Service temporarily unavailable
 * - DomainError (409): Legacy - use ConflictError or BusinessRuleError
 */
import { HttpStatus } from '@nestjs/common';
import { AppError, ErrorCode } from './app-error';
export declare class ValidationError extends AppError {
  readonly statusCode = HttpStatus.BAD_REQUEST;
  readonly code: ErrorCode;
  constructor(
    message: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  /** Invalid input format/type */
  static invalidInput(field: string, reason: string): ValidationError;
  /** Required field missing */
  static missingField(field: string): ValidationError;
  /** Invalid format (email, phone, etc.) */
  static invalidFormat(field: string, expectedFormat: string): ValidationError;
  /** Schema validation failed (Zod, etc.) */
  static schemaValidationFailed(
    errors: Array<{
      field: string;
      message: string;
    }>
  ): ValidationError;
}
export declare class AuthenticationError extends AppError {
  readonly statusCode = HttpStatus.UNAUTHORIZED;
  readonly code: ErrorCode;
  constructor(
    message?: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  static invalidCredentials(): AuthenticationError;
  static tokenExpired(): AuthenticationError;
  static tokenInvalid(): AuthenticationError;
  static sessionExpired(): AuthenticationError;
}
export declare class AuthorizationError extends AppError {
  readonly statusCode = HttpStatus.FORBIDDEN;
  readonly code: ErrorCode;
  constructor(
    message?: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  static insufficientPermissions(requiredPermission: string): AuthorizationError;
  static resourceAccessDenied(resource: string): AuthorizationError;
  static tenantAccessDenied(tenantId: string): AuthorizationError;
}
export declare class NotFoundError extends AppError {
  readonly statusCode = HttpStatus.NOT_FOUND;
  readonly code = ErrorCode.RESOURCE_NOT_FOUND;
  constructor(message: string, messageFA?: string, details?: Record<string, unknown>);
  static resource(resource: string, identifier: string): NotFoundError;
  static byId(resource: string, id: string): NotFoundError;
}
export declare class ConflictError extends AppError {
  readonly statusCode = HttpStatus.CONFLICT;
  readonly code: ErrorCode;
  constructor(
    message: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  /** Resource already exists */
  static resourceExists(resource: string, identifier: string): ConflictError;
  /** Optimistic locking failure */
  static optimisticLockFailed(resource: string): ConflictError;
  /** Generic conflict */
  static conflict(reason: string, messageFA?: string): ConflictError;
}
export declare class BusinessRuleError extends AppError {
  readonly statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
  readonly code: ErrorCode;
  constructor(
    message: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  /** Generic business rule violation */
  static violation(rule: string, messageFA?: string): BusinessRuleError;
  /** Invalid state transition */
  static invalidStateTransition(from: string, to: string, entity: string): BusinessRuleError;
  /** Insufficient balance/credit */
  static insufficientBalance(
    accountId: string,
    required: number,
    available: number
  ): BusinessRuleError;
  /** Minimum amount not met */
  static minimumAmountNotMet(field: string, minimum: number, currency: string): BusinessRuleError;
  /** Maximum limit exceeded */
  static maximumLimitExceeded(field: string, maximum: number, unit?: string): BusinessRuleError;
  /** Credit limit exceeded */
  static creditLimitExceeded(
    customerId: string,
    limit: number,
    requested: number
  ): BusinessRuleError;
  /** Order cannot be modified */
  static orderNotModifiable(orderId: string, currentStatus: string): BusinessRuleError;
  /** Inventory insufficient */
  static insufficientInventory(
    productId: string,
    requested: number,
    available: number
  ): BusinessRuleError;
}
/**
 * @deprecated Use ConflictError for resource conflicts or BusinessRuleError for business logic
 */
export declare class DomainError extends AppError {
  readonly statusCode = HttpStatus.CONFLICT;
  readonly code: ErrorCode;
  constructor(
    message: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  /** @deprecated Use ConflictError.resourceExists() */
  static resourceExists(resource: string, identifier: string): DomainError;
  /** @deprecated Use ConflictError.optimisticLockFailed() */
  static optimisticLockFailed(resource: string): DomainError;
  /** @deprecated Use BusinessRuleError.violation() */
  static businessRuleViolation(rule: string, messageFA?: string): DomainError;
  /** @deprecated Use BusinessRuleError.invalidStateTransition() */
  static invalidStateTransition(from: string, to: string, entity: string): DomainError;
  /** @deprecated Use BusinessRuleError.insufficientBalance() */
  static insufficientBalance(accountId: string, required: number, available: number): DomainError;
  /** @deprecated Use BusinessRuleError.minimumAmountNotMet() */
  static minimumAmountNotMet(field: string, minimum: number, currency: string): DomainError;
}
export declare class RateLimitError extends AppError {
  readonly statusCode = HttpStatus.TOO_MANY_REQUESTS;
  readonly code = ErrorCode.RATE_LIMIT_EXCEEDED;
  constructor(message?: string, messageFA?: string, details?: Record<string, unknown>);
  static tooManyRequests(retryAfterSeconds?: number): RateLimitError;
  static quotaExceeded(resource: string, limit: number): RateLimitError;
}
export declare class InternalError extends AppError {
  readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  readonly code: ErrorCode;
  constructor(
    message?: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  /** Database operation failed */
  static database(operation: string): InternalError;
  /** External service unavailable */
  static externalService(service: string): InternalError;
  /** Transaction timeout */
  static transactionTimeout(timeoutMs: number): InternalError;
  /** Unknown/catch-all error */
  static unknown(context?: string): InternalError;
  /** Configuration error */
  static configuration(setting: string): InternalError;
}
export declare class UnavailableError extends AppError {
  readonly statusCode = HttpStatus.SERVICE_UNAVAILABLE;
  readonly code: ErrorCode;
  constructor(
    message?: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  static serviceUnavailable(service?: string, retryAfterSeconds?: number): UnavailableError;
  static maintenanceMode(estimatedEndTime?: string): UnavailableError;
  /** Circuit breaker is open - service temporarily blocked */
  static circuitBreakerOpen(service: string, resetAfterMs?: number): UnavailableError;
  /** Dependency service unavailable */
  static dependencyUnavailable(dependency: string): UnavailableError;
}
export declare class BadGatewayError extends AppError {
  readonly statusCode = HttpStatus.BAD_GATEWAY;
  readonly code: ErrorCode;
  constructor(
    message?: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  /** Upstream service returned invalid response */
  static invalidUpstreamResponse(service: string, reason?: string): BadGatewayError;
  /** Upstream service connection failed */
  static upstreamConnectionFailed(service: string): BadGatewayError;
  /** Payment gateway error */
  static paymentGatewayError(gateway: string, errorCode?: string): BadGatewayError;
}
export declare class GatewayTimeoutError extends AppError {
  readonly statusCode = HttpStatus.GATEWAY_TIMEOUT;
  readonly code: ErrorCode;
  constructor(
    message?: string,
    messageFA?: string,
    details?: Record<string, unknown>,
    code?: ErrorCode
  );
  /** Upstream service timed out */
  static upstreamTimeout(service: string, timeoutMs: number): GatewayTimeoutError;
  /** Database query timeout */
  static databaseTimeout(operation: string, timeoutMs: number): GatewayTimeoutError;
  /** External API timeout */
  static externalApiTimeout(api: string, timeoutMs: number): GatewayTimeoutError;
}
//# sourceMappingURL=errors.d.ts.map

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Unified Error System
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for all application errors.
 * Every error maps to exactly one HTTP status code.
 * Same failure always produces the same response.
 *
 * Error Categories:
 * - ValidationError (400): Schema/format validation failures
 * - AuthenticationError (401): Identity verification failures
 * - AuthorizationError (403): Permission/access failures
 * - NotFoundError (404): Resource not found
 * - DomainError (409): Business rule violations, conflicts
 * - RateLimitError (429): Too many requests
 * - InternalError (500): Infrastructure/system failures
 * - UnavailableError (503): Service temporarily unavailable
 */
import type { HttpStatus } from '@nestjs/common';
export declare enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID = 'MFA_INVALID',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',
  TENANT_ACCESS_DENIED = 'TENANT_ACCESS_DENIED',
  IP_BLOCKED = 'IP_BLOCKED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  OPTIMISTIC_LOCK_FAILED = 'OPTIMISTIC_LOCK_FAILED',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  MINIMUM_AMOUNT_NOT_MET = 'MINIMUM_AMOUNT_NOT_MET',
  MAXIMUM_LIMIT_EXCEEDED = 'MAXIMUM_LIMIT_EXCEEDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_VERIFICATION_FAILED = 'PAYMENT_VERIFICATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  CACHE_ERROR = 'CACHE_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
  BAD_GATEWAY = 'BAD_GATEWAY',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
}
export interface ErrorResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  messageFA?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  path?: string;
  requestId?: string;
}
export declare abstract class AppError extends Error {
  abstract readonly statusCode: HttpStatus;
  abstract readonly code: ErrorCode;
  readonly messageFA?: string;
  readonly details?: Record<string, unknown>;
  constructor(message: string, messageFA?: string, details?: Record<string, unknown>);
  toResponse(path?: string, requestId?: string): ErrorResponse;
}
//# sourceMappingURL=app-error.d.ts.map

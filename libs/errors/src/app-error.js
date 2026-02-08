"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.ErrorCode = void 0;
// ═══════════════════════════════════════════════════════════════════════════
// Error Codes - Unique identifiers for each error type
// ═══════════════════════════════════════════════════════════════════════════
var ErrorCode;
(function (ErrorCode) {
    // Validation (400) - Schema/format errors only
    ErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    // Authentication (401)
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["TOKEN_INVALID"] = "TOKEN_INVALID";
    ErrorCode["SESSION_EXPIRED"] = "SESSION_EXPIRED";
    ErrorCode["MFA_REQUIRED"] = "MFA_REQUIRED";
    ErrorCode["MFA_INVALID"] = "MFA_INVALID";
    // Forbidden (403)
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    ErrorCode["RESOURCE_ACCESS_DENIED"] = "RESOURCE_ACCESS_DENIED";
    ErrorCode["TENANT_ACCESS_DENIED"] = "TENANT_ACCESS_DENIED";
    ErrorCode["IP_BLOCKED"] = "IP_BLOCKED";
    // Not Found (404)
    ErrorCode["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ErrorCode["ROUTE_NOT_FOUND"] = "ROUTE_NOT_FOUND";
    // Conflict (409) - Resource conflicts
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["RESOURCE_EXISTS"] = "RESOURCE_EXISTS";
    ErrorCode["OPTIMISTIC_LOCK_FAILED"] = "OPTIMISTIC_LOCK_FAILED";
    ErrorCode["IDEMPOTENCY_CONFLICT"] = "IDEMPOTENCY_CONFLICT";
    // Business Rule (422) - Business logic violations
    ErrorCode["BUSINESS_RULE_VIOLATION"] = "BUSINESS_RULE_VIOLATION";
    ErrorCode["INVALID_STATE_TRANSITION"] = "INVALID_STATE_TRANSITION";
    ErrorCode["INSUFFICIENT_BALANCE"] = "INSUFFICIENT_BALANCE";
    ErrorCode["MINIMUM_AMOUNT_NOT_MET"] = "MINIMUM_AMOUNT_NOT_MET";
    ErrorCode["MAXIMUM_LIMIT_EXCEEDED"] = "MAXIMUM_LIMIT_EXCEEDED";
    ErrorCode["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    ErrorCode["PAYMENT_VERIFICATION_FAILED"] = "PAYMENT_VERIFICATION_FAILED";
    // Rate Limit (429)
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["QUOTA_EXCEEDED"] = "QUOTA_EXCEEDED";
    // Internal (500) - Infrastructure/system errors
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["TRANSACTION_TIMEOUT"] = "TRANSACTION_TIMEOUT";
    ErrorCode["CACHE_ERROR"] = "CACHE_ERROR";
    ErrorCode["QUEUE_ERROR"] = "QUEUE_ERROR";
    // Bad Gateway (502) - Upstream service errors
    ErrorCode["BAD_GATEWAY"] = "BAD_GATEWAY";
    ErrorCode["UPSTREAM_ERROR"] = "UPSTREAM_ERROR";
    // Service Unavailable (503)
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["MAINTENANCE_MODE"] = "MAINTENANCE_MODE";
    ErrorCode["CIRCUIT_BREAKER_OPEN"] = "CIRCUIT_BREAKER_OPEN";
    ErrorCode["DEPENDENCY_UNAVAILABLE"] = "DEPENDENCY_UNAVAILABLE";
    // Gateway Timeout (504)
    ErrorCode["GATEWAY_TIMEOUT"] = "GATEWAY_TIMEOUT";
    ErrorCode["UPSTREAM_TIMEOUT"] = "UPSTREAM_TIMEOUT";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// ═══════════════════════════════════════════════════════════════════════════
// Base AppError Class
// ═══════════════════════════════════════════════════════════════════════════
class AppError extends Error {
    constructor(message, messageFA, details) {
        super(message);
        Object.defineProperty(this, "messageFA", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "details", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = this.constructor.name;
        this.messageFA = messageFA;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
    toResponse(path, requestId) {
        return {
            statusCode: this.statusCode,
            code: this.code,
            message: this.message,
            ...(this.messageFA && { messageFA: this.messageFA }),
            ...(this.details && { details: this.details }),
            timestamp: new Date().toISOString(),
            ...(path && { path }),
            ...(requestId && { requestId }),
        };
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app-error.js.map
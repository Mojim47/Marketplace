"use strict";
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @nextgen/errors - Unified Error Handling
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for all application errors.
 *
 * Error Taxonomy:
 * - ValidationError (400): Schema/format validation ONLY
 * - AuthenticationError (401): Identity verification
 * - AuthorizationError (403): Permission/access control
 * - NotFoundError (404): Resource not found
 * - ConflictError (409): Resource state conflicts
 * - BusinessRuleError (422): Business logic violations
 * - RateLimitError (429): Request throttling
 * - InternalError (500): Infrastructure/system failures
 * - UnavailableError (503): Service temporarily unavailable
 *
 * Usage:
 *   // Validation (400) - Schema/format errors ONLY
 *   throw ValidationError.invalidInput('email', 'must be valid email format');
 *   throw ValidationError.missingField('password');
 *   throw ValidationError.schemaValidationFailed(zodErrors);
 *
 *   // Authentication (401)
 *   throw AuthenticationError.invalidCredentials();
 *   throw AuthenticationError.tokenExpired();
 *
 *   // Authorization (403)
 *   throw AuthorizationError.insufficientPermissions('orders.write');
 *
 *   // Not Found (404)
 *   throw NotFoundError.resource('User', 'user@example.com');
 *   throw NotFoundError.byId('Order', 'ord-123');
 *
 *   // Conflict (409) - Resource state conflicts
 *   throw ConflictError.resourceExists('User', 'user@example.com');
 *   throw ConflictError.optimisticLockFailed('Product');
 *
 *   // Business Rules (422) - Business logic violations
 *   throw BusinessRuleError.violation('Order total exceeds credit limit');
 *   throw BusinessRuleError.minimumAmountNotMet('amount', 1000, 'Rials');
 *   throw BusinessRuleError.insufficientBalance(accountId, required, available);
 *   throw BusinessRuleError.insufficientInventory(productId, requested, available);
 *   throw BusinessRuleError.invalidStateTransition('pending', 'shipped', 'Order');
 *
 *   // Rate Limit (429)
 *   throw RateLimitError.tooManyRequests(60);
 *   throw RateLimitError.quotaExceeded('API calls', 1000);
 *
 *   // Internal (500) - Infrastructure errors
 *   throw InternalError.database('insert');
 *   throw InternalError.transactionTimeout(30000);
 *   throw InternalError.unknown('payment processing');
 *
 *   // Unavailable (503)
 *   throw UnavailableError.serviceUnavailable('Payment Gateway');
 *   throw UnavailableError.maintenanceMode('2024-01-15T10:00:00Z');
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorInvariantEnforcer = exports.PaymentInvariantEnforcer = exports.AuthInvariantEnforcer = exports.InvariantEnforcer = exports.SYSTEM_SAFETY_STATUS = exports.DETECTION_POINTS = exports.KILL_SWITCH_CONDITIONS = exports.ERROR_CODE_STATUS_MAP = exports.ERROR_INVARIANTS = exports.PAYMENT_INVARIANTS = exports.AUTH_INVARIANTS = exports.GlobalExceptionFilter = exports.GatewayTimeoutError = exports.BadGatewayError = exports.UnavailableError = exports.InternalError = exports.RateLimitError = exports.DomainError = exports.BusinessRuleError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ErrorCode = exports.AppError = void 0;
var app_error_1 = require("./app-error");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return app_error_1.AppError; } });
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return app_error_1.ErrorCode; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return errors_1.AuthenticationError; } });
Object.defineProperty(exports, "AuthorizationError", { enumerable: true, get: function () { return errors_1.AuthorizationError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return errors_1.NotFoundError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return errors_1.ConflictError; } });
Object.defineProperty(exports, "BusinessRuleError", { enumerable: true, get: function () { return errors_1.BusinessRuleError; } });
Object.defineProperty(exports, "DomainError", { enumerable: true, get: function () { return errors_1.DomainError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return errors_1.RateLimitError; } });
Object.defineProperty(exports, "InternalError", { enumerable: true, get: function () { return errors_1.InternalError; } });
Object.defineProperty(exports, "UnavailableError", { enumerable: true, get: function () { return errors_1.UnavailableError; } });
Object.defineProperty(exports, "BadGatewayError", { enumerable: true, get: function () { return errors_1.BadGatewayError; } });
Object.defineProperty(exports, "GatewayTimeoutError", { enumerable: true, get: function () { return errors_1.GatewayTimeoutError; } });
var exception_filter_1 = require("./exception-filter");
Object.defineProperty(exports, "GlobalExceptionFilter", { enumerable: true, get: function () { return exception_filter_1.GlobalExceptionFilter; } });
// Invariants - Hard constraints for system correctness
var invariants_1 = require("./invariants");
Object.defineProperty(exports, "AUTH_INVARIANTS", { enumerable: true, get: function () { return invariants_1.AUTH_INVARIANTS; } });
Object.defineProperty(exports, "PAYMENT_INVARIANTS", { enumerable: true, get: function () { return invariants_1.PAYMENT_INVARIANTS; } });
Object.defineProperty(exports, "ERROR_INVARIANTS", { enumerable: true, get: function () { return invariants_1.ERROR_INVARIANTS; } });
Object.defineProperty(exports, "ERROR_CODE_STATUS_MAP", { enumerable: true, get: function () { return invariants_1.ERROR_CODE_STATUS_MAP; } });
Object.defineProperty(exports, "KILL_SWITCH_CONDITIONS", { enumerable: true, get: function () { return invariants_1.KILL_SWITCH_CONDITIONS; } });
Object.defineProperty(exports, "DETECTION_POINTS", { enumerable: true, get: function () { return invariants_1.DETECTION_POINTS; } });
Object.defineProperty(exports, "SYSTEM_SAFETY_STATUS", { enumerable: true, get: function () { return invariants_1.SYSTEM_SAFETY_STATUS; } });
// Invariant Enforcer - Runtime enforcement of invariants
var invariant_enforcer_1 = require("./invariant-enforcer");
Object.defineProperty(exports, "InvariantEnforcer", { enumerable: true, get: function () { return invariant_enforcer_1.InvariantEnforcer; } });
Object.defineProperty(exports, "AuthInvariantEnforcer", { enumerable: true, get: function () { return invariant_enforcer_1.AuthInvariantEnforcer; } });
Object.defineProperty(exports, "PaymentInvariantEnforcer", { enumerable: true, get: function () { return invariant_enforcer_1.PaymentInvariantEnforcer; } });
Object.defineProperty(exports, "ErrorInvariantEnforcer", { enumerable: true, get: function () { return invariant_enforcer_1.ErrorInvariantEnforcer; } });
//# sourceMappingURL=index.js.map
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
export { AppError, ErrorCode, type ErrorResponse } from './app-error';
export {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  DomainError, // Legacy - deprecated
  RateLimitError,
  InternalError,
  UnavailableError,
  BadGatewayError,
  GatewayTimeoutError,
} from './errors';
export { GlobalExceptionFilter } from './exception-filter';
export {
  AUTH_INVARIANTS,
  PAYMENT_INVARIANTS,
  ERROR_INVARIANTS,
  ERROR_CODE_STATUS_MAP,
  KILL_SWITCH_CONDITIONS,
  DETECTION_POINTS,
  SYSTEM_SAFETY_STATUS,
} from './invariants';
export {
  InvariantEnforcer,
  AuthInvariantEnforcer,
  PaymentInvariantEnforcer,
  ErrorInvariantEnforcer,
} from './invariant-enforcer';
//# sourceMappingURL=index.d.ts.map

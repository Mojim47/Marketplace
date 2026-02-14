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
Object.defineProperty(exports, '__esModule', { value: true });
exports.GatewayTimeoutError =
  exports.BadGatewayError =
  exports.UnavailableError =
  exports.InternalError =
  exports.RateLimitError =
  exports.DomainError =
  exports.BusinessRuleError =
  exports.ConflictError =
  exports.NotFoundError =
  exports.AuthorizationError =
  exports.AuthenticationError =
  exports.ValidationError =
    void 0;
const common_1 = require('@nestjs/common');
const app_error_1 = require('./app-error');
// ═══════════════════════════════════════════════════════════════════════════
// 400 - Validation Error (Schema/Format ONLY)
// ═══════════════════════════════════════════════════════════════════════════
class ValidationError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.VALIDATION_FAILED) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.BAD_REQUEST,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  /** Invalid input format/type */
  static invalidInput(field, reason) {
    return new ValidationError(
      `Invalid input for ${field}: ${reason}`,
      `ورودی نامعتبر برای ${field}`,
      { field, reason },
      app_error_1.ErrorCode.INVALID_INPUT
    );
  }
  /** Required field missing */
  static missingField(field) {
    return new ValidationError(
      `Missing required field: ${field}`,
      `فیلد الزامی وارد نشده: ${field}`,
      { field },
      app_error_1.ErrorCode.MISSING_REQUIRED_FIELD
    );
  }
  /** Invalid format (email, phone, etc.) */
  static invalidFormat(field, expectedFormat) {
    return new ValidationError(
      `Invalid format for ${field}. Expected: ${expectedFormat}`,
      `فرمت نامعتبر برای ${field}`,
      { field, expectedFormat },
      app_error_1.ErrorCode.INVALID_FORMAT
    );
  }
  /** Schema validation failed (Zod, etc.) */
  static schemaValidationFailed(errors) {
    return new ValidationError(
      'Schema validation failed',
      'اعتبارسنجی ناموفق بود',
      { errors },
      app_error_1.ErrorCode.VALIDATION_FAILED
    );
  }
}
exports.ValidationError = ValidationError;
// ═══════════════════════════════════════════════════════════════════════════
// 401 - Authentication Error
// ═══════════════════════════════════════════════════════════════════════════
class AuthenticationError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.UNAUTHORIZED) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.UNAUTHORIZED,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  static invalidCredentials() {
    return new AuthenticationError(
      'Invalid email or password',
      'ایمیل یا رمز عبور نادرست است',
      undefined,
      app_error_1.ErrorCode.INVALID_CREDENTIALS
    );
  }
  static tokenExpired() {
    return new AuthenticationError(
      'Token has expired',
      'توکن منقضی شده است',
      undefined,
      app_error_1.ErrorCode.TOKEN_EXPIRED
    );
  }
  static tokenInvalid() {
    return new AuthenticationError(
      'Invalid token',
      'توکن نامعتبر است',
      undefined,
      app_error_1.ErrorCode.TOKEN_INVALID
    );
  }
  static sessionExpired() {
    return new AuthenticationError(
      'Session has expired',
      'نشست منقضی شده است',
      undefined,
      app_error_1.ErrorCode.SESSION_EXPIRED
    );
  }
}
exports.AuthenticationError = AuthenticationError;
// ═══════════════════════════════════════════════════════════════════════════
// 403 - Authorization Error
// ═══════════════════════════════════════════════════════════════════════════
class AuthorizationError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.FORBIDDEN) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.FORBIDDEN,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  static insufficientPermissions(requiredPermission) {
    return new AuthorizationError(
      `Insufficient permissions. Required: ${requiredPermission}`,
      'سطح دسترسی کافی نیست',
      { requiredPermission },
      app_error_1.ErrorCode.INSUFFICIENT_PERMISSIONS
    );
  }
  static resourceAccessDenied(resource) {
    return new AuthorizationError(
      `Access denied to resource: ${resource}`,
      'دسترسی به این منبع مجاز نیست',
      { resource },
      app_error_1.ErrorCode.RESOURCE_ACCESS_DENIED
    );
  }
  static tenantAccessDenied(tenantId) {
    return new AuthorizationError(
      'Access denied to this tenant',
      'دسترسی به این سازمان مجاز نیست',
      { tenantId },
      app_error_1.ErrorCode.TENANT_ACCESS_DENIED
    );
  }
}
exports.AuthorizationError = AuthorizationError;
// ═══════════════════════════════════════════════════════════════════════════
// 404 - Not Found Error
// ═══════════════════════════════════════════════════════════════════════════
class NotFoundError extends app_error_1.AppError {
  constructor(message, messageFA, details) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.NOT_FOUND,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: app_error_1.ErrorCode.RESOURCE_NOT_FOUND,
    });
  }
  static resource(resource, identifier) {
    return new NotFoundError(`${resource} not found: ${identifier}`, `${resource} یافت نشد`, {
      resource,
      identifier,
    });
  }
  static byId(resource, id) {
    return new NotFoundError(
      `${resource} with ID ${id} not found`,
      `${resource} با شناسه ${id} یافت نشد`,
      { resource, id }
    );
  }
}
exports.NotFoundError = NotFoundError;
// ═══════════════════════════════════════════════════════════════════════════
// 409 - Conflict Error (Resource State Conflicts)
// ═══════════════════════════════════════════════════════════════════════════
class ConflictError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.CONFLICT) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.CONFLICT,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  /** Resource already exists */
  static resourceExists(resource, identifier) {
    return new ConflictError(
      `${resource} already exists: ${identifier}`,
      `${resource} از قبل وجود دارد`,
      { resource, identifier },
      app_error_1.ErrorCode.RESOURCE_EXISTS
    );
  }
  /** Optimistic locking failure */
  static optimisticLockFailed(resource) {
    return new ConflictError(
      `Concurrent modification detected for ${resource}`,
      'تغییر همزمان شناسایی شد. لطفاً دوباره تلاش کنید',
      { resource },
      app_error_1.ErrorCode.OPTIMISTIC_LOCK_FAILED
    );
  }
  /** Generic conflict */
  static conflict(reason, messageFA) {
    return new ConflictError(
      `Conflict: ${reason}`,
      messageFA || 'تداخل در عملیات',
      { reason },
      app_error_1.ErrorCode.CONFLICT
    );
  }
}
exports.ConflictError = ConflictError;
// ═══════════════════════════════════════════════════════════════════════════
// 422 - Business Rule Error (Business Logic Violations)
// ═══════════════════════════════════════════════════════════════════════════
class BusinessRuleError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  /** Generic business rule violation */
  static violation(rule, messageFA) {
    return new BusinessRuleError(
      `Business rule violation: ${rule}`,
      messageFA || 'قانون کسب‌وکار نقض شده است',
      { rule },
      app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
  /** Invalid state transition */
  static invalidStateTransition(from, to, entity) {
    return new BusinessRuleError(
      `Invalid state transition from ${from} to ${to} for ${entity}`,
      'تغییر وضعیت نامعتبر است',
      { from, to, entity },
      app_error_1.ErrorCode.INVALID_STATE_TRANSITION
    );
  }
  /** Insufficient balance/credit */
  static insufficientBalance(accountId, required, available) {
    return new BusinessRuleError(
      `Insufficient balance in account ${accountId}`,
      'موجودی کافی نیست',
      { accountId, required, available },
      app_error_1.ErrorCode.INSUFFICIENT_BALANCE
    );
  }
  /** Minimum amount not met */
  static minimumAmountNotMet(field, minimum, currency) {
    return new BusinessRuleError(
      `${field} must be at least ${minimum} ${currency}`,
      `${field} باید حداقل ${minimum} ${currency} باشد`,
      { field, minimum, currency },
      app_error_1.ErrorCode.MINIMUM_AMOUNT_NOT_MET
    );
  }
  /** Maximum limit exceeded */
  static maximumLimitExceeded(field, maximum, unit) {
    return new BusinessRuleError(
      `${field} exceeds maximum limit of ${maximum}${unit ? ` ${unit}` : ''}`,
      `${field} از حداکثر مجاز ${maximum}${unit ? ` ${unit}` : ''} بیشتر است`,
      { field, maximum, unit },
      app_error_1.ErrorCode.MAXIMUM_LIMIT_EXCEEDED
    );
  }
  /** Credit limit exceeded */
  static creditLimitExceeded(customerId, limit, requested) {
    return new BusinessRuleError(
      `Credit limit exceeded for customer ${customerId}`,
      'سقف اعتبار مشتری تمام شده است',
      { customerId, limit, requested },
      app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
  /** Order cannot be modified */
  static orderNotModifiable(orderId, currentStatus) {
    return new BusinessRuleError(
      `Order ${orderId} cannot be modified in ${currentStatus} status`,
      'سفارش در این وضعیت قابل تغییر نیست',
      { orderId, currentStatus },
      app_error_1.ErrorCode.INVALID_STATE_TRANSITION
    );
  }
  /** Inventory insufficient */
  static insufficientInventory(productId, requested, available) {
    return new BusinessRuleError(
      `Insufficient inventory for product ${productId}`,
      'موجودی انبار کافی نیست',
      { productId, requested, available },
      app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
}
exports.BusinessRuleError = BusinessRuleError;
// ═══════════════════════════════════════════════════════════════════════════
// 409 - Domain Error (Legacy - Use ConflictError or BusinessRuleError)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @deprecated Use ConflictError for resource conflicts or BusinessRuleError for business logic
 */
class DomainError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.CONFLICT) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.CONFLICT,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  /** @deprecated Use ConflictError.resourceExists() */
  static resourceExists(resource, identifier) {
    return new DomainError(
      `${resource} already exists: ${identifier}`,
      `${resource} از قبل وجود دارد`,
      { resource, identifier },
      app_error_1.ErrorCode.RESOURCE_EXISTS
    );
  }
  /** @deprecated Use ConflictError.optimisticLockFailed() */
  static optimisticLockFailed(resource) {
    return new DomainError(
      `Concurrent modification detected for ${resource}`,
      'تغییر همزمان شناسایی شد. لطفاً دوباره تلاش کنید',
      { resource },
      app_error_1.ErrorCode.OPTIMISTIC_LOCK_FAILED
    );
  }
  /** @deprecated Use BusinessRuleError.violation() */
  static businessRuleViolation(rule, messageFA) {
    return new DomainError(
      `Business rule violation: ${rule}`,
      messageFA || 'قانون کسب‌وکار نقض شده است',
      { rule },
      app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
  /** @deprecated Use BusinessRuleError.invalidStateTransition() */
  static invalidStateTransition(from, to, entity) {
    return new DomainError(
      `Invalid state transition from ${from} to ${to} for ${entity}`,
      'تغییر وضعیت نامعتبر است',
      { from, to, entity },
      app_error_1.ErrorCode.INVALID_STATE_TRANSITION
    );
  }
  /** @deprecated Use BusinessRuleError.insufficientBalance() */
  static insufficientBalance(accountId, required, available) {
    return new DomainError(
      `Insufficient balance in account ${accountId}`,
      'موجودی کافی نیست',
      { accountId, required, available },
      app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
  /** @deprecated Use BusinessRuleError.minimumAmountNotMet() */
  static minimumAmountNotMet(field, minimum, currency) {
    return new DomainError(
      `${field} must be at least ${minimum} ${currency}`,
      `${field} باید حداقل ${minimum} ${currency} باشد`,
      { field, minimum, currency },
      app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
}
exports.DomainError = DomainError;
// ═══════════════════════════════════════════════════════════════════════════
// 429 - Rate Limit Error
// ═══════════════════════════════════════════════════════════════════════════
class RateLimitError extends app_error_1.AppError {
  constructor(message, messageFA, details) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.TOO_MANY_REQUESTS,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: app_error_1.ErrorCode.RATE_LIMIT_EXCEEDED,
    });
  }
  static tooManyRequests(retryAfterSeconds) {
    return new RateLimitError(
      'Too many requests. Please try again later.',
      'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید',
      retryAfterSeconds ? { retryAfterSeconds } : undefined
    );
  }
  static quotaExceeded(resource, limit) {
    return new RateLimitError(
      `Quota exceeded for ${resource}. Limit: ${limit}`,
      `سهمیه ${resource} تمام شده است`,
      { resource, limit }
    );
  }
}
exports.RateLimitError = RateLimitError;
// ═══════════════════════════════════════════════════════════════════════════
// 500 - Internal Error (Infrastructure/System)
// ═══════════════════════════════════════════════════════════════════════════
class InternalError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.INTERNAL_ERROR) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  /** Database operation failed */
  static database(operation) {
    return new InternalError(
      'Database operation failed',
      'خطا در عملیات پایگاه داده',
      { operation },
      app_error_1.ErrorCode.DATABASE_ERROR
    );
  }
  /** External service unavailable */
  static externalService(service) {
    return new InternalError(
      `External service unavailable: ${service}`,
      'سرویس خارجی در دسترس نیست',
      { service },
      app_error_1.ErrorCode.EXTERNAL_SERVICE_ERROR
    );
  }
  /** Transaction timeout */
  static transactionTimeout(timeoutMs) {
    return new InternalError(
      `Transaction timed out after ${timeoutMs}ms`,
      `تراکنش پس از ${timeoutMs}ms منقضی شد`,
      { timeoutMs },
      app_error_1.ErrorCode.TRANSACTION_TIMEOUT
    );
  }
  /** Unknown/catch-all error */
  static unknown(context) {
    return new InternalError(
      'An unexpected error occurred',
      'خطای غیرمنتظره رخ داد',
      context ? { context } : undefined,
      app_error_1.ErrorCode.INTERNAL_ERROR
    );
  }
  /** Configuration error */
  static configuration(setting) {
    return new InternalError(
      `Configuration error: ${setting}`,
      'خطای پیکربندی سیستم',
      { setting },
      app_error_1.ErrorCode.INTERNAL_ERROR
    );
  }
}
exports.InternalError = InternalError;
// ═══════════════════════════════════════════════════════════════════════════
// 503 - Service Unavailable Error
// ═══════════════════════════════════════════════════════════════════════════
class UnavailableError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.SERVICE_UNAVAILABLE) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.SERVICE_UNAVAILABLE,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  static serviceUnavailable(service, retryAfterSeconds) {
    return new UnavailableError(
      service ? `${service} is temporarily unavailable` : 'Service temporarily unavailable',
      'سرویس موقتاً در دسترس نیست',
      { ...(service && { service }), ...(retryAfterSeconds && { retryAfterSeconds }) },
      app_error_1.ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  static maintenanceMode(estimatedEndTime) {
    return new UnavailableError(
      'System is under maintenance',
      'سیستم در حال تعمیر و نگهداری است',
      estimatedEndTime ? { estimatedEndTime } : undefined,
      app_error_1.ErrorCode.MAINTENANCE_MODE
    );
  }
  /** Circuit breaker is open - service temporarily blocked */
  static circuitBreakerOpen(service, resetAfterMs) {
    return new UnavailableError(
      `Circuit breaker open for ${service}. Service temporarily blocked.`,
      `سرویس ${service} موقتاً مسدود شده است`,
      { service, ...(resetAfterMs && { resetAfterMs }) },
      app_error_1.ErrorCode.CIRCUIT_BREAKER_OPEN
    );
  }
  /** Dependency service unavailable */
  static dependencyUnavailable(dependency) {
    return new UnavailableError(
      `Required dependency unavailable: ${dependency}`,
      `سرویس وابسته در دسترس نیست: ${dependency}`,
      { dependency },
      app_error_1.ErrorCode.DEPENDENCY_UNAVAILABLE
    );
  }
}
exports.UnavailableError = UnavailableError;
// ═══════════════════════════════════════════════════════════════════════════
// 502 - Bad Gateway Error (Upstream Service Errors)
// ═══════════════════════════════════════════════════════════════════════════
class BadGatewayError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.BAD_GATEWAY) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.BAD_GATEWAY,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  /** Upstream service returned invalid response */
  static invalidUpstreamResponse(service, reason) {
    return new BadGatewayError(
      `Invalid response from upstream service: ${service}${reason ? ` - ${reason}` : ''}`,
      `پاسخ نامعتبر از سرویس ${service}`,
      { service, ...(reason && { reason }) },
      app_error_1.ErrorCode.UPSTREAM_ERROR
    );
  }
  /** Upstream service connection failed */
  static upstreamConnectionFailed(service) {
    return new BadGatewayError(
      `Failed to connect to upstream service: ${service}`,
      `خطا در اتصال به سرویس ${service}`,
      { service },
      app_error_1.ErrorCode.BAD_GATEWAY
    );
  }
  /** Payment gateway error */
  static paymentGatewayError(gateway, errorCode) {
    return new BadGatewayError(
      `Payment gateway error: ${gateway}`,
      `خطا در درگاه پرداخت ${gateway}`,
      { gateway, ...(errorCode && { gatewayErrorCode: errorCode }) },
      app_error_1.ErrorCode.UPSTREAM_ERROR
    );
  }
}
exports.BadGatewayError = BadGatewayError;
// ═══════════════════════════════════════════════════════════════════════════
// 504 - Gateway Timeout Error
// ═══════════════════════════════════════════════════════════════════════════
class GatewayTimeoutError extends app_error_1.AppError {
  constructor(message, messageFA, details, code = app_error_1.ErrorCode.GATEWAY_TIMEOUT) {
    super(message, messageFA, details);
    Object.defineProperty(this, 'statusCode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: common_1.HttpStatus.GATEWAY_TIMEOUT,
    });
    Object.defineProperty(this, 'code', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.code = code;
  }
  /** Upstream service timed out */
  static upstreamTimeout(service, timeoutMs) {
    return new GatewayTimeoutError(
      `Upstream service ${service} timed out after ${timeoutMs}ms`,
      `زمان انتظار سرویس ${service} به پایان رسید`,
      { service, timeoutMs },
      app_error_1.ErrorCode.UPSTREAM_TIMEOUT
    );
  }
  /** Database query timeout */
  static databaseTimeout(operation, timeoutMs) {
    return new GatewayTimeoutError(
      `Database operation ${operation} timed out after ${timeoutMs}ms`,
      'عملیات پایگاه داده به پایان رسید',
      { operation, timeoutMs },
      app_error_1.ErrorCode.GATEWAY_TIMEOUT
    );
  }
  /** External API timeout */
  static externalApiTimeout(api, timeoutMs) {
    return new GatewayTimeoutError(
      `External API ${api} timed out after ${timeoutMs}ms`,
      'زمان انتظار API خارجی به پایان رسید',
      { api, timeoutMs },
      app_error_1.ErrorCode.UPSTREAM_TIMEOUT
    );
  }
}
exports.GatewayTimeoutError = GatewayTimeoutError;
//# sourceMappingURL=errors.js.map

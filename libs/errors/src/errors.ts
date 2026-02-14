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

// ═══════════════════════════════════════════════════════════════════════════
// 400 - Validation Error (Schema/Format ONLY)
// ═══════════════════════════════════════════════════════════════════════════

export class ValidationError extends AppError {
  readonly statusCode = HttpStatus.BAD_REQUEST;
  readonly code: ErrorCode;

  constructor(
    message: string,
    messageFA = 'خطای اعتبارسنجی',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.VALIDATION_FAILED
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  /** Invalid input format/type */
  static invalidInput(field: string, reason: string): ValidationError {
    return new ValidationError(
      `Invalid input for ${field}: ${reason}`,
      `ورودی نامعتبر برای ${field}`,
      { field, reason },
      ErrorCode.INVALID_INPUT
    );
  }

  /** Required field missing */
  static missingField(field: string): ValidationError {
    return new ValidationError(
      `Missing required field: ${field}`,
      `فیلد الزامی وارد نشده: ${field}`,
      { field },
      ErrorCode.MISSING_REQUIRED_FIELD
    );
  }

  /** Invalid format (email, phone, etc.) */
  static invalidFormat(field: string, expectedFormat: string): ValidationError {
    return new ValidationError(
      `Invalid format for ${field}. Expected: ${expectedFormat}`,
      `فرمت نامعتبر برای ${field}`,
      { field, expectedFormat },
      ErrorCode.INVALID_FORMAT
    );
  }

  /** Schema validation failed (Zod, etc.) */
  static schemaValidationFailed(
    errors: Array<{ field: string; message: string }>
  ): ValidationError {
    return new ValidationError(
      'Schema validation failed',
      'اعتبارسنجی ناموفق بود',
      { errors },
      ErrorCode.VALIDATION_FAILED
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 401 - Authentication Error
// ═══════════════════════════════════════════════════════════════════════════

export class AuthenticationError extends AppError {
  readonly statusCode = HttpStatus.UNAUTHORIZED;
  readonly code: ErrorCode;

  constructor(
    message = 'Authentication required',
    messageFA = 'احراز هویت الزامی است',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.UNAUTHORIZED
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  static invalidCredentials(): AuthenticationError {
    return new AuthenticationError(
      'Invalid email or password',
      'ایمیل یا رمز عبور نادرست است',
      undefined,
      ErrorCode.INVALID_CREDENTIALS
    );
  }

  static tokenExpired(): AuthenticationError {
    return new AuthenticationError(
      'Token has expired',
      'توکن منقضی شده است',
      undefined,
      ErrorCode.TOKEN_EXPIRED
    );
  }

  static tokenInvalid(): AuthenticationError {
    return new AuthenticationError(
      'Invalid token',
      'توکن نامعتبر است',
      undefined,
      ErrorCode.TOKEN_INVALID
    );
  }

  static sessionExpired(): AuthenticationError {
    return new AuthenticationError(
      'Session has expired',
      'نشست منقضی شده است',
      undefined,
      ErrorCode.SESSION_EXPIRED
    );
  }

  /** Rate limited - too many attempts */
  static rateLimited(retryAfterSeconds: number): AuthenticationError {
    return new AuthenticationError(
      `Too many attempts. Please try again in ${retryAfterSeconds} seconds`,
      `تعداد تلاش‌ها بیش از حد مجاز است. ${Math.ceil(retryAfterSeconds / 60)} دقیقه دیگر تلاش کنید`,
      { retryAfterSeconds },
      ErrorCode.RATE_LIMIT_EXCEEDED
    );
  }

  /** Account is disabled */
  static accountDisabled(): AuthenticationError {
    return new AuthenticationError(
      'Account is disabled',
      'حساب کاربری غیرفعال شده است',
      undefined,
      ErrorCode.ACCOUNT_DISABLED
    );
  }

  /** Account is locked due to failed attempts */
  static accountLocked(unlockAfterSeconds: number): AuthenticationError {
    return new AuthenticationError(
      `Account is locked. Try again in ${Math.ceil(unlockAfterSeconds / 60)} minutes`,
      `حساب کاربری قفل شده است. ${Math.ceil(unlockAfterSeconds / 60)} دقیقه دیگر تلاش کنید`,
      { unlockAfterSeconds },
      ErrorCode.ACCOUNT_LOCKED
    );
  }

  /** Invalid TOTP code */
  static invalidTotp(): AuthenticationError {
    return new AuthenticationError(
      'Invalid verification code',
      'کد تأیید نامعتبر است',
      undefined,
      ErrorCode.INVALID_TOTP
    );
  }

  /** Weak password */
  static weakPassword(errors: string[]): AuthenticationError {
    return new AuthenticationError(
      'Password does not meet security requirements',
      'رمز عبور الزامات امنیتی را برآورده نمی‌کند',
      { errors },
      ErrorCode.WEAK_PASSWORD
    );
  }

  /** Email already exists */
  static emailAlreadyExists(): AuthenticationError {
    return new AuthenticationError(
      'Email already registered',
      'این ایمیل قبلاً ثبت شده است',
      undefined,
      ErrorCode.EMAIL_EXISTS
    );
  }

  /** Phone already exists */
  static phoneAlreadyExists(): AuthenticationError {
    return new AuthenticationError(
      'Phone number already registered',
      'این شماره تلفن قبلاً ثبت شده است',
      undefined,
      ErrorCode.PHONE_EXISTS
    );
  }

  /** 2FA required */
  static twoFactorRequired(): AuthenticationError {
    return new AuthenticationError(
      'Two-factor authentication required',
      'احراز هویت دو مرحله‌ای الزامی است',
      undefined,
      ErrorCode.TWO_FACTOR_REQUIRED
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 403 - Authorization Error
// ═══════════════════════════════════════════════════════════════════════════

export class AuthorizationError extends AppError {
  readonly statusCode = HttpStatus.FORBIDDEN;
  readonly code: ErrorCode;

  constructor(
    message = 'Access denied',
    messageFA = 'دسترسی غیرمجاز',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.FORBIDDEN
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  static insufficientPermissions(requiredPermission: string): AuthorizationError {
    return new AuthorizationError(
      `Insufficient permissions. Required: ${requiredPermission}`,
      'سطح دسترسی کافی نیست',
      { requiredPermission },
      ErrorCode.INSUFFICIENT_PERMISSIONS
    );
  }

  static resourceAccessDenied(resource: string): AuthorizationError {
    return new AuthorizationError(
      `Access denied to resource: ${resource}`,
      'دسترسی به این منبع مجاز نیست',
      { resource },
      ErrorCode.RESOURCE_ACCESS_DENIED
    );
  }

  static tenantAccessDenied(tenantId: string): AuthorizationError {
    return new AuthorizationError(
      'Access denied to this tenant',
      'دسترسی به این سازمان مجاز نیست',
      { tenantId },
      ErrorCode.TENANT_ACCESS_DENIED
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 404 - Not Found Error
// ═══════════════════════════════════════════════════════════════════════════

export class NotFoundError extends AppError {
  readonly statusCode = HttpStatus.NOT_FOUND;
  readonly code = ErrorCode.RESOURCE_NOT_FOUND;

  constructor(message: string, messageFA = 'منبع یافت نشد', details?: Record<string, unknown>) {
    super(message, messageFA, details);
  }

  static resource(resource: string, identifier: string): NotFoundError {
    return new NotFoundError(`${resource} not found: ${identifier}`, `${resource} یافت نشد`, {
      resource,
      identifier,
    });
  }

  static byId(resource: string, id: string): NotFoundError {
    return new NotFoundError(
      `${resource} with ID ${id} not found`,
      `${resource} با شناسه ${id} یافت نشد`,
      { resource, id }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 409 - Conflict Error (Resource State Conflicts)
// ═══════════════════════════════════════════════════════════════════════════

export class ConflictError extends AppError {
  readonly statusCode = HttpStatus.CONFLICT;
  readonly code: ErrorCode;

  constructor(
    message: string,
    messageFA = 'تداخل در عملیات',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.CONFLICT
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  /** Resource already exists */
  static resourceExists(resource: string, identifier: string): ConflictError {
    return new ConflictError(
      `${resource} already exists: ${identifier}`,
      `${resource} از قبل وجود دارد`,
      { resource, identifier },
      ErrorCode.RESOURCE_EXISTS
    );
  }

  /** Optimistic locking failure */
  static optimisticLockFailed(resource: string): ConflictError {
    return new ConflictError(
      `Concurrent modification detected for ${resource}`,
      'تغییر همزمان شناسایی شد. لطفاً دوباره تلاش کنید',
      { resource },
      ErrorCode.OPTIMISTIC_LOCK_FAILED
    );
  }

  /** Generic conflict */
  static conflict(reason: string, messageFA?: string): ConflictError {
    return new ConflictError(
      `Conflict: ${reason}`,
      messageFA || 'تداخل در عملیات',
      { reason },
      ErrorCode.CONFLICT
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 422 - Business Rule Error (Business Logic Violations)
// ═══════════════════════════════════════════════════════════════════════════

export class BusinessRuleError extends AppError {
  readonly statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
  readonly code: ErrorCode;

  constructor(
    message: string,
    messageFA = 'قانون کسب‌وکار نقض شده است',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.BUSINESS_RULE_VIOLATION
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  /** Generic business rule violation */
  static violation(rule: string, messageFA?: string): BusinessRuleError {
    return new BusinessRuleError(
      `Business rule violation: ${rule}`,
      messageFA || 'قانون کسب‌وکار نقض شده است',
      { rule },
      ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }

  /** Invalid state transition */
  static invalidStateTransition(from: string, to: string, entity: string): BusinessRuleError {
    return new BusinessRuleError(
      `Invalid state transition from ${from} to ${to} for ${entity}`,
      'تغییر وضعیت نامعتبر است',
      { from, to, entity },
      ErrorCode.INVALID_STATE_TRANSITION
    );
  }

  /** Insufficient balance/credit */
  static insufficientBalance(
    accountId: string,
    required: number,
    available: number
  ): BusinessRuleError {
    return new BusinessRuleError(
      `Insufficient balance in account ${accountId}`,
      'موجودی کافی نیست',
      { accountId, required, available },
      ErrorCode.INSUFFICIENT_BALANCE
    );
  }

  /** Minimum amount not met */
  static minimumAmountNotMet(field: string, minimum: number, currency: string): BusinessRuleError {
    return new BusinessRuleError(
      `${field} must be at least ${minimum} ${currency}`,
      `${field} باید حداقل ${minimum} ${currency} باشد`,
      { field, minimum, currency },
      ErrorCode.MINIMUM_AMOUNT_NOT_MET
    );
  }

  /** Maximum limit exceeded */
  static maximumLimitExceeded(field: string, maximum: number, unit?: string): BusinessRuleError {
    return new BusinessRuleError(
      `${field} exceeds maximum limit of ${maximum}${unit ? ` ${unit}` : ''}`,
      `${field} از حداکثر مجاز ${maximum}${unit ? ` ${unit}` : ''} بیشتر است`,
      { field, maximum, unit },
      ErrorCode.MAXIMUM_LIMIT_EXCEEDED
    );
  }

  /** Credit limit exceeded */
  static creditLimitExceeded(
    customerId: string,
    limit: number,
    requested: number
  ): BusinessRuleError {
    return new BusinessRuleError(
      `Credit limit exceeded for customer ${customerId}`,
      'سقف اعتبار مشتری تمام شده است',
      { customerId, limit, requested },
      ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }

  /** Order cannot be modified */
  static orderNotModifiable(orderId: string, currentStatus: string): BusinessRuleError {
    return new BusinessRuleError(
      `Order ${orderId} cannot be modified in ${currentStatus} status`,
      'سفارش در این وضعیت قابل تغییر نیست',
      { orderId, currentStatus },
      ErrorCode.INVALID_STATE_TRANSITION
    );
  }

  /** Inventory insufficient */
  static insufficientInventory(
    productId: string,
    requested: number,
    available: number
  ): BusinessRuleError {
    return new BusinessRuleError(
      `Insufficient inventory for product ${productId}`,
      'موجودی انبار کافی نیست',
      { productId, requested, available },
      ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 409 - Domain Error (Legacy - Use ConflictError or BusinessRuleError)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use ConflictError for resource conflicts or BusinessRuleError for business logic
 */
export class DomainError extends AppError {
  readonly statusCode = HttpStatus.CONFLICT;
  readonly code: ErrorCode;

  constructor(
    message: string,
    messageFA = 'خطای عملیاتی',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.CONFLICT
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  /** @deprecated Use ConflictError.resourceExists() */
  static resourceExists(resource: string, identifier: string): DomainError {
    return new DomainError(
      `${resource} already exists: ${identifier}`,
      `${resource} از قبل وجود دارد`,
      { resource, identifier },
      ErrorCode.RESOURCE_EXISTS
    );
  }

  /** @deprecated Use ConflictError.optimisticLockFailed() */
  static optimisticLockFailed(resource: string): DomainError {
    return new DomainError(
      `Concurrent modification detected for ${resource}`,
      'تغییر همزمان شناسایی شد. لطفاً دوباره تلاش کنید',
      { resource },
      ErrorCode.OPTIMISTIC_LOCK_FAILED
    );
  }

  /** @deprecated Use BusinessRuleError.violation() */
  static businessRuleViolation(rule: string, messageFA?: string): DomainError {
    return new DomainError(
      `Business rule violation: ${rule}`,
      messageFA || 'قانون کسب‌وکار نقض شده است',
      { rule },
      ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }

  /** @deprecated Use BusinessRuleError.invalidStateTransition() */
  static invalidStateTransition(from: string, to: string, entity: string): DomainError {
    return new DomainError(
      `Invalid state transition from ${from} to ${to} for ${entity}`,
      'تغییر وضعیت نامعتبر است',
      { from, to, entity },
      ErrorCode.INVALID_STATE_TRANSITION
    );
  }

  /** @deprecated Use BusinessRuleError.insufficientBalance() */
  static insufficientBalance(accountId: string, required: number, available: number): DomainError {
    return new DomainError(
      `Insufficient balance in account ${accountId}`,
      'موجودی کافی نیست',
      { accountId, required, available },
      ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }

  /** @deprecated Use BusinessRuleError.minimumAmountNotMet() */
  static minimumAmountNotMet(field: string, minimum: number, currency: string): DomainError {
    return new DomainError(
      `${field} must be at least ${minimum} ${currency}`,
      `${field} باید حداقل ${minimum} ${currency} باشد`,
      { field, minimum, currency },
      ErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 429 - Rate Limit Error
// ═══════════════════════════════════════════════════════════════════════════

export class RateLimitError extends AppError {
  readonly statusCode = HttpStatus.TOO_MANY_REQUESTS;
  readonly code = ErrorCode.RATE_LIMIT_EXCEEDED;

  constructor(
    message = 'Too many requests',
    messageFA = 'تعداد درخواست‌ها بیش از حد مجاز است',
    details?: Record<string, unknown>
  ) {
    super(message, messageFA, details);
  }

  static tooManyRequests(retryAfterSeconds?: number): RateLimitError {
    return new RateLimitError(
      'Too many requests. Please try again later.',
      'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید',
      retryAfterSeconds ? { retryAfterSeconds } : undefined
    );
  }

  static quotaExceeded(resource: string, limit: number): RateLimitError {
    return new RateLimitError(
      `Quota exceeded for ${resource}. Limit: ${limit}`,
      `سهمیه ${resource} تمام شده است`,
      { resource, limit }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 500 - Internal Error (Infrastructure/System)
// ═══════════════════════════════════════════════════════════════════════════

export class InternalError extends AppError {
  readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  readonly code: ErrorCode;

  constructor(
    message = 'An unexpected error occurred',
    messageFA = 'خطای غیرمنتظره رخ داد',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  /** Database operation failed */
  static database(operation: string): InternalError {
    return new InternalError(
      'Database operation failed',
      'خطا در عملیات پایگاه داده',
      { operation },
      ErrorCode.DATABASE_ERROR
    );
  }

  /** External service unavailable */
  static externalService(service: string): InternalError {
    return new InternalError(
      `External service unavailable: ${service}`,
      'سرویس خارجی در دسترس نیست',
      { service },
      ErrorCode.EXTERNAL_SERVICE_ERROR
    );
  }

  /** Transaction timeout */
  static transactionTimeout(timeoutMs: number): InternalError {
    return new InternalError(
      `Transaction timed out after ${timeoutMs}ms`,
      `تراکنش پس از ${timeoutMs}ms منقضی شد`,
      { timeoutMs },
      ErrorCode.TRANSACTION_TIMEOUT
    );
  }

  /** Unknown/catch-all error */
  static unknown(context?: string): InternalError {
    return new InternalError(
      'An unexpected error occurred',
      'خطای غیرمنتظره رخ داد',
      context ? { context } : undefined,
      ErrorCode.INTERNAL_ERROR
    );
  }

  /** Configuration error */
  static configuration(setting: string): InternalError {
    return new InternalError(
      `Configuration error: ${setting}`,
      'خطای پیکربندی سیستم',
      { setting },
      ErrorCode.INTERNAL_ERROR
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 503 - Service Unavailable Error
// ═══════════════════════════════════════════════════════════════════════════

export class UnavailableError extends AppError {
  readonly statusCode = HttpStatus.SERVICE_UNAVAILABLE;
  readonly code: ErrorCode;

  constructor(
    message = 'Service temporarily unavailable',
    messageFA = 'سرویس موقتاً در دسترس نیست',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.SERVICE_UNAVAILABLE
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  static serviceUnavailable(service?: string, retryAfterSeconds?: number): UnavailableError {
    return new UnavailableError(
      service ? `${service} is temporarily unavailable` : 'Service temporarily unavailable',
      'سرویس موقتاً در دسترس نیست',
      { ...(service && { service }), ...(retryAfterSeconds && { retryAfterSeconds }) },
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }

  static maintenanceMode(estimatedEndTime?: string): UnavailableError {
    return new UnavailableError(
      'System is under maintenance',
      'سیستم در حال تعمیر و نگهداری است',
      estimatedEndTime ? { estimatedEndTime } : undefined,
      ErrorCode.MAINTENANCE_MODE
    );
  }

  /** Circuit breaker is open - service temporarily blocked */
  static circuitBreakerOpen(service: string, resetAfterMs?: number): UnavailableError {
    return new UnavailableError(
      `Circuit breaker open for ${service}. Service temporarily blocked.`,
      `سرویس ${service} موقتاً مسدود شده است`,
      { service, ...(resetAfterMs && { resetAfterMs }) },
      ErrorCode.CIRCUIT_BREAKER_OPEN
    );
  }

  /** Dependency service unavailable */
  static dependencyUnavailable(dependency: string): UnavailableError {
    return new UnavailableError(
      `Required dependency unavailable: ${dependency}`,
      `سرویس وابسته در دسترس نیست: ${dependency}`,
      { dependency },
      ErrorCode.DEPENDENCY_UNAVAILABLE
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 502 - Bad Gateway Error (Upstream Service Errors)
// ═══════════════════════════════════════════════════════════════════════════

export class BadGatewayError extends AppError {
  readonly statusCode = HttpStatus.BAD_GATEWAY;
  readonly code: ErrorCode;

  constructor(
    message = 'Bad gateway',
    messageFA = 'خطا در ارتباط با سرویس بالادستی',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.BAD_GATEWAY
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  /** Upstream service returned invalid response */
  static invalidUpstreamResponse(service: string, reason?: string): BadGatewayError {
    return new BadGatewayError(
      `Invalid response from upstream service: ${service}${reason ? ` - ${reason}` : ''}`,
      `پاسخ نامعتبر از سرویس ${service}`,
      { service, ...(reason && { reason }) },
      ErrorCode.UPSTREAM_ERROR
    );
  }

  /** Upstream service connection failed */
  static upstreamConnectionFailed(service: string): BadGatewayError {
    return new BadGatewayError(
      `Failed to connect to upstream service: ${service}`,
      `خطا در اتصال به سرویس ${service}`,
      { service },
      ErrorCode.BAD_GATEWAY
    );
  }

  /** Payment gateway error */
  static paymentGatewayError(gateway: string, errorCode?: string): BadGatewayError {
    return new BadGatewayError(
      `Payment gateway error: ${gateway}`,
      `خطا در درگاه پرداخت ${gateway}`,
      { gateway, ...(errorCode && { gatewayErrorCode: errorCode }) },
      ErrorCode.UPSTREAM_ERROR
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 504 - Gateway Timeout Error
// ═══════════════════════════════════════════════════════════════════════════

export class GatewayTimeoutError extends AppError {
  readonly statusCode = HttpStatus.GATEWAY_TIMEOUT;
  readonly code: ErrorCode;

  constructor(
    message = 'Gateway timeout',
    messageFA = 'زمان انتظار سرویس بالادستی به پایان رسید',
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.GATEWAY_TIMEOUT
  ) {
    super(message, messageFA, details);
    this.code = code;
  }

  /** Upstream service timed out */
  static upstreamTimeout(service: string, timeoutMs: number): GatewayTimeoutError {
    return new GatewayTimeoutError(
      `Upstream service ${service} timed out after ${timeoutMs}ms`,
      `زمان انتظار سرویس ${service} به پایان رسید`,
      { service, timeoutMs },
      ErrorCode.UPSTREAM_TIMEOUT
    );
  }

  /** Database query timeout */
  static databaseTimeout(operation: string, timeoutMs: number): GatewayTimeoutError {
    return new GatewayTimeoutError(
      `Database operation ${operation} timed out after ${timeoutMs}ms`,
      'عملیات پایگاه داده به پایان رسید',
      { operation, timeoutMs },
      ErrorCode.GATEWAY_TIMEOUT
    );
  }

  /** External API timeout */
  static externalApiTimeout(api: string, timeoutMs: number): GatewayTimeoutError {
    return new GatewayTimeoutError(
      `External API ${api} timed out after ${timeoutMs}ms`,
      'زمان انتظار API خارجی به پایان رسید',
      { api, timeoutMs },
      ErrorCode.UPSTREAM_TIMEOUT
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SYSTEM INVARIANTS - HARD CONSTRAINTS (NO MUTATION, NO LEARNING)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * These invariants are IMMUTABLE. Violation = system failure.
 * Each invariant has: name, signal, consequence.
 *
 * If any invariant cannot be enforced mechanically → SYSTEM UNSAFE
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.SYSTEM_SAFETY_STATUS =
  exports.DETECTION_POINTS =
  exports.KILL_SWITCH_CONDITIONS =
  exports.ERROR_INVARIANTS =
  exports.ERROR_CODE_STATUS_MAP =
  exports.PAYMENT_INVARIANTS =
  exports.AUTH_INVARIANTS =
    void 0;
const common_1 = require('@nestjs/common');
const app_error_1 = require('./app-error');
// ═══════════════════════════════════════════════════════════════════════════
// AUTH CORRECTNESS INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════
exports.AUTH_INVARIANTS = {
  /**
   * INV-AUTH-001: Token Verification is Mandatory
   * Signal: Request reaches protected handler without valid user context
   * Consequence: KILL REQUEST, LOG SECURITY EVENT
   */
  TOKEN_VERIFICATION_MANDATORY: {
    name: 'TOKEN_VERIFICATION_MANDATORY',
    signal: (ctx) => !ctx.isPublic && ctx.user === undefined,
    consequence: 'REJECT_401',
    enforceable: true,
  },
  /**
   * INV-AUTH-002: Expired Token Rejection
   * Signal: Token exp < current timestamp
   * Consequence: REJECT REQUEST, FORCE RE-AUTH
   */
  EXPIRED_TOKEN_REJECTION: {
    name: 'EXPIRED_TOKEN_REJECTION',
    signal: (payload) => payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000),
    consequence: 'REJECT_401_TOKEN_EXPIRED',
    enforceable: true,
  },
  /**
   * INV-AUTH-003: Payload Integrity
   * Signal: Token payload missing required claims (sub, email)
   * Consequence: REJECT REQUEST
   */
  PAYLOAD_INTEGRITY: {
    name: 'PAYLOAD_INTEGRITY',
    signal: (payload) => !payload.sub || !payload.email,
    consequence: 'REJECT_401_INVALID_TOKEN',
    enforceable: true,
  },
  /**
   * INV-AUTH-004: Secret Key Non-Default
   * Signal: JWT_SECRET === 'default-secret' in production
   * Consequence: SYSTEM UNSAFE - REFUSE TO START
   */
  SECRET_KEY_NON_DEFAULT: {
    name: 'SECRET_KEY_NON_DEFAULT',
    signal: (config) => config.nodeEnv === 'production' && config.jwtSecret === 'default-secret',
    consequence: 'SYSTEM_UNSAFE_REFUSE_START',
    enforceable: true,
  },
};
// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT SAFETY INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════
exports.PAYMENT_INVARIANTS = {
  /**
   * INV-PAY-001: Double-Entry Balance
   * Signal: sum(debits) !== sum(credits) for any transaction
   * Consequence: REJECT TRANSACTION, NO BALANCE MUTATION
   */
  DOUBLE_ENTRY_BALANCE: {
    name: 'DOUBLE_ENTRY_BALANCE',
    signal: (entries) => {
      const debits = entries.filter((e) => e.type === 'DEBIT').reduce((s, e) => s + e.amount, 0);
      const credits = entries.filter((e) => e.type === 'CREDIT').reduce((s, e) => s + e.amount, 0);
      return Math.abs(debits - credits) >= 0.01;
    },
    consequence: 'REJECT_TRANSACTION',
    enforceable: true,
  },
  /**
   * INV-PAY-002: Non-Negative Balance
   * Signal: account.balance < 0 after transaction
   * Consequence: ROLLBACK ENTIRE TRANSACTION
   */
  NON_NEGATIVE_BALANCE: {
    name: 'NON_NEGATIVE_BALANCE',
    signal: (balance) => balance < 0,
    consequence: 'ROLLBACK_TRANSACTION',
    enforceable: true,
  },
  /**
   * INV-PAY-003: Idempotency Key Binding
   * Signal: Same idempotency key used with different authority/amount
   * Consequence: REJECT WITH IDEMPOTENCY_MISMATCH
   */
  IDEMPOTENCY_KEY_BINDING: {
    name: 'IDEMPOTENCY_KEY_BINDING',
    signal: (stored, incoming) =>
      stored.key === incoming.key && stored.authority !== incoming.authority,
    consequence: 'REJECT_IDEMPOTENCY_MISMATCH',
    enforceable: true,
  },
  /**
   * INV-PAY-004: Amount Positivity
   * Signal: transaction.amount <= 0
   * Consequence: REJECT TRANSACTION
   */
  AMOUNT_POSITIVITY: {
    name: 'AMOUNT_POSITIVITY',
    signal: (amount) => amount <= 0,
    consequence: 'REJECT_VALIDATION_ERROR',
    enforceable: true,
  },
  /**
   * INV-PAY-005: Atomic Rollback on Failure
   * Signal: Transaction status = FAILED but balances changed
   * Consequence: SYSTEM UNSAFE - DATA CORRUPTION
   */
  ATOMIC_ROLLBACK: {
    name: 'ATOMIC_ROLLBACK',
    signal: (tx) => {
      if (tx.status !== 'FAILED') {
        return false;
      }
      for (const [id, before] of tx.balancesBefore) {
        if (tx.balancesAfter.get(id) !== before) {
          return true;
        }
      }
      return false;
    },
    consequence: 'SYSTEM_UNSAFE_DATA_CORRUPTION',
    enforceable: true,
  },
  /**
   * INV-PAY-006: Verification Before Completion
   * Signal: Payment marked COMPLETED without gateway verification
   * Consequence: SYSTEM UNSAFE - FINANCIAL LOSS
   */
  VERIFICATION_BEFORE_COMPLETION: {
    name: 'VERIFICATION_BEFORE_COMPLETION',
    signal: (payment) => payment.status === 'COMPLETED' && !payment.gatewayVerified,
    consequence: 'SYSTEM_UNSAFE_FINANCIAL_LOSS',
    enforceable: true,
  },
};
// ═══════════════════════════════════════════════════════════════════════════
// ERROR CONSISTENCY INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * CANONICAL ERROR CODE → HTTP STATUS MAPPING
 * This is the SINGLE SOURCE OF TRUTH. No exceptions.
 */
exports.ERROR_CODE_STATUS_MAP = {
  // 400 - Validation
  [app_error_1.ErrorCode.VALIDATION_FAILED]: common_1.HttpStatus.BAD_REQUEST,
  [app_error_1.ErrorCode.INVALID_INPUT]: common_1.HttpStatus.BAD_REQUEST,
  [app_error_1.ErrorCode.MISSING_REQUIRED_FIELD]: common_1.HttpStatus.BAD_REQUEST,
  [app_error_1.ErrorCode.INVALID_FORMAT]: common_1.HttpStatus.BAD_REQUEST,
  // 401 - Authentication
  [app_error_1.ErrorCode.UNAUTHORIZED]: common_1.HttpStatus.UNAUTHORIZED,
  [app_error_1.ErrorCode.INVALID_CREDENTIALS]: common_1.HttpStatus.UNAUTHORIZED,
  [app_error_1.ErrorCode.TOKEN_EXPIRED]: common_1.HttpStatus.UNAUTHORIZED,
  [app_error_1.ErrorCode.TOKEN_INVALID]: common_1.HttpStatus.UNAUTHORIZED,
  [app_error_1.ErrorCode.SESSION_EXPIRED]: common_1.HttpStatus.UNAUTHORIZED,
  [app_error_1.ErrorCode.MFA_REQUIRED]: common_1.HttpStatus.UNAUTHORIZED,
  [app_error_1.ErrorCode.MFA_INVALID]: common_1.HttpStatus.UNAUTHORIZED,
  // 403 - Authorization
  [app_error_1.ErrorCode.FORBIDDEN]: common_1.HttpStatus.FORBIDDEN,
  [app_error_1.ErrorCode.INSUFFICIENT_PERMISSIONS]: common_1.HttpStatus.FORBIDDEN,
  [app_error_1.ErrorCode.RESOURCE_ACCESS_DENIED]: common_1.HttpStatus.FORBIDDEN,
  [app_error_1.ErrorCode.TENANT_ACCESS_DENIED]: common_1.HttpStatus.FORBIDDEN,
  [app_error_1.ErrorCode.IP_BLOCKED]: common_1.HttpStatus.FORBIDDEN,
  // 404 - Not Found
  [app_error_1.ErrorCode.RESOURCE_NOT_FOUND]: common_1.HttpStatus.NOT_FOUND,
  [app_error_1.ErrorCode.ROUTE_NOT_FOUND]: common_1.HttpStatus.NOT_FOUND,
  // 409 - Conflict
  [app_error_1.ErrorCode.CONFLICT]: common_1.HttpStatus.CONFLICT,
  [app_error_1.ErrorCode.RESOURCE_EXISTS]: common_1.HttpStatus.CONFLICT,
  [app_error_1.ErrorCode.OPTIMISTIC_LOCK_FAILED]: common_1.HttpStatus.CONFLICT,
  [app_error_1.ErrorCode.IDEMPOTENCY_CONFLICT]: common_1.HttpStatus.CONFLICT,
  // 422 - Business Rule Violation
  [app_error_1.ErrorCode.BUSINESS_RULE_VIOLATION]: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
  [app_error_1.ErrorCode.INVALID_STATE_TRANSITION]: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
  [app_error_1.ErrorCode.INSUFFICIENT_BALANCE]: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
  [app_error_1.ErrorCode.MINIMUM_AMOUNT_NOT_MET]: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
  [app_error_1.ErrorCode.MAXIMUM_LIMIT_EXCEEDED]: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
  [app_error_1.ErrorCode.PAYMENT_FAILED]: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
  [app_error_1.ErrorCode.PAYMENT_VERIFICATION_FAILED]: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
  // 429 - Rate Limited
  [app_error_1.ErrorCode.RATE_LIMIT_EXCEEDED]: common_1.HttpStatus.TOO_MANY_REQUESTS,
  [app_error_1.ErrorCode.QUOTA_EXCEEDED]: common_1.HttpStatus.TOO_MANY_REQUESTS,
  // 500 - Internal
  [app_error_1.ErrorCode.INTERNAL_ERROR]: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
  [app_error_1.ErrorCode.DATABASE_ERROR]: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
  [app_error_1.ErrorCode.EXTERNAL_SERVICE_ERROR]: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
  [app_error_1.ErrorCode.TRANSACTION_TIMEOUT]: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
  [app_error_1.ErrorCode.CACHE_ERROR]: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
  [app_error_1.ErrorCode.QUEUE_ERROR]: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
  // 502 - Bad Gateway
  [app_error_1.ErrorCode.BAD_GATEWAY]: common_1.HttpStatus.BAD_GATEWAY,
  [app_error_1.ErrorCode.UPSTREAM_ERROR]: common_1.HttpStatus.BAD_GATEWAY,
  // 503 - Service Unavailable
  [app_error_1.ErrorCode.SERVICE_UNAVAILABLE]: common_1.HttpStatus.SERVICE_UNAVAILABLE,
  [app_error_1.ErrorCode.MAINTENANCE_MODE]: common_1.HttpStatus.SERVICE_UNAVAILABLE,
  [app_error_1.ErrorCode.CIRCUIT_BREAKER_OPEN]: common_1.HttpStatus.SERVICE_UNAVAILABLE,
  [app_error_1.ErrorCode.DEPENDENCY_UNAVAILABLE]: common_1.HttpStatus.SERVICE_UNAVAILABLE,
  // 504 - Gateway Timeout
  [app_error_1.ErrorCode.GATEWAY_TIMEOUT]: common_1.HttpStatus.GATEWAY_TIMEOUT,
  [app_error_1.ErrorCode.UPSTREAM_TIMEOUT]: common_1.HttpStatus.GATEWAY_TIMEOUT,
};
exports.ERROR_INVARIANTS = {
  /**
   * INV-ERR-001: One-to-One ErrorCode → Status Mapping
   * Signal: ErrorCode maps to multiple HTTP statuses
   * Consequence: BUILD FAILURE
   */
  ONE_TO_ONE_MAPPING: {
    name: 'ONE_TO_ONE_MAPPING',
    signal: () => {
      const statusByCode = new Map();
      for (const [code, status] of Object.entries(exports.ERROR_CODE_STATUS_MAP)) {
        const errorCode = code;
        if (!statusByCode.has(errorCode)) {
          statusByCode.set(errorCode, new Set());
        }
        statusByCode.get(errorCode).add(status);
      }
      for (const [, statuses] of statusByCode) {
        if (statuses.size > 1) {
          return true;
        }
      }
      return false;
    },
    consequence: 'BUILD_FAILURE',
    enforceable: true,
  },
  /**
   * INV-ERR-002: AppError Boundary
   * Signal: Non-AppError reaches API response
   * Consequence: CONVERT TO INTERNAL_ERROR, LOG WARNING
   */
  APP_ERROR_BOUNDARY: {
    name: 'APP_ERROR_BOUNDARY',
    signal: (error) => {
      // Check if error is NOT an AppError instance
      return !(error && typeof error === 'object' && 'statusCode' in error && 'code' in error);
    },
    consequence: 'CONVERT_TO_INTERNAL_ERROR',
    enforceable: true,
  },
  /**
   * INV-ERR-003: RESOURCE_NOT_FOUND = 404 Only
   * Signal: RESOURCE_NOT_FOUND used with status !== 404
   * Consequence: BUILD FAILURE
   */
  NOT_FOUND_IS_404: {
    name: 'NOT_FOUND_IS_404',
    signal: () =>
      exports.ERROR_CODE_STATUS_MAP[app_error_1.ErrorCode.RESOURCE_NOT_FOUND] !==
      common_1.HttpStatus.NOT_FOUND,
    consequence: 'BUILD_FAILURE',
    enforceable: true,
  },
  /**
   * INV-ERR-004: No Raw Error Throws
   * Signal: throw new Error() or throw "string" in codebase
   * Consequence: LINT FAILURE
   */
  NO_RAW_ERROR_THROWS: {
    name: 'NO_RAW_ERROR_THROWS',
    signal: 'STATIC_ANALYSIS_REQUIRED',
    consequence: 'LINT_FAILURE',
    enforceable: false, // Requires ESLint rule
  },
  /**
   * INV-ERR-005: Immutable Status Code
   * Signal: Error statusCode modified after construction
   * Consequence: TYPE ERROR (readonly)
   */
  IMMUTABLE_STATUS_CODE: {
    name: 'IMMUTABLE_STATUS_CODE',
    signal: 'TYPE_SYSTEM_ENFORCED',
    consequence: 'COMPILE_FAILURE',
    enforceable: true,
  },
};
// ═══════════════════════════════════════════════════════════════════════════
// KILL-SWITCH CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════
exports.KILL_SWITCH_CONDITIONS = [
  {
    condition: 'AUTH_INVARIANTS.SECRET_KEY_NON_DEFAULT violated',
    action: 'REFUSE_TO_START',
    severity: 'CRITICAL',
  },
  {
    condition: 'PAYMENT_INVARIANTS.ATOMIC_ROLLBACK violated',
    action: 'HALT_PAYMENT_PROCESSING',
    severity: 'CRITICAL',
  },
  {
    condition: 'PAYMENT_INVARIANTS.VERIFICATION_BEFORE_COMPLETION violated',
    action: 'HALT_PAYMENT_PROCESSING',
    severity: 'CRITICAL',
  },
  {
    condition: 'ERROR_INVARIANTS.ONE_TO_ONE_MAPPING violated',
    action: 'FAIL_BUILD',
    severity: 'BLOCKING',
  },
  {
    condition: 'ERROR_INVARIANTS.NOT_FOUND_IS_404 violated',
    action: 'FAIL_BUILD',
    severity: 'BLOCKING',
  },
];
// ═══════════════════════════════════════════════════════════════════════════
// DETECTION POINTS
// ═══════════════════════════════════════════════════════════════════════════
exports.DETECTION_POINTS = {
  AUTH: [
    { point: 'JwtAuthGuard.canActivate', invariants: ['TOKEN_VERIFICATION_MANDATORY'] },
    { point: 'JwtStrategy.validate', invariants: ['PAYLOAD_INTEGRITY', 'EXPIRED_TOKEN_REJECTION'] },
    { point: 'Application.bootstrap', invariants: ['SECRET_KEY_NON_DEFAULT'] },
  ],
  PAYMENT: [
    {
      point: 'TransactionManager.validateEntries',
      invariants: ['DOUBLE_ENTRY_BALANCE', 'AMOUNT_POSITIVITY'],
    },
    {
      point: 'TransactionManager.executeTransaction',
      invariants: ['NON_NEGATIVE_BALANCE', 'ATOMIC_ROLLBACK'],
    },
    { point: 'ZarinpalService.verifyPayment', invariants: ['VERIFICATION_BEFORE_COMPLETION'] },
    { point: 'PaymentService.initialize', invariants: ['IDEMPOTENCY_KEY_BINDING'] },
  ],
  ERROR: [
    { point: 'GlobalExceptionFilter.catch', invariants: ['APP_ERROR_BOUNDARY'] },
    { point: 'AppError.constructor', invariants: ['IMMUTABLE_STATUS_CODE'] },
    { point: 'CI/Build', invariants: ['ONE_TO_ONE_MAPPING', 'NOT_FOUND_IS_404'] },
    { point: 'ESLint', invariants: ['NO_RAW_ERROR_THROWS'] },
  ],
};
// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM SAFETY ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════
exports.SYSTEM_SAFETY_STATUS = {
  AUTH: 'SAFE', // All invariants mechanically enforceable
  PAYMENT: 'SAFE', // All invariants mechanically enforceable
  ERROR: 'CONDITIONAL', // INV-ERR-004 requires ESLint rule
  OVERALL: 'CONDITIONAL',
  REASON: 'INV-ERR-004 (NO_RAW_ERROR_THROWS) requires static analysis via ESLint rule',
  REMEDIATION: 'Add ESLint rule: no-throw-literal + custom rule for raw Error()',
};
//# sourceMappingURL=invariants.js.map

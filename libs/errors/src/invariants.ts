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

import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './app-error';

// ═══════════════════════════════════════════════════════════════════════════
// AUTH CORRECTNESS INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════

export const AUTH_INVARIANTS = {
  /**
   * INV-AUTH-001: Token Verification is Mandatory
   * Signal: Request reaches protected handler without valid user context
   * Consequence: KILL REQUEST, LOG SECURITY EVENT
   */
  TOKEN_VERIFICATION_MANDATORY: {
    name: 'TOKEN_VERIFICATION_MANDATORY',
    signal: (ctx: { user?: unknown; isPublic: boolean }) => !ctx.isPublic && ctx.user === undefined,
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
    signal: (payload: { exp?: number }) =>
      payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000),
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
    signal: (payload: { sub?: string; email?: string }) => !payload.sub || !payload.email,
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
    signal: (config: { jwtSecret: string; nodeEnv: string }) =>
      config.nodeEnv === 'production' && config.jwtSecret === 'default-secret',
    consequence: 'SYSTEM_UNSAFE_REFUSE_START',
    enforceable: true,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT SAFETY INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════

export const PAYMENT_INVARIANTS = {
  /**
   * INV-PAY-001: Double-Entry Balance
   * Signal: sum(debits) !== sum(credits) for any transaction
   * Consequence: REJECT TRANSACTION, NO BALANCE MUTATION
   */
  DOUBLE_ENTRY_BALANCE: {
    name: 'DOUBLE_ENTRY_BALANCE',
    signal: (entries: Array<{ type: 'DEBIT' | 'CREDIT'; amount: number }>) => {
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
    signal: (balance: number) => balance < 0,
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
    signal: (
      stored: { key: string; authority: string },
      incoming: { key: string; authority: string }
    ) => stored.key === incoming.key && stored.authority !== incoming.authority,
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
    signal: (amount: number) => amount <= 0,
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
    signal: (tx: {
      status: string;
      balancesBefore: Map<string, number>;
      balancesAfter: Map<string, number>;
    }) => {
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
    signal: (payment: { status: string; gatewayVerified: boolean }) =>
      payment.status === 'COMPLETED' && !payment.gatewayVerified,
    consequence: 'SYSTEM_UNSAFE_FINANCIAL_LOSS',
    enforceable: true,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CONSISTENCY INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CANONICAL ERROR CODE → HTTP STATUS MAPPING
 * This is the SINGLE SOURCE OF TRUTH. No exceptions.
 */
export const ERROR_CODE_STATUS_MAP: Record<ErrorCode, HttpStatus> = {
  // 400 - Validation
  [ErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_INPUT]: HttpStatus.BAD_REQUEST,
  [ErrorCode.MISSING_REQUIRED_FIELD]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_FORMAT]: HttpStatus.BAD_REQUEST,

  // 401 - Authentication
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.SESSION_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.MFA_REQUIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.MFA_INVALID]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.ACCOUNT_DISABLED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.ACCOUNT_LOCKED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.INVALID_TOTP]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.WEAK_PASSWORD]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.EMAIL_EXISTS]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.PHONE_EXISTS]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TWO_FACTOR_REQUIRED]: HttpStatus.UNAUTHORIZED,

  // 403 - Authorization
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: HttpStatus.FORBIDDEN,
  [ErrorCode.RESOURCE_ACCESS_DENIED]: HttpStatus.FORBIDDEN,
  [ErrorCode.TENANT_ACCESS_DENIED]: HttpStatus.FORBIDDEN,
  [ErrorCode.IP_BLOCKED]: HttpStatus.FORBIDDEN,

  // 404 - Not Found
  [ErrorCode.RESOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.ROUTE_NOT_FOUND]: HttpStatus.NOT_FOUND,

  // 409 - Conflict
  [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.RESOURCE_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.OPTIMISTIC_LOCK_FAILED]: HttpStatus.CONFLICT,
  [ErrorCode.IDEMPOTENCY_CONFLICT]: HttpStatus.CONFLICT,

  // 422 - Business Rule Violation
  [ErrorCode.BUSINESS_RULE_VIOLATION]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.INVALID_STATE_TRANSITION]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.INSUFFICIENT_BALANCE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.MINIMUM_AMOUNT_NOT_MET]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.MAXIMUM_LIMIT_EXCEEDED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PAYMENT_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PAYMENT_VERIFICATION_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,

  // 429 - Rate Limited
  [ErrorCode.RATE_LIMIT_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.QUOTA_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,

  // 500 - Internal
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.TRANSACTION_TIMEOUT]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.CACHE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.QUEUE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,

  // 502 - Bad Gateway
  [ErrorCode.BAD_GATEWAY]: HttpStatus.BAD_GATEWAY,
  [ErrorCode.UPSTREAM_ERROR]: HttpStatus.BAD_GATEWAY,

  // 503 - Service Unavailable
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.MAINTENANCE_MODE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.CIRCUIT_BREAKER_OPEN]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.DEPENDENCY_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,

  // 504 - Gateway Timeout
  [ErrorCode.GATEWAY_TIMEOUT]: HttpStatus.GATEWAY_TIMEOUT,
  [ErrorCode.UPSTREAM_TIMEOUT]: HttpStatus.GATEWAY_TIMEOUT,
};

export const ERROR_INVARIANTS = {
  /**
   * INV-ERR-001: One-to-One ErrorCode → Status Mapping
   * Signal: ErrorCode maps to multiple HTTP statuses
   * Consequence: BUILD FAILURE
   */
  ONE_TO_ONE_MAPPING: {
    name: 'ONE_TO_ONE_MAPPING',
    signal: () => {
      const statusByCode = new Map<ErrorCode, Set<HttpStatus>>();
      for (const [code, status] of Object.entries(ERROR_CODE_STATUS_MAP)) {
        const errorCode = code as ErrorCode;
        if (!statusByCode.has(errorCode)) {
          statusByCode.set(errorCode, new Set());
        }
        statusByCode.get(errorCode)?.add(status);
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
    signal: (error: unknown) => {
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
    signal: () => ERROR_CODE_STATUS_MAP[ErrorCode.RESOURCE_NOT_FOUND] !== HttpStatus.NOT_FOUND,
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
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// KILL-SWITCH CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const KILL_SWITCH_CONDITIONS = [
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
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION POINTS
// ═══════════════════════════════════════════════════════════════════════════

export const DETECTION_POINTS = {
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
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM SAFETY ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════

export const SYSTEM_SAFETY_STATUS = {
  AUTH: 'SAFE', // All invariants mechanically enforceable
  PAYMENT: 'SAFE', // All invariants mechanically enforceable
  ERROR: 'CONDITIONAL', // INV-ERR-004 requires ESLint rule

  OVERALL: 'CONDITIONAL',
  REASON: 'INV-ERR-004 (NO_RAW_ERROR_THROWS) requires static analysis via ESLint rule',
  REMEDIATION: 'Add ESLint rule: no-throw-literal + custom rule for raw Error()',
} as const;

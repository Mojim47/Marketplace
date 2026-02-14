/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INVARIANT ENFORCER - Runtime Enforcement of System Invariants
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Provides runtime enforcement of AUTH, PAYMENT, and ERROR invariants.
 * Each enforcer method throws appropriate errors when invariants are violated.
 *
 * Usage:
 *   InvariantEnforcer.auth.verifyTokenMandatory(ctx);
 *   InvariantEnforcer.payment.verifyDoubleEntry(entries);
 *   InvariantEnforcer.error.assertAppError(error);
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvariantEnforcer =
  exports.ErrorInvariantEnforcer =
  exports.PaymentInvariantEnforcer =
  exports.AuthInvariantEnforcer =
    void 0;
const common_1 = require('@nestjs/common');
const errors_1 = require('./errors');
const invariants_1 = require('./invariants');
const app_error_1 = require('./app-error');
const logger = new common_1.Logger('InvariantEnforcer');
// ═══════════════════════════════════════════════════════════════════════════
// AUTH INVARIANT ENFORCER
// ═══════════════════════════════════════════════════════════════════════════
exports.AuthInvariantEnforcer = {
  /**
   * INV-AUTH-001: Token Verification is Mandatory
   * Ensures protected routes have valid user context
   */
  verifyTokenMandatory(ctx) {
    if (invariants_1.AUTH_INVARIANTS.TOKEN_VERIFICATION_MANDATORY.signal(ctx)) {
      logger.error(
        '[INV-AUTH-001] Token verification mandatory - no user context on protected route'
      );
      throw errors_1.AuthenticationError.tokenInvalid();
    }
  },
  /**
   * INV-AUTH-002: Expired Token Rejection
   * Ensures expired tokens are rejected
   */
  verifyTokenNotExpired(payload) {
    if (invariants_1.AUTH_INVARIANTS.EXPIRED_TOKEN_REJECTION.signal(payload)) {
      logger.warn('[INV-AUTH-002] Expired token rejected');
      throw errors_1.AuthenticationError.tokenExpired();
    }
  },
  /**
   * INV-AUTH-003: Payload Integrity
   * Ensures JWT payload has required claims
   */
  verifyPayloadIntegrity(payload) {
    if (invariants_1.AUTH_INVARIANTS.PAYLOAD_INTEGRITY.signal(payload)) {
      logger.error('[INV-AUTH-003] Invalid token payload - missing required claims');
      throw errors_1.AuthenticationError.tokenInvalid();
    }
  },
  /**
   * INV-AUTH-004: Secret Key Non-Default
   * Ensures production doesn't use default JWT secret
   * @throws Error - System refuses to start (kill-switch)
   */
  verifySecretKeyNonDefault(config) {
    if (invariants_1.AUTH_INVARIANTS.SECRET_KEY_NON_DEFAULT.signal(config)) {
      logger.error('[INV-AUTH-004] CRITICAL: Default JWT secret in production - SYSTEM UNSAFE');
      throw new Error('KILL_SWITCH: JWT_SECRET must not be default in production');
    }
  },
};
// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT INVARIANT ENFORCER
// ═══════════════════════════════════════════════════════════════════════════
exports.PaymentInvariantEnforcer = {
  /**
   * INV-PAY-001: Double-Entry Balance
   * Ensures debits equal credits in any transaction
   */
  verifyDoubleEntryBalance(entries) {
    if (invariants_1.PAYMENT_INVARIANTS.DOUBLE_ENTRY_BALANCE.signal(entries)) {
      const debits = entries.filter((e) => e.type === 'DEBIT').reduce((s, e) => s + e.amount, 0);
      const credits = entries.filter((e) => e.type === 'CREDIT').reduce((s, e) => s + e.amount, 0);
      logger.error(
        `[INV-PAY-001] Double-entry balance violation: debits=${debits}, credits=${credits}`
      );
      throw errors_1.BusinessRuleError.violation(
        'Transaction entries must balance (debits = credits)',
        'مجموع بدهکاری و بستانکاری باید برابر باشد'
      );
    }
  },
  /**
   * INV-PAY-002: Non-Negative Balance
   * Ensures account balance never goes negative
   */
  verifyNonNegativeBalance(balance, accountId) {
    if (invariants_1.PAYMENT_INVARIANTS.NON_NEGATIVE_BALANCE.signal(balance)) {
      logger.error(`[INV-PAY-002] Negative balance detected for account ${accountId}: ${balance}`);
      throw errors_1.BusinessRuleError.insufficientBalance(accountId, Math.abs(balance), 0);
    }
  },
  /**
   * INV-PAY-003: Idempotency Key Binding
   * Ensures idempotency keys are bound to correct authority
   */
  verifyIdempotencyKeyBinding(stored, incoming) {
    if (
      stored &&
      invariants_1.PAYMENT_INVARIANTS.IDEMPOTENCY_KEY_BINDING.signal(stored, incoming)
    ) {
      logger.error(`[INV-PAY-003] Idempotency key mismatch: key=${incoming.key}`);
      throw errors_1.BusinessRuleError.violation(
        'Idempotency key already used with different authority',
        'کلید یکتاسازی قبلاً با مرجع دیگری استفاده شده است'
      );
    }
  },
  /**
   * INV-PAY-004: Amount Positivity
   * Ensures transaction amounts are positive
   */
  verifyAmountPositivity(amount) {
    if (invariants_1.PAYMENT_INVARIANTS.AMOUNT_POSITIVITY.signal(amount)) {
      logger.error(`[INV-PAY-004] Non-positive amount: ${amount}`);
      throw errors_1.ValidationError.invalidInput('amount', 'must be a positive number');
    }
  },
  /**
   * INV-PAY-005: Atomic Rollback on Failure
   * Verifies failed transactions didn't mutate balances
   * @throws Error - System unsafe (kill-switch)
   */
  verifyAtomicRollback(tx) {
    if (invariants_1.PAYMENT_INVARIANTS.ATOMIC_ROLLBACK.signal(tx)) {
      logger.error('[INV-PAY-005] CRITICAL: Atomic rollback failed - data corruption detected');
      throw new Error('KILL_SWITCH: Atomic rollback failed - halting payment processing');
    }
  },
  /**
   * INV-PAY-006: Verification Before Completion
   * Ensures payment is verified before marking complete
   * @throws Error - System unsafe (kill-switch)
   */
  verifyBeforeCompletion(payment) {
    if (invariants_1.PAYMENT_INVARIANTS.VERIFICATION_BEFORE_COMPLETION.signal(payment)) {
      logger.error('[INV-PAY-006] CRITICAL: Payment completed without verification');
      throw new Error('KILL_SWITCH: Payment verification required before completion');
    }
  },
};
// ═══════════════════════════════════════════════════════════════════════════
// ERROR INVARIANT ENFORCER
// ═══════════════════════════════════════════════════════════════════════════
exports.ErrorInvariantEnforcer = {
  /**
   * INV-ERR-001: One-to-One ErrorCode → Status Mapping
   * Validates the error code mapping at build/startup time
   */
  verifyOneToOneMapping() {
    if (invariants_1.ERROR_INVARIANTS.ONE_TO_ONE_MAPPING.signal()) {
      logger.error('[INV-ERR-001] ErrorCode to HTTP status mapping is not one-to-one');
      throw new Error('BUILD_FAILURE: ErrorCode mapping violation');
    }
  },
  /**
   * INV-ERR-002: AppError Boundary
   * Converts non-AppError to InternalError
   */
  assertAppError(error) {
    if (error instanceof app_error_1.AppError) {
      return error;
    }
    // Log the violation
    if (typeof error === 'string') {
      logger.warn(`[INV-ERR-002] String thrown as error: "${error}"`);
    } else if (error instanceof Error) {
      logger.warn(`[INV-ERR-002] Raw Error thrown: ${error.message}`);
    } else {
      logger.warn('[INV-ERR-002] Unknown error type thrown');
    }
    // Convert to InternalError
    return errors_1.InternalError.unknown();
  },
  /**
   * INV-ERR-003: RESOURCE_NOT_FOUND = 404 Only
   * Validates at build time
   */
  verifyNotFoundIs404() {
    if (invariants_1.ERROR_INVARIANTS.NOT_FOUND_IS_404.signal()) {
      logger.error('[INV-ERR-003] RESOURCE_NOT_FOUND must map to 404');
      throw new Error('BUILD_FAILURE: NOT_FOUND must be 404');
    }
  },
  /**
   * Get expected HTTP status for an error code
   */
  getExpectedStatus(code) {
    return invariants_1.ERROR_CODE_STATUS_MAP[code];
  },
  /**
   * Validate error code matches expected status
   */
  validateErrorCodeStatus(code, actualStatus) {
    const expectedStatus = invariants_1.ERROR_CODE_STATUS_MAP[code];
    if (expectedStatus !== actualStatus) {
      logger.warn(
        `[INV-ERR] Status mismatch for ${code}: expected ${expectedStatus}, got ${actualStatus}`
      );
      return false;
    }
    return true;
  },
};
// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED INVARIANT ENFORCER
// ═══════════════════════════════════════════════════════════════════════════
exports.InvariantEnforcer = {
  auth: exports.AuthInvariantEnforcer,
  payment: exports.PaymentInvariantEnforcer,
  error: exports.ErrorInvariantEnforcer,
  /**
   * Run all build-time invariant checks
   * Call this during application bootstrap
   */
  runBuildTimeChecks() {
    logger.log('Running build-time invariant checks...');
    // ERROR invariants
    exports.ErrorInvariantEnforcer.verifyOneToOneMapping();
    exports.ErrorInvariantEnforcer.verifyNotFoundIs404();
    logger.log('All build-time invariant checks passed ✓');
  },
  /**
   * Run startup invariant checks
   * Call this during application bootstrap with config
   */
  runStartupChecks(config) {
    logger.log('Running startup invariant checks...');
    // AUTH invariants
    exports.AuthInvariantEnforcer.verifySecretKeyNonDefault(config);
    logger.log('All startup invariant checks passed ✓');
  },
};
exports.default = exports.InvariantEnforcer;
//# sourceMappingURL=invariant-enforcer.js.map

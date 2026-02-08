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

import { Logger } from '@nestjs/common';
import { AuthenticationError, InternalError, BusinessRuleError, ValidationError } from './errors';
import {
  AUTH_INVARIANTS,
  PAYMENT_INVARIANTS,
  ERROR_INVARIANTS,
  ERROR_CODE_STATUS_MAP,
} from './invariants';
import { AppError, ErrorCode } from './app-error';

const logger = new Logger('InvariantEnforcer');

// ═══════════════════════════════════════════════════════════════════════════
// AUTH INVARIANT ENFORCER
// ═══════════════════════════════════════════════════════════════════════════

export const AuthInvariantEnforcer = {
  /**
   * INV-AUTH-001: Token Verification is Mandatory
   * Ensures protected routes have valid user context
   */
  verifyTokenMandatory(ctx: { user?: unknown; isPublic: boolean }): void {
    if (AUTH_INVARIANTS.TOKEN_VERIFICATION_MANDATORY.signal(ctx)) {
      logger.error('[INV-AUTH-001] Token verification mandatory - no user context on protected route');
      throw AuthenticationError.tokenInvalid();
    }
  },

  /**
   * INV-AUTH-002: Expired Token Rejection
   * Ensures expired tokens are rejected
   */
  verifyTokenNotExpired(payload: { exp?: number }): void {
    if (AUTH_INVARIANTS.EXPIRED_TOKEN_REJECTION.signal(payload)) {
      logger.warn('[INV-AUTH-002] Expired token rejected');
      throw AuthenticationError.tokenExpired();
    }
  },

  /**
   * INV-AUTH-003: Payload Integrity
   * Ensures JWT payload has required claims
   */
  verifyPayloadIntegrity(payload: { sub?: string; email?: string }): void {
    if (AUTH_INVARIANTS.PAYLOAD_INTEGRITY.signal(payload)) {
      logger.error('[INV-AUTH-003] Invalid token payload - missing required claims');
      throw AuthenticationError.tokenInvalid();
    }
  },

  /**
   * INV-AUTH-004: Secret Key Non-Default
   * Ensures production doesn't use default JWT secret
   * @throws Error - System refuses to start (kill-switch)
   */
  verifySecretKeyNonDefault(config: { jwtSecret: string; nodeEnv: string }): void {
    if (AUTH_INVARIANTS.SECRET_KEY_NON_DEFAULT.signal(config)) {
      logger.error('[INV-AUTH-004] CRITICAL: Default JWT secret in production - SYSTEM UNSAFE');
      throw new Error('KILL_SWITCH: JWT_SECRET must not be default in production');
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT INVARIANT ENFORCER
// ═══════════════════════════════════════════════════════════════════════════

export const PaymentInvariantEnforcer = {
  /**
   * INV-PAY-001: Double-Entry Balance
   * Ensures debits equal credits in any transaction
   */
  verifyDoubleEntryBalance(entries: Array<{ type: 'DEBIT' | 'CREDIT'; amount: number }>): void {
    if (PAYMENT_INVARIANTS.DOUBLE_ENTRY_BALANCE.signal(entries)) {
      const debits = entries.filter(e => e.type === 'DEBIT').reduce((s, e) => s + e.amount, 0);
      const credits = entries.filter(e => e.type === 'CREDIT').reduce((s, e) => s + e.amount, 0);
      logger.error(`[INV-PAY-001] Double-entry balance violation: debits=${debits}, credits=${credits}`);
      throw BusinessRuleError.violation(
        'Transaction entries must balance (debits = credits)',
        'مجموع بدهکاری و بستانکاری باید برابر باشد'
      );
    }
  },

  /**
   * INV-PAY-002: Non-Negative Balance
   * Ensures account balance never goes negative
   */
  verifyNonNegativeBalance(balance: number, accountId: string): void {
    if (PAYMENT_INVARIANTS.NON_NEGATIVE_BALANCE.signal(balance)) {
      logger.error(`[INV-PAY-002] Negative balance detected for account ${accountId}: ${balance}`);
      throw BusinessRuleError.insufficientBalance(accountId, Math.abs(balance), 0);
    }
  },

  /**
   * INV-PAY-003: Idempotency Key Binding
   * Ensures idempotency keys are bound to correct authority
   */
  verifyIdempotencyKeyBinding(
    stored: { key: string; authority: string } | null,
    incoming: { key: string; authority: string }
  ): void {
    if (stored && PAYMENT_INVARIANTS.IDEMPOTENCY_KEY_BINDING.signal(stored, incoming)) {
      logger.error(`[INV-PAY-003] Idempotency key mismatch: key=${incoming.key}`);
      throw BusinessRuleError.violation(
        'Idempotency key already used with different authority',
        'کلید یکتاسازی قبلاً با مرجع دیگری استفاده شده است'
      );
    }
  },

  /**
   * INV-PAY-004: Amount Positivity
   * Ensures transaction amounts are positive
   */
  verifyAmountPositivity(amount: number): void {
    if (PAYMENT_INVARIANTS.AMOUNT_POSITIVITY.signal(amount)) {
      logger.error(`[INV-PAY-004] Non-positive amount: ${amount}`);
      throw ValidationError.invalidInput('amount', 'must be a positive number');
    }
  },

  /**
   * INV-PAY-005: Atomic Rollback on Failure
   * Verifies failed transactions didn't mutate balances
   * @throws Error - System unsafe (kill-switch)
   */
  verifyAtomicRollback(tx: {
    status: string;
    balancesBefore: Map<string, number>;
    balancesAfter: Map<string, number>;
  }): void {
    if (PAYMENT_INVARIANTS.ATOMIC_ROLLBACK.signal(tx)) {
      logger.error('[INV-PAY-005] CRITICAL: Atomic rollback failed - data corruption detected');
      throw new Error('KILL_SWITCH: Atomic rollback failed - halting payment processing');
    }
  },

  /**
   * INV-PAY-006: Verification Before Completion
   * Ensures payment is verified before marking complete
   * @throws Error - System unsafe (kill-switch)
   */
  verifyBeforeCompletion(payment: { status: string; gatewayVerified: boolean }): void {
    if (PAYMENT_INVARIANTS.VERIFICATION_BEFORE_COMPLETION.signal(payment)) {
      logger.error('[INV-PAY-006] CRITICAL: Payment completed without verification');
      throw new Error('KILL_SWITCH: Payment verification required before completion');
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ERROR INVARIANT ENFORCER
// ═══════════════════════════════════════════════════════════════════════════

export const ErrorInvariantEnforcer = {
  /**
   * INV-ERR-001: One-to-One ErrorCode → Status Mapping
   * Validates the error code mapping at build/startup time
   */
  verifyOneToOneMapping(): void {
    if (ERROR_INVARIANTS.ONE_TO_ONE_MAPPING.signal()) {
      logger.error('[INV-ERR-001] ErrorCode to HTTP status mapping is not one-to-one');
      throw new Error('BUILD_FAILURE: ErrorCode mapping violation');
    }
  },

  /**
   * INV-ERR-002: AppError Boundary
   * Converts non-AppError to InternalError
   */
  assertAppError(error: unknown): AppError {
    if (error instanceof AppError) {
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
    return InternalError.unknown();
  },

  /**
   * INV-ERR-003: RESOURCE_NOT_FOUND = 404 Only
   * Validates at build time
   */
  verifyNotFoundIs404(): void {
    if (ERROR_INVARIANTS.NOT_FOUND_IS_404.signal()) {
      logger.error('[INV-ERR-003] RESOURCE_NOT_FOUND must map to 404');
      throw new Error('BUILD_FAILURE: NOT_FOUND must be 404');
    }
  },

  /**
   * Get expected HTTP status for an error code
   */
  getExpectedStatus(code: ErrorCode): number {
    return ERROR_CODE_STATUS_MAP[code];
  },

  /**
   * Validate error code matches expected status
   */
  validateErrorCodeStatus(code: ErrorCode, actualStatus: number): boolean {
    const expectedStatus = ERROR_CODE_STATUS_MAP[code];
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

export const InvariantEnforcer = {
  auth: AuthInvariantEnforcer,
  payment: PaymentInvariantEnforcer,
  error: ErrorInvariantEnforcer,

  /**
   * Run all build-time invariant checks
   * Call this during application bootstrap
   */
  runBuildTimeChecks(): void {
    logger.log('Running build-time invariant checks...');

    // ERROR invariants
    ErrorInvariantEnforcer.verifyOneToOneMapping();
    ErrorInvariantEnforcer.verifyNotFoundIs404();

    logger.log('All build-time invariant checks passed ✓');
  },

  /**
   * Run startup invariant checks
   * Call this during application bootstrap with config
   */
  runStartupChecks(config: { jwtSecret: string; nodeEnv: string }): void {
    logger.log('Running startup invariant checks...');

    // AUTH invariants
    AuthInvariantEnforcer.verifySecretKeyNonDefault(config);

    logger.log('All startup invariant checks passed ✓');
  },
};

export default InvariantEnforcer;

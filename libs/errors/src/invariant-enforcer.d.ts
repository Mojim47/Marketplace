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
import type { AppError, ErrorCode } from './app-error';
export declare const AuthInvariantEnforcer: {
  /**
   * INV-AUTH-001: Token Verification is Mandatory
   * Ensures protected routes have valid user context
   */
  verifyTokenMandatory(ctx: {
    user?: unknown;
    isPublic: boolean;
  }): void;
  /**
   * INV-AUTH-002: Expired Token Rejection
   * Ensures expired tokens are rejected
   */
  verifyTokenNotExpired(payload: {
    exp?: number;
  }): void;
  /**
   * INV-AUTH-003: Payload Integrity
   * Ensures JWT payload has required claims
   */
  verifyPayloadIntegrity(payload: {
    sub?: string;
    email?: string;
  }): void;
  /**
   * INV-AUTH-004: Secret Key Non-Default
   * Ensures production doesn't use default JWT secret
   * @throws Error - System refuses to start (kill-switch)
   */
  verifySecretKeyNonDefault(config: {
    jwtSecret: string;
    nodeEnv: string;
  }): void;
};
export declare const PaymentInvariantEnforcer: {
  /**
   * INV-PAY-001: Double-Entry Balance
   * Ensures debits equal credits in any transaction
   */
  verifyDoubleEntryBalance(
    entries: Array<{
      type: 'DEBIT' | 'CREDIT';
      amount: number;
    }>
  ): void;
  /**
   * INV-PAY-002: Non-Negative Balance
   * Ensures account balance never goes negative
   */
  verifyNonNegativeBalance(balance: number, accountId: string): void;
  /**
   * INV-PAY-003: Idempotency Key Binding
   * Ensures idempotency keys are bound to correct authority
   */
  verifyIdempotencyKeyBinding(
    stored: {
      key: string;
      authority: string;
    } | null,
    incoming: {
      key: string;
      authority: string;
    }
  ): void;
  /**
   * INV-PAY-004: Amount Positivity
   * Ensures transaction amounts are positive
   */
  verifyAmountPositivity(amount: number): void;
  /**
   * INV-PAY-005: Atomic Rollback on Failure
   * Verifies failed transactions didn't mutate balances
   * @throws Error - System unsafe (kill-switch)
   */
  verifyAtomicRollback(tx: {
    status: string;
    balancesBefore: Map<string, number>;
    balancesAfter: Map<string, number>;
  }): void;
  /**
   * INV-PAY-006: Verification Before Completion
   * Ensures payment is verified before marking complete
   * @throws Error - System unsafe (kill-switch)
   */
  verifyBeforeCompletion(payment: {
    status: string;
    gatewayVerified: boolean;
  }): void;
};
export declare const ErrorInvariantEnforcer: {
  /**
   * INV-ERR-001: One-to-One ErrorCode → Status Mapping
   * Validates the error code mapping at build/startup time
   */
  verifyOneToOneMapping(): void;
  /**
   * INV-ERR-002: AppError Boundary
   * Converts non-AppError to InternalError
   */
  assertAppError(error: unknown): AppError;
  /**
   * INV-ERR-003: RESOURCE_NOT_FOUND = 404 Only
   * Validates at build time
   */
  verifyNotFoundIs404(): void;
  /**
   * Get expected HTTP status for an error code
   */
  getExpectedStatus(code: ErrorCode): number;
  /**
   * Validate error code matches expected status
   */
  validateErrorCodeStatus(code: ErrorCode, actualStatus: number): boolean;
};
export declare const InvariantEnforcer: {
  auth: {
    /**
     * INV-AUTH-001: Token Verification is Mandatory
     * Ensures protected routes have valid user context
     */
    verifyTokenMandatory(ctx: {
      user?: unknown;
      isPublic: boolean;
    }): void;
    /**
     * INV-AUTH-002: Expired Token Rejection
     * Ensures expired tokens are rejected
     */
    verifyTokenNotExpired(payload: {
      exp?: number;
    }): void;
    /**
     * INV-AUTH-003: Payload Integrity
     * Ensures JWT payload has required claims
     */
    verifyPayloadIntegrity(payload: {
      sub?: string;
      email?: string;
    }): void;
    /**
     * INV-AUTH-004: Secret Key Non-Default
     * Ensures production doesn't use default JWT secret
     * @throws Error - System refuses to start (kill-switch)
     */
    verifySecretKeyNonDefault(config: {
      jwtSecret: string;
      nodeEnv: string;
    }): void;
  };
  payment: {
    /**
     * INV-PAY-001: Double-Entry Balance
     * Ensures debits equal credits in any transaction
     */
    verifyDoubleEntryBalance(
      entries: Array<{
        type: 'DEBIT' | 'CREDIT';
        amount: number;
      }>
    ): void;
    /**
     * INV-PAY-002: Non-Negative Balance
     * Ensures account balance never goes negative
     */
    verifyNonNegativeBalance(balance: number, accountId: string): void;
    /**
     * INV-PAY-003: Idempotency Key Binding
     * Ensures idempotency keys are bound to correct authority
     */
    verifyIdempotencyKeyBinding(
      stored: {
        key: string;
        authority: string;
      } | null,
      incoming: {
        key: string;
        authority: string;
      }
    ): void;
    /**
     * INV-PAY-004: Amount Positivity
     * Ensures transaction amounts are positive
     */
    verifyAmountPositivity(amount: number): void;
    /**
     * INV-PAY-005: Atomic Rollback on Failure
     * Verifies failed transactions didn't mutate balances
     * @throws Error - System unsafe (kill-switch)
     */
    verifyAtomicRollback(tx: {
      status: string;
      balancesBefore: Map<string, number>;
      balancesAfter: Map<string, number>;
    }): void;
    /**
     * INV-PAY-006: Verification Before Completion
     * Ensures payment is verified before marking complete
     * @throws Error - System unsafe (kill-switch)
     */
    verifyBeforeCompletion(payment: {
      status: string;
      gatewayVerified: boolean;
    }): void;
  };
  error: {
    /**
     * INV-ERR-001: One-to-One ErrorCode → Status Mapping
     * Validates the error code mapping at build/startup time
     */
    verifyOneToOneMapping(): void;
    /**
     * INV-ERR-002: AppError Boundary
     * Converts non-AppError to InternalError
     */
    assertAppError(error: unknown): AppError;
    /**
     * INV-ERR-003: RESOURCE_NOT_FOUND = 404 Only
     * Validates at build time
     */
    verifyNotFoundIs404(): void;
    /**
     * Get expected HTTP status for an error code
     */
    getExpectedStatus(code: ErrorCode): number;
    /**
     * Validate error code matches expected status
     */
    validateErrorCodeStatus(code: ErrorCode, actualStatus: number): boolean;
  };
  /**
   * Run all build-time invariant checks
   * Call this during application bootstrap
   */
  runBuildTimeChecks(): void;
  /**
   * Run startup invariant checks
   * Call this during application bootstrap with config
   */
  runStartupChecks(config: {
    jwtSecret: string;
    nodeEnv: string;
  }): void;
};
export default InvariantEnforcer;
//# sourceMappingURL=invariant-enforcer.d.ts.map

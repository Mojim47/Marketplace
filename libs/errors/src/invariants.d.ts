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
import type { HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './app-error';
export declare const AUTH_INVARIANTS: {
  /**
   * INV-AUTH-001: Token Verification is Mandatory
   * Signal: Request reaches protected handler without valid user context
   * Consequence: KILL REQUEST, LOG SECURITY EVENT
   */
  readonly TOKEN_VERIFICATION_MANDATORY: {
    readonly name: 'TOKEN_VERIFICATION_MANDATORY';
    readonly signal: (ctx: {
      user?: unknown;
      isPublic: boolean;
    }) => boolean;
    readonly consequence: 'REJECT_401';
    readonly enforceable: true;
  };
  /**
   * INV-AUTH-002: Expired Token Rejection
   * Signal: Token exp < current timestamp
   * Consequence: REJECT REQUEST, FORCE RE-AUTH
   */
  readonly EXPIRED_TOKEN_REJECTION: {
    readonly name: 'EXPIRED_TOKEN_REJECTION';
    readonly signal: (payload: {
      exp?: number;
    }) => boolean;
    readonly consequence: 'REJECT_401_TOKEN_EXPIRED';
    readonly enforceable: true;
  };
  /**
   * INV-AUTH-003: Payload Integrity
   * Signal: Token payload missing required claims (sub, email)
   * Consequence: REJECT REQUEST
   */
  readonly PAYLOAD_INTEGRITY: {
    readonly name: 'PAYLOAD_INTEGRITY';
    readonly signal: (payload: {
      sub?: string;
      email?: string;
    }) => boolean;
    readonly consequence: 'REJECT_401_INVALID_TOKEN';
    readonly enforceable: true;
  };
  /**
   * INV-AUTH-004: Secret Key Non-Default
   * Signal: JWT_SECRET === 'default-secret' in production
   * Consequence: SYSTEM UNSAFE - REFUSE TO START
   */
  readonly SECRET_KEY_NON_DEFAULT: {
    readonly name: 'SECRET_KEY_NON_DEFAULT';
    readonly signal: (config: {
      jwtSecret: string;
      nodeEnv: string;
    }) => boolean;
    readonly consequence: 'SYSTEM_UNSAFE_REFUSE_START';
    readonly enforceable: true;
  };
};
export declare const PAYMENT_INVARIANTS: {
  /**
   * INV-PAY-001: Double-Entry Balance
   * Signal: sum(debits) !== sum(credits) for any transaction
   * Consequence: REJECT TRANSACTION, NO BALANCE MUTATION
   */
  readonly DOUBLE_ENTRY_BALANCE: {
    readonly name: 'DOUBLE_ENTRY_BALANCE';
    readonly signal: (
      entries: Array<{
        type: 'DEBIT' | 'CREDIT';
        amount: number;
      }>
    ) => boolean;
    readonly consequence: 'REJECT_TRANSACTION';
    readonly enforceable: true;
  };
  /**
   * INV-PAY-002: Non-Negative Balance
   * Signal: account.balance < 0 after transaction
   * Consequence: ROLLBACK ENTIRE TRANSACTION
   */
  readonly NON_NEGATIVE_BALANCE: {
    readonly name: 'NON_NEGATIVE_BALANCE';
    readonly signal: (balance: number) => boolean;
    readonly consequence: 'ROLLBACK_TRANSACTION';
    readonly enforceable: true;
  };
  /**
   * INV-PAY-003: Idempotency Key Binding
   * Signal: Same idempotency key used with different authority/amount
   * Consequence: REJECT WITH IDEMPOTENCY_MISMATCH
   */
  readonly IDEMPOTENCY_KEY_BINDING: {
    readonly name: 'IDEMPOTENCY_KEY_BINDING';
    readonly signal: (
      stored: {
        key: string;
        authority: string;
      },
      incoming: {
        key: string;
        authority: string;
      }
    ) => boolean;
    readonly consequence: 'REJECT_IDEMPOTENCY_MISMATCH';
    readonly enforceable: true;
  };
  /**
   * INV-PAY-004: Amount Positivity
   * Signal: transaction.amount <= 0
   * Consequence: REJECT TRANSACTION
   */
  readonly AMOUNT_POSITIVITY: {
    readonly name: 'AMOUNT_POSITIVITY';
    readonly signal: (amount: number) => boolean;
    readonly consequence: 'REJECT_VALIDATION_ERROR';
    readonly enforceable: true;
  };
  /**
   * INV-PAY-005: Atomic Rollback on Failure
   * Signal: Transaction status = FAILED but balances changed
   * Consequence: SYSTEM UNSAFE - DATA CORRUPTION
   */
  readonly ATOMIC_ROLLBACK: {
    readonly name: 'ATOMIC_ROLLBACK';
    readonly signal: (tx: {
      status: string;
      balancesBefore: Map<string, number>;
      balancesAfter: Map<string, number>;
    }) => boolean;
    readonly consequence: 'SYSTEM_UNSAFE_DATA_CORRUPTION';
    readonly enforceable: true;
  };
  /**
   * INV-PAY-006: Verification Before Completion
   * Signal: Payment marked COMPLETED without gateway verification
   * Consequence: SYSTEM UNSAFE - FINANCIAL LOSS
   */
  readonly VERIFICATION_BEFORE_COMPLETION: {
    readonly name: 'VERIFICATION_BEFORE_COMPLETION';
    readonly signal: (payment: {
      status: string;
      gatewayVerified: boolean;
    }) => boolean;
    readonly consequence: 'SYSTEM_UNSAFE_FINANCIAL_LOSS';
    readonly enforceable: true;
  };
};
/**
 * CANONICAL ERROR CODE → HTTP STATUS MAPPING
 * This is the SINGLE SOURCE OF TRUTH. No exceptions.
 */
export declare const ERROR_CODE_STATUS_MAP: Record<ErrorCode, HttpStatus>;
export declare const ERROR_INVARIANTS: {
  /**
   * INV-ERR-001: One-to-One ErrorCode → Status Mapping
   * Signal: ErrorCode maps to multiple HTTP statuses
   * Consequence: BUILD FAILURE
   */
  readonly ONE_TO_ONE_MAPPING: {
    readonly name: 'ONE_TO_ONE_MAPPING';
    readonly signal: () => boolean;
    readonly consequence: 'BUILD_FAILURE';
    readonly enforceable: true;
  };
  /**
   * INV-ERR-002: AppError Boundary
   * Signal: Non-AppError reaches API response
   * Consequence: CONVERT TO INTERNAL_ERROR, LOG WARNING
   */
  readonly APP_ERROR_BOUNDARY: {
    readonly name: 'APP_ERROR_BOUNDARY';
    readonly signal: (error: unknown) => boolean;
    readonly consequence: 'CONVERT_TO_INTERNAL_ERROR';
    readonly enforceable: true;
  };
  /**
   * INV-ERR-003: RESOURCE_NOT_FOUND = 404 Only
   * Signal: RESOURCE_NOT_FOUND used with status !== 404
   * Consequence: BUILD FAILURE
   */
  readonly NOT_FOUND_IS_404: {
    readonly name: 'NOT_FOUND_IS_404';
    readonly signal: () => boolean;
    readonly consequence: 'BUILD_FAILURE';
    readonly enforceable: true;
  };
  /**
   * INV-ERR-004: No Raw Error Throws
   * Signal: throw new Error() or throw "string" in codebase
   * Consequence: LINT FAILURE
   */
  readonly NO_RAW_ERROR_THROWS: {
    readonly name: 'NO_RAW_ERROR_THROWS';
    readonly signal: 'STATIC_ANALYSIS_REQUIRED';
    readonly consequence: 'LINT_FAILURE';
    readonly enforceable: false;
  };
  /**
   * INV-ERR-005: Immutable Status Code
   * Signal: Error statusCode modified after construction
   * Consequence: TYPE ERROR (readonly)
   */
  readonly IMMUTABLE_STATUS_CODE: {
    readonly name: 'IMMUTABLE_STATUS_CODE';
    readonly signal: 'TYPE_SYSTEM_ENFORCED';
    readonly consequence: 'COMPILE_FAILURE';
    readonly enforceable: true;
  };
};
export declare const KILL_SWITCH_CONDITIONS: readonly [
  {
    readonly condition: 'AUTH_INVARIANTS.SECRET_KEY_NON_DEFAULT violated';
    readonly action: 'REFUSE_TO_START';
    readonly severity: 'CRITICAL';
  },
  {
    readonly condition: 'PAYMENT_INVARIANTS.ATOMIC_ROLLBACK violated';
    readonly action: 'HALT_PAYMENT_PROCESSING';
    readonly severity: 'CRITICAL';
  },
  {
    readonly condition: 'PAYMENT_INVARIANTS.VERIFICATION_BEFORE_COMPLETION violated';
    readonly action: 'HALT_PAYMENT_PROCESSING';
    readonly severity: 'CRITICAL';
  },
  {
    readonly condition: 'ERROR_INVARIANTS.ONE_TO_ONE_MAPPING violated';
    readonly action: 'FAIL_BUILD';
    readonly severity: 'BLOCKING';
  },
  {
    readonly condition: 'ERROR_INVARIANTS.NOT_FOUND_IS_404 violated';
    readonly action: 'FAIL_BUILD';
    readonly severity: 'BLOCKING';
  },
];
export declare const DETECTION_POINTS: {
  readonly AUTH: readonly [
    {
      readonly point: 'JwtAuthGuard.canActivate';
      readonly invariants: readonly ['TOKEN_VERIFICATION_MANDATORY'];
    },
    {
      readonly point: 'JwtStrategy.validate';
      readonly invariants: readonly ['PAYLOAD_INTEGRITY', 'EXPIRED_TOKEN_REJECTION'];
    },
    {
      readonly point: 'Application.bootstrap';
      readonly invariants: readonly ['SECRET_KEY_NON_DEFAULT'];
    },
  ];
  readonly PAYMENT: readonly [
    {
      readonly point: 'TransactionManager.validateEntries';
      readonly invariants: readonly ['DOUBLE_ENTRY_BALANCE', 'AMOUNT_POSITIVITY'];
    },
    {
      readonly point: 'TransactionManager.executeTransaction';
      readonly invariants: readonly ['NON_NEGATIVE_BALANCE', 'ATOMIC_ROLLBACK'];
    },
    {
      readonly point: 'ZarinpalService.verifyPayment';
      readonly invariants: readonly ['VERIFICATION_BEFORE_COMPLETION'];
    },
    {
      readonly point: 'PaymentService.initialize';
      readonly invariants: readonly ['IDEMPOTENCY_KEY_BINDING'];
    },
  ];
  readonly ERROR: readonly [
    {
      readonly point: 'GlobalExceptionFilter.catch';
      readonly invariants: readonly ['APP_ERROR_BOUNDARY'];
    },
    {
      readonly point: 'AppError.constructor';
      readonly invariants: readonly ['IMMUTABLE_STATUS_CODE'];
    },
    {
      readonly point: 'CI/Build';
      readonly invariants: readonly ['ONE_TO_ONE_MAPPING', 'NOT_FOUND_IS_404'];
    },
    {
      readonly point: 'ESLint';
      readonly invariants: readonly ['NO_RAW_ERROR_THROWS'];
    },
  ];
};
export declare const SYSTEM_SAFETY_STATUS: {
  readonly AUTH: 'SAFE';
  readonly PAYMENT: 'SAFE';
  readonly ERROR: 'CONDITIONAL';
  readonly OVERALL: 'CONDITIONAL';
  readonly REASON: 'INV-ERR-004 (NO_RAW_ERROR_THROWS) requires static analysis via ESLint rule';
  readonly REMEDIATION: 'Add ESLint rule: no-throw-literal + custom rule for raw Error()';
};
//# sourceMappingURL=invariants.d.ts.map

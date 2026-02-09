/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Invariant Enforcer Tests
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from './errors';
import {
  AuthInvariantEnforcer,
  ErrorInvariantEnforcer,
  InvariantEnforcer,
  PaymentInvariantEnforcer,
} from './invariant-enforcer';

// Helper to check error type by name (works around instanceof issues with custom errors)
const expectToThrowErrorType = (fn: () => void, errorName: string) => {
  try {
    fn();
    throw new Error(`Expected function to throw ${errorName}`);
  } catch (e) {
    expect((e as Error).constructor.name).toBe(errorName);
  }
};

const expectInstanceOfByName = (obj: unknown, className: string) => {
  expect((obj as object).constructor.name).toBe(className);
};

describe('InvariantEnforcer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('AuthInvariantEnforcer', () => {
    describe('INV-AUTH-001: verifyTokenMandatory', () => {
      it('should pass when route is public', () => {
        expect(() =>
          AuthInvariantEnforcer.verifyTokenMandatory({ user: undefined, isPublic: true })
        ).not.toThrow();
      });

      it('should pass when user exists on protected route', () => {
        expect(() =>
          AuthInvariantEnforcer.verifyTokenMandatory({ user: { id: '1' }, isPublic: false })
        ).not.toThrow();
      });

      it('should throw AuthenticationError when no user on protected route', () => {
        expectToThrowErrorType(
          () => AuthInvariantEnforcer.verifyTokenMandatory({ user: undefined, isPublic: false }),
          'AuthenticationError'
        );
      });
    });

    describe('INV-AUTH-002: verifyTokenNotExpired', () => {
      it('should pass when token is not expired', () => {
        const futureExp = Math.floor(Date.now() / 1000) + 3600;
        expect(() => AuthInvariantEnforcer.verifyTokenNotExpired({ exp: futureExp })).not.toThrow();
      });

      it('should pass when exp is undefined', () => {
        expect(() => AuthInvariantEnforcer.verifyTokenNotExpired({})).not.toThrow();
      });

      it('should throw AuthenticationError when token is expired', () => {
        const pastExp = Math.floor(Date.now() / 1000) - 3600;
        expectToThrowErrorType(
          () => AuthInvariantEnforcer.verifyTokenNotExpired({ exp: pastExp }),
          'AuthenticationError'
        );
      });
    });

    describe('INV-AUTH-003: verifyPayloadIntegrity', () => {
      it('should pass when payload has sub and email', () => {
        expect(() =>
          AuthInvariantEnforcer.verifyPayloadIntegrity({ sub: 'user-1', email: 'test@example.com' })
        ).not.toThrow();
      });

      it('should throw when sub is missing', () => {
        expectToThrowErrorType(
          () => AuthInvariantEnforcer.verifyPayloadIntegrity({ email: 'test@example.com' }),
          'AuthenticationError'
        );
      });

      it('should throw when email is missing', () => {
        expectToThrowErrorType(
          () => AuthInvariantEnforcer.verifyPayloadIntegrity({ sub: 'user-1' }),
          'AuthenticationError'
        );
      });
    });

    describe('INV-AUTH-004: verifySecretKeyNonDefault', () => {
      it('should pass in development with default secret', () => {
        expect(() =>
          AuthInvariantEnforcer.verifySecretKeyNonDefault({
            jwtSecret: 'default-secret',
            nodeEnv: 'development',
          })
        ).not.toThrow();
      });

      it('should pass in production with custom secret', () => {
        expect(() =>
          AuthInvariantEnforcer.verifySecretKeyNonDefault({
            jwtSecret: 'super-secure-secret-key',
            nodeEnv: 'production',
          })
        ).not.toThrow();
      });

      it('should throw KILL_SWITCH in production with default secret', () => {
        expect(() =>
          AuthInvariantEnforcer.verifySecretKeyNonDefault({
            jwtSecret: 'default-secret',
            nodeEnv: 'production',
          })
        ).toThrow('KILL_SWITCH');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('PaymentInvariantEnforcer', () => {
    describe('INV-PAY-001: verifyDoubleEntryBalance', () => {
      it('should pass when debits equal credits', () => {
        const entries = [
          { type: 'DEBIT' as const, amount: 1000 },
          { type: 'CREDIT' as const, amount: 1000 },
        ];
        expect(() => PaymentInvariantEnforcer.verifyDoubleEntryBalance(entries)).not.toThrow();
      });

      it('should pass with multiple balanced entries', () => {
        const entries = [
          { type: 'DEBIT' as const, amount: 500 },
          { type: 'DEBIT' as const, amount: 500 },
          { type: 'CREDIT' as const, amount: 700 },
          { type: 'CREDIT' as const, amount: 300 },
        ];
        expect(() => PaymentInvariantEnforcer.verifyDoubleEntryBalance(entries)).not.toThrow();
      });

      it('should throw BusinessRuleError when unbalanced', () => {
        const entries = [
          { type: 'DEBIT' as const, amount: 1000 },
          { type: 'CREDIT' as const, amount: 900 },
        ];
        expectToThrowErrorType(
          () => PaymentInvariantEnforcer.verifyDoubleEntryBalance(entries),
          'BusinessRuleError'
        );
      });
    });

    describe('INV-PAY-002: verifyNonNegativeBalance', () => {
      it('should pass with positive balance', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyNonNegativeBalance(1000, 'acc-1')
        ).not.toThrow();
      });

      it('should pass with zero balance', () => {
        expect(() => PaymentInvariantEnforcer.verifyNonNegativeBalance(0, 'acc-1')).not.toThrow();
      });

      it('should throw BusinessRuleError with negative balance', () => {
        expectToThrowErrorType(
          () => PaymentInvariantEnforcer.verifyNonNegativeBalance(-100, 'acc-1'),
          'BusinessRuleError'
        );
      });
    });

    describe('INV-PAY-003: verifyIdempotencyKeyBinding', () => {
      it('should pass when no stored key', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyIdempotencyKeyBinding(null, {
            key: 'key-1',
            authority: 'auth-1',
          })
        ).not.toThrow();
      });

      it('should pass when authorities match', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyIdempotencyKeyBinding(
            { key: 'key-1', authority: 'auth-1' },
            { key: 'key-1', authority: 'auth-1' }
          )
        ).not.toThrow();
      });

      it('should throw when authorities mismatch', () => {
        expectToThrowErrorType(
          () =>
            PaymentInvariantEnforcer.verifyIdempotencyKeyBinding(
              { key: 'key-1', authority: 'auth-1' },
              { key: 'key-1', authority: 'auth-2' }
            ),
          'BusinessRuleError'
        );
      });
    });

    describe('INV-PAY-004: verifyAmountPositivity', () => {
      it('should pass with positive amount', () => {
        expect(() => PaymentInvariantEnforcer.verifyAmountPositivity(100)).not.toThrow();
      });

      it('should throw ValidationError with zero amount', () => {
        expectToThrowErrorType(
          () => PaymentInvariantEnforcer.verifyAmountPositivity(0),
          'ValidationError'
        );
      });

      it('should throw ValidationError with negative amount', () => {
        expectToThrowErrorType(
          () => PaymentInvariantEnforcer.verifyAmountPositivity(-100),
          'ValidationError'
        );
      });
    });

    describe('INV-PAY-005: verifyAtomicRollback', () => {
      it('should pass when transaction succeeded', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyAtomicRollback({
            status: 'COMPLETED',
            balancesBefore: new Map([['acc-1', 1000]]),
            balancesAfter: new Map([['acc-1', 900]]),
          })
        ).not.toThrow();
      });

      it('should pass when failed transaction has unchanged balances', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyAtomicRollback({
            status: 'FAILED',
            balancesBefore: new Map([['acc-1', 1000]]),
            balancesAfter: new Map([['acc-1', 1000]]),
          })
        ).not.toThrow();
      });

      it('should throw KILL_SWITCH when failed transaction has changed balances', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyAtomicRollback({
            status: 'FAILED',
            balancesBefore: new Map([['acc-1', 1000]]),
            balancesAfter: new Map([['acc-1', 900]]),
          })
        ).toThrow('KILL_SWITCH');
      });
    });

    describe('INV-PAY-006: verifyBeforeCompletion', () => {
      it('should pass when payment is verified', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyBeforeCompletion({
            status: 'COMPLETED',
            gatewayVerified: true,
          })
        ).not.toThrow();
      });

      it('should pass when payment is not completed', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyBeforeCompletion({
            status: 'PENDING',
            gatewayVerified: false,
          })
        ).not.toThrow();
      });

      it('should throw KILL_SWITCH when completed without verification', () => {
        expect(() =>
          PaymentInvariantEnforcer.verifyBeforeCompletion({
            status: 'COMPLETED',
            gatewayVerified: false,
          })
        ).toThrow('KILL_SWITCH');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ErrorInvariantEnforcer', () => {
    describe('INV-ERR-001: verifyOneToOneMapping', () => {
      it('should pass with valid mapping', () => {
        expect(() => ErrorInvariantEnforcer.verifyOneToOneMapping()).not.toThrow();
      });
    });

    describe('INV-ERR-002: assertAppError', () => {
      it('should return AppError as-is', () => {
        const error = ValidationError.invalidInput('field', 'reason');
        const result = ErrorInvariantEnforcer.assertAppError(error);
        expect(result).toBe(error);
      });

      it('should convert raw Error to InternalError', () => {
        const error = new Error('raw error');
        const result = ErrorInvariantEnforcer.assertAppError(error);
        expectInstanceOfByName(result, 'InternalError');
      });

      it('should convert string to InternalError', () => {
        const result = ErrorInvariantEnforcer.assertAppError('string error');
        expectInstanceOfByName(result, 'InternalError');
      });

      it('should convert unknown to InternalError', () => {
        const result = ErrorInvariantEnforcer.assertAppError({ unknown: true });
        expectInstanceOfByName(result, 'InternalError');
      });
    });

    describe('INV-ERR-003: verifyNotFoundIs404', () => {
      it('should pass with correct mapping', () => {
        expect(() => ErrorInvariantEnforcer.verifyNotFoundIs404()).not.toThrow();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED ENFORCER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Unified InvariantEnforcer', () => {
    it('should have auth, payment, and error enforcers', () => {
      expect(InvariantEnforcer.auth).toBe(AuthInvariantEnforcer);
      expect(InvariantEnforcer.payment).toBe(PaymentInvariantEnforcer);
      expect(InvariantEnforcer.error).toBe(ErrorInvariantEnforcer);
    });

    it('should run build-time checks without throwing', () => {
      expect(() => InvariantEnforcer.runBuildTimeChecks()).not.toThrow();
    });

    it('should run startup checks in development', () => {
      expect(() =>
        InvariantEnforcer.runStartupChecks({
          jwtSecret: 'default-secret',
          nodeEnv: 'development',
        })
      ).not.toThrow();
    });
  });
});

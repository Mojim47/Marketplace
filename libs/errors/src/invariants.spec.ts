/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INVARIANT ENFORCEMENT TESTS - MECHANICAL VERIFICATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import {
  AUTH_INVARIANTS,
  PAYMENT_INVARIANTS,
  ERROR_INVARIANTS,
  ERROR_CODE_STATUS_MAP,
  KILL_SWITCH_CONDITIONS,
  SYSTEM_SAFETY_STATUS,
} from './invariants';
import { ErrorCode } from './app-error';

describe('INVARIANT ENFORCEMENT', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('AUTH INVARIANTS', () => {
    it('INV-AUTH-001: detects missing user on protected route', () => {
      const signal = AUTH_INVARIANTS.TOKEN_VERIFICATION_MANDATORY.signal;
      
      expect(signal({ user: undefined, isPublic: false })).toBe(true); // VIOLATION
      expect(signal({ user: { id: '1' }, isPublic: false })).toBe(false); // OK
      expect(signal({ user: undefined, isPublic: true })).toBe(false); // OK (public)
    });

    it('INV-AUTH-002: detects expired token', () => {
      const signal = AUTH_INVARIANTS.EXPIRED_TOKEN_REJECTION.signal;
      const now = Math.floor(Date.now() / 1000);
      
      expect(signal({ exp: now - 100 })).toBe(true); // VIOLATION (expired)
      expect(signal({ exp: now + 100 })).toBe(false); // OK (valid)
      expect(signal({})).toBe(false); // OK (no exp = handled elsewhere)
    });

    it('INV-AUTH-003: detects invalid payload', () => {
      const signal = AUTH_INVARIANTS.PAYLOAD_INTEGRITY.signal;
      
      expect(signal({})).toBe(true); // VIOLATION
      expect(signal({ sub: '1' })).toBe(true); // VIOLATION (missing email)
      expect(signal({ email: 'a@b.c' })).toBe(true); // VIOLATION (missing sub)
      expect(signal({ sub: '1', email: 'a@b.c' })).toBe(false); // OK
    });

    it('INV-AUTH-004: detects default secret in production', () => {
      const signal = AUTH_INVARIANTS.SECRET_KEY_NON_DEFAULT.signal;
      
      expect(signal({ jwtSecret: 'default-secret', nodeEnv: 'production' })).toBe(true); // VIOLATION
      expect(signal({ jwtSecret: 'real-secret', nodeEnv: 'production' })).toBe(false); // OK
      expect(signal({ jwtSecret: 'default-secret', nodeEnv: 'development' })).toBe(false); // OK (dev)
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('PAYMENT INVARIANTS', () => {
    it('INV-PAY-001: detects unbalanced double-entry', () => {
      const signal = PAYMENT_INVARIANTS.DOUBLE_ENTRY_BALANCE.signal;
      
      // VIOLATION: debits != credits
      expect(signal([
        { type: 'DEBIT', amount: 100 },
        { type: 'CREDIT', amount: 50 },
      ])).toBe(true);
      
      // OK: balanced
      expect(signal([
        { type: 'DEBIT', amount: 100 },
        { type: 'CREDIT', amount: 100 },
      ])).toBe(false);
    });

    it('INV-PAY-002: detects negative balance', () => {
      const signal = PAYMENT_INVARIANTS.NON_NEGATIVE_BALANCE.signal;
      
      expect(signal(-1)).toBe(true); // VIOLATION
      expect(signal(0)).toBe(false); // OK
      expect(signal(100)).toBe(false); // OK
    });

    it('INV-PAY-003: detects idempotency key mismatch', () => {
      const signal = PAYMENT_INVARIANTS.IDEMPOTENCY_KEY_BINDING.signal;
      
      // VIOLATION: same key, different authority
      expect(signal(
        { key: 'k1', authority: 'auth1' },
        { key: 'k1', authority: 'auth2' }
      )).toBe(true);
      
      // OK: same key, same authority
      expect(signal(
        { key: 'k1', authority: 'auth1' },
        { key: 'k1', authority: 'auth1' }
      )).toBe(false);
      
      // OK: different keys
      expect(signal(
        { key: 'k1', authority: 'auth1' },
        { key: 'k2', authority: 'auth2' }
      )).toBe(false);
    });

    it('INV-PAY-004: detects non-positive amount', () => {
      const signal = PAYMENT_INVARIANTS.AMOUNT_POSITIVITY.signal;
      
      expect(signal(0)).toBe(true); // VIOLATION
      expect(signal(-100)).toBe(true); // VIOLATION
      expect(signal(1)).toBe(false); // OK
    });

    it('INV-PAY-005: detects failed transaction with changed balances', () => {
      const signal = PAYMENT_INVARIANTS.ATOMIC_ROLLBACK.signal;
      
      // VIOLATION: FAILED but balances changed
      expect(signal({
        status: 'FAILED',
        balancesBefore: new Map([['acc1', 100]]),
        balancesAfter: new Map([['acc1', 50]]),
      })).toBe(true);
      
      // OK: FAILED and balances unchanged
      expect(signal({
        status: 'FAILED',
        balancesBefore: new Map([['acc1', 100]]),
        balancesAfter: new Map([['acc1', 100]]),
      })).toBe(false);
      
      // OK: COMPLETED (not checking)
      expect(signal({
        status: 'COMPLETED',
        balancesBefore: new Map([['acc1', 100]]),
        balancesAfter: new Map([['acc1', 50]]),
      })).toBe(false);
    });

    it('INV-PAY-006: detects unverified completion', () => {
      const signal = PAYMENT_INVARIANTS.VERIFICATION_BEFORE_COMPLETION.signal;
      
      expect(signal({ status: 'COMPLETED', gatewayVerified: false })).toBe(true); // VIOLATION
      expect(signal({ status: 'COMPLETED', gatewayVerified: true })).toBe(false); // OK
      expect(signal({ status: 'PENDING', gatewayVerified: false })).toBe(false); // OK
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ERROR INVARIANTS', () => {
    it('INV-ERR-001: ErrorCode → Status is one-to-one', () => {
      const signal = ERROR_INVARIANTS.ONE_TO_ONE_MAPPING.signal;
      
      // Should NOT detect violation (our mapping is correct)
      expect(signal()).toBe(false);
    });

    it('INV-ERR-002: detects non-AppError at boundary', () => {
      const signal = ERROR_INVARIANTS.APP_ERROR_BOUNDARY.signal;
      
      expect(signal(new Error('raw'))).toBe(true); // VIOLATION
      expect(signal('string error')).toBe(true); // VIOLATION
      expect(signal(null)).toBe(true); // VIOLATION
      expect(signal({ statusCode: 400, code: 'X' })).toBe(false); // OK (AppError-like)
    });

    it('INV-ERR-003: RESOURCE_NOT_FOUND maps to 404', () => {
      const signal = ERROR_INVARIANTS.NOT_FOUND_IS_404.signal;
      
      // Should NOT detect violation
      expect(signal()).toBe(false);
      expect(ERROR_CODE_STATUS_MAP[ErrorCode.RESOURCE_NOT_FOUND]).toBe(HttpStatus.NOT_FOUND);
    });

    it('all ErrorCodes have exactly one status', () => {
      const allCodes = Object.values(ErrorCode);
      const mappedCodes = Object.keys(ERROR_CODE_STATUS_MAP);
      
      expect(mappedCodes.length).toBe(allCodes.length);
      
      for (const code of allCodes) {
        expect(ERROR_CODE_STATUS_MAP[code]).toBeDefined();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KILL-SWITCH CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('KILL-SWITCH CONDITIONS', () => {
    it('has defined kill-switch conditions', () => {
      expect(KILL_SWITCH_CONDITIONS.length).toBeGreaterThan(0);
      
      for (const ks of KILL_SWITCH_CONDITIONS) {
        expect(ks.condition).toBeDefined();
        expect(ks.action).toBeDefined();
        expect(ks.severity).toMatch(/CRITICAL|BLOCKING/);
      }
    });

    it('critical conditions halt system', () => {
      const critical = KILL_SWITCH_CONDITIONS.filter(k => k.severity === 'CRITICAL');
      
      expect(critical.length).toBeGreaterThan(0);
      for (const ks of critical) {
        expect(ks.action).toMatch(/REFUSE_TO_START|HALT/);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM SAFETY ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SYSTEM SAFETY ASSESSMENT', () => {
    it('AUTH is SAFE', () => {
      expect(SYSTEM_SAFETY_STATUS.AUTH).toBe('SAFE');
    });

    it('PAYMENT is SAFE', () => {
      expect(SYSTEM_SAFETY_STATUS.PAYMENT).toBe('SAFE');
    });

    it('ERROR is CONDITIONAL (requires ESLint)', () => {
      expect(SYSTEM_SAFETY_STATUS.ERROR).toBe('CONDITIONAL');
      expect(SYSTEM_SAFETY_STATUS.REASON).toContain('ESLint');
    });

    it('documents remediation path', () => {
      expect(SYSTEM_SAFETY_STATUS.REMEDIATION).toBeDefined();
      expect(SYSTEM_SAFETY_STATUS.REMEDIATION.length).toBeGreaterThan(0);
    });
  });
});

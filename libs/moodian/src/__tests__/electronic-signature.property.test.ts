/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Property Tests for Electronic Signature Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feature: b2b-enterprise-audit
 * Property 3: Electronic Signature Round-Trip
 * Validates: Requirements 1.6
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as crypto from 'crypto';
import { signData, verifySignature, hashData } from '../electronic-signature.service';

// Helper to generate 14-digit tax ID
const taxIdArbitrary = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 14, maxLength: 14 })
  .map((digits) => digits.join(''));

describe('ElectronicSignatureService Property Tests', () => {
  let privateKey: string;
  let publicKey: string;

  beforeAll(() => {
    // Generate test key pair
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Property 3: Electronic Signature Round-Trip
  // Validates: Requirements 1.6
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Property 3: Electronic Signature Round-Trip', () => {
    /**
     * Feature: b2b-enterprise-audit, Property 3: Electronic Signature Round-Trip
     * Validates: Requirements 1.6
     *
     * *For any* Tax Invoice, signing with RSA-SHA256 and then verifying with
     * the public key should return true for unmodified invoices and false
     * for modified invoices.
     */
    it('should verify signature for unmodified data', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 1000 }), (data) => {
          const signature = signData(data, privateKey);
          const isValid = verifySignature(data, signature, publicKey);

          // Signature must be valid for unmodified data
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject signature for modified data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (originalData, modification) => {
            fc.pre(modification !== ''); // Ensure modification is not empty

            const signature = signData(originalData, privateKey);
            const modifiedData = originalData + modification;
            const isValid = verifySignature(modifiedData, signature, publicKey);

            // Signature must be invalid for modified data
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify signature for JSON objects', () => {
      fc.assert(
        fc.property(
          fc.record({
            invoiceNumber: fc.string({ minLength: 1, maxLength: 50 }),
            suid: fc.string({ minLength: 22, maxLength: 22 }),
            sellerTaxId: taxIdArbitrary,
            totalAmount: fc.integer({ min: 1, max: 1000000000 }),
            items: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 100 }),
                quantity: fc.integer({ min: 1, max: 1000 }),
                price: fc.integer({ min: 1, max: 1000000 }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
          }),
          (invoice) => {
            const signature = signData(invoice, privateKey);
            const isValid = verifySignature(invoice, signature, publicKey);

            // Signature must be valid for unmodified invoice
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject signature when invoice amount is modified', () => {
      fc.assert(
        fc.property(
          fc.record({
            invoiceNumber: fc.string({ minLength: 1, maxLength: 50 }),
            totalAmount: fc.integer({ min: 1, max: 1000000000 }),
          }),
          fc.integer({ min: 1, max: 1000000 }),
          (invoice, amountChange) => {
            fc.pre(amountChange !== 0);

            const signature = signData(invoice, privateKey);
            const modifiedInvoice = { ...invoice, totalAmount: invoice.totalAmount + amountChange };
            const isValid = verifySignature(modifiedInvoice, signature, publicKey);

            // Signature must be invalid when amount is modified
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different signatures for different data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          (data1, data2) => {
            fc.pre(data1 !== data2);

            const signature1 = signData(data1, privateKey);
            const signature2 = signData(data2, privateKey);

            // Different data should produce different signatures
            expect(signature1).not.toBe(signature2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce same signature for same data', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 500 }), (data) => {
          const signature1 = signData(data, privateKey);
          const signature2 = signData(data, privateKey);

          // Same data should produce same signature (deterministic)
          expect(signature1).toBe(signature2);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Hash Function Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Hash Function Properties', () => {
    it('should produce consistent hash for same input', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (data) => {
          const hash1 = hashData(data);
          const hash2 = hashData(data);

          expect(hash1).toBe(hash2);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce different hash for different input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          (data1, data2) => {
            fc.pre(data1 !== data2);

            const hash1 = hashData(data1);
            const hash2 = hashData(data2);

            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce 64-character hex hash (SHA256)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (data) => {
          const hash = hashData(data);

          expect(hash).toHaveLength(64);
          expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Signature Format Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Signature Format', () => {
    it('should produce valid Base64 signature', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 500 }), (data) => {
          const signature = signData(data, privateKey);

          // Signature should be valid Base64
          expect(() => Buffer.from(signature, 'base64')).not.toThrow();

          // Re-encoding should produce same result
          const decoded = Buffer.from(signature, 'base64');
          const reencoded = decoded.toString('base64');
          expect(reencoded).toBe(signature);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce non-empty signature', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 500 }), (data) => {
          const signature = signData(data, privateKey);

          expect(signature.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});

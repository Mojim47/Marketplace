/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Property Tests for SUID Generator Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feature: b2b-enterprise-audit
 * Property 1: Tax Invoice SUID Uniqueness and Format
 * Validates: Requirements 1.2
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { SUIDGeneratorService } from '../suid-generator.service';

// Helper to generate 14-digit tax ID
const taxIdArbitrary = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 14, maxLength: 14 })
  .map((digits) => digits.join(''));

describe('SUIDGeneratorService Property Tests', () => {
  let service: SUIDGeneratorService;

  beforeEach(() => {
    service = new SUIDGeneratorService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Property 1: Tax Invoice SUID Uniqueness and Format
  // Validates: Requirements 1.2
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Property 1: SUID Uniqueness and Format', () => {
    /**
     * Feature: b2b-enterprise-audit, Property 1: Tax Invoice SUID Uniqueness and Format
     * Validates: Requirements 1.2
     *
     * *For any* Tax Invoice created, the generated SUID should be unique across
     * all invoices and match the 22-character format required by Moodian.
     */
    it('should generate SUID with exactly 22 characters', () => {
      fc.assert(
        fc.property(
          taxIdArbitrary,
          fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .filter((d) => !Number.isNaN(d.getTime())),
          (taxId, issueDate) => {
            const result = service.generateSUID(taxId, issueDate);

            // SUID must be exactly 22 characters
            expect(result.suid).toHaveLength(22);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate SUID starting with seller tax ID', () => {
      fc.assert(
        fc.property(
          taxIdArbitrary,
          fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .filter((d) => !Number.isNaN(d.getTime())),
          (taxId, issueDate) => {
            const result = service.generateSUID(taxId, issueDate);

            // First 14 characters must be the seller tax ID
            expect(result.suid.substring(0, 14)).toBe(taxId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique SUIds for different invoices', () => {
      fc.assert(
        fc.property(
          taxIdArbitrary,
          fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .filter((d) => !Number.isNaN(d.getTime())),
          fc.integer({ min: 2, max: 10 }),
          (taxId, issueDate, count) => {
            const suids = new Set<string>();

            for (let i = 0; i < count; i++) {
              const result = service.generateSUID(taxId, issueDate);
              suids.add(result.suid);
            }

            // All generated SUIds must be unique
            expect(suids.size).toBe(count);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate valid SUID that passes validation', () => {
      fc.assert(
        fc.property(
          taxIdArbitrary,
          fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .filter((d) => !Number.isNaN(d.getTime())),
          (taxId, issueDate) => {
            const result = service.generateSUID(taxId, issueDate);

            // Generated SUID must pass validation
            expect(service.validateSUID(result.suid)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid tax IDs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Too short
            fc
              .array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 13 })
              .map((d) => d.join('')),
            // Too long
            fc
              .array(fc.integer({ min: 0, max: 9 }), { minLength: 15, maxLength: 20 })
              .map((d) => d.join('')),
            // Contains non-digits
            fc
              .string({ minLength: 14, maxLength: 14 })
              .filter((s) => !/^\d{14}$/.test(s))
          ),
          (invalidTaxId) => {
            expect(() => service.generateSUID(invalidTaxId)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly parse generated SUID back to components', () => {
      fc.assert(
        fc.property(
          taxIdArbitrary,
          fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .filter((d) => !Number.isNaN(d.getTime())),
          (taxId, issueDate) => {
            const result = service.generateSUID(taxId, issueDate);
            const parsed = service.parseSUID(result.suid);

            // Parsed components must match original
            expect(parsed).not.toBeNull();
            expect(parsed?.sellerTaxId).toBe(taxId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Tax ID Validation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Tax ID Validation', () => {
    it('should validate correct 14-digit tax IDs', () => {
      fc.assert(
        fc.property(taxIdArbitrary, (taxId) => {
          expect(service.validateTaxId(taxId)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject tax IDs with wrong length', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 13 })
            .map((d) => d.join('')),
          (shortTaxId) => {
            expect(service.validateTaxId(shortTaxId)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject tax IDs with non-digit characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 14, maxLength: 14 }).filter((s) => /[^0-9]/.test(s)),
          (invalidTaxId) => {
            expect(service.validateTaxId(invalidTaxId)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUID Validation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SUID Validation', () => {
    it('should reject SUIds with wrong length', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 21 }), (shortSuid) => {
          expect(service.validateSUID(shortSuid)).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject SUIds with invalid tax ID prefix', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 14, maxLength: 14 }).filter((s) => /[^0-9]/.test(s)),
            fc.string({ minLength: 8, maxLength: 8 })
          ),
          ([invalidPrefix, suffix]) => {
            const invalidSuid = invalidPrefix + suffix;
            expect(service.validateSUID(invalidSuid)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

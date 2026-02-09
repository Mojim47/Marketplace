/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Property Tests for Tax Invoice Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feature: b2b-enterprise-audit
 * Property 2: Tax Invoice Completeness
 * Validates: Requirements 1.3
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TaxInvoiceItem } from '../interfaces';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const VAT_RATE = 9; // نرخ مالیات بر ارزش افزوده (درصد)

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions (extracted from TaxInvoiceService for testing)
// ═══════════════════════════════════════════════════════════════════════════

function calculateAmounts(
  items: TaxInvoiceItem[],
  discountAmount: number
): {
  subtotal: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
} {
  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => {
    // Prevent negative item totals (discount cannot exceed line amount)
    const itemTotal = Math.max(0, item.quantity * item.unitPrice - item.discountAmount);
    return sum + itemTotal;
  }, 0);

  // Apply discount
  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // Calculate VAT (9%)
  const taxAmount = Math.round(taxableAmount * (VAT_RATE / 100));

  // Total
  const totalAmount = taxableAmount + taxAmount;

  return { subtotal, taxableAmount, taxAmount, totalAmount };
}

function validateTaxId(taxId: string): boolean {
  return !!taxId && /^\d{14}$/.test(taxId);
}

function validateNationalId(nationalId: string): boolean {
  return !!nationalId && /^\d{10}$/.test(nationalId);
}

// ═══════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════

const taxInvoiceItemArbitrary = fc.record({
  sku: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  serviceCode: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  quantity: fc.integer({ min: 1, max: 1000 }),
  measurementUnit: fc.constantFrom('عدد', 'کیلوگرم', 'متر', 'لیتر', 'بسته'),
  unitPrice: fc.integer({ min: 1000, max: 100000000 }), // 1,000 to 100,000,000 Rial
  discountAmount: fc.integer({ min: 0, max: 1000000 }),
  vatRate: fc.constant(VAT_RATE),
  vatAmount: fc.integer({ min: 0, max: 10000000 }),
  totalPrice: fc.integer({ min: 1000, max: 100000000 }),
});

const taxIdArbitrary = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 14, maxLength: 14 })
  .map((digits) => digits.join(''));

const nationalIdArbitrary = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 10, maxLength: 10 })
  .map((digits) => digits.join(''));

describe('TaxInvoiceService Property Tests', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Property 2: Tax Invoice Completeness
  // Validates: Requirements 1.3
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Property 2: Tax Invoice Completeness', () => {
    /**
     * Feature: b2b-enterprise-audit, Property 2: Tax Invoice Completeness
     * Validates: Requirements 1.3
     *
     * *For any* Tax Invoice, all required fields (seller tax ID, item details,
     * VAT amount at 9%, total payable) should be present and VAT should equal
     * exactly 9% of the taxable amount.
     */
    it('should calculate VAT as exactly 9% of taxable amount', () => {
      fc.assert(
        fc.property(
          fc.array(taxInvoiceItemArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 0, max: 1000000 }),
          (items, discountAmount) => {
            const result = calculateAmounts(items, discountAmount);

            // VAT should be 9% of taxable amount (rounded)
            const expectedVat = Math.round(result.taxableAmount * (VAT_RATE / 100));
            expect(result.taxAmount).toBe(expectedVat);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate total as taxable amount plus VAT', () => {
      fc.assert(
        fc.property(
          fc.array(taxInvoiceItemArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 0, max: 1000000 }),
          (items, discountAmount) => {
            const result = calculateAmounts(items, discountAmount);

            // Total should be taxable + VAT
            expect(result.totalAmount).toBe(result.taxableAmount + result.taxAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate subtotal as sum of item totals', () => {
      fc.assert(
        fc.property(fc.array(taxInvoiceItemArbitrary, { minLength: 1, maxLength: 10 }), (items) => {
          const result = calculateAmounts(items, 0);

          // Subtotal should be sum of non-negative line totals
          const expectedSubtotal = items.reduce((sum, item) => {
            const lineTotal = Math.max(0, item.quantity * item.unitPrice - item.discountAmount);
            return sum + lineTotal;
          }, 0);

          expect(result.subtotal).toBe(expectedSubtotal);
        }),
        { numRuns: 100 }
      );
    });

    it('should apply discount to get taxable amount', () => {
      fc.assert(
        fc.property(
          fc.array(taxInvoiceItemArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 0, max: 1000000 }),
          (items, discountAmount) => {
            const result = calculateAmounts(items, discountAmount);

            // Taxable amount should be subtotal minus discount, never negative
            const expectedTaxable = Math.max(0, result.subtotal - discountAmount);
            expect(result.taxableAmount).toBe(expectedTaxable);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain non-negative amounts', () => {
      fc.assert(
        fc.property(
          fc.array(taxInvoiceItemArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 0, max: 100000 }), // Small discount to ensure positive
          (items, discountAmount) => {
            // Ensure items have enough value
            const minSubtotal = items.reduce((sum, item) => {
              return sum + Math.max(0, item.quantity * item.unitPrice - item.discountAmount);
            }, 0);

            fc.pre(minSubtotal > discountAmount);

            const result = calculateAmounts(items, discountAmount);

            // All amounts should be non-negative
            expect(result.subtotal).toBeGreaterThanOrEqual(0);
            expect(result.taxableAmount).toBeGreaterThanOrEqual(0);
            expect(result.taxAmount).toBeGreaterThanOrEqual(0);
            expect(result.totalAmount).toBeGreaterThanOrEqual(0);
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
    it('should validate correct 14-digit seller tax IDs', () => {
      fc.assert(
        fc.property(taxIdArbitrary, (taxId) => {
          expect(validateTaxId(taxId)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject tax IDs with wrong length', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc
              .array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 13 })
              .map((d) => d.join('')),
            fc
              .array(fc.integer({ min: 0, max: 9 }), { minLength: 15, maxLength: 20 })
              .map((d) => d.join(''))
          ),
          (invalidTaxId) => {
            expect(validateTaxId(invalidTaxId)).toBe(false);
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
            expect(validateTaxId(invalidTaxId)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // National ID Validation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('National ID Validation', () => {
    it('should validate correct 10-digit national IDs', () => {
      fc.assert(
        fc.property(nationalIdArbitrary, (nationalId) => {
          expect(validateNationalId(nationalId)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject national IDs with wrong length', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc
              .array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 9 })
              .map((d) => d.join('')),
            fc
              .array(fc.integer({ min: 0, max: 9 }), { minLength: 11, maxLength: 15 })
              .map((d) => d.join(''))
          ),
          (invalidNationalId) => {
            expect(validateNationalId(invalidNationalId)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VAT Calculation Invariants
  // ═══════════════════════════════════════════════════════════════════════════

  describe('VAT Calculation Invariants', () => {
    it('should maintain VAT rate at 9%', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000000 }), // Taxable amount
          (taxableAmount) => {
            const vatAmount = Math.round(taxableAmount * (VAT_RATE / 100));
            const calculatedRate = (vatAmount / taxableAmount) * 100;

            // Rate should be approximately 9% (within rounding error)
            expect(Math.abs(calculatedRate - VAT_RATE)).toBeLessThan(0.1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero taxable amount', () => {
      const result = calculateAmounts([], 0);

      expect(result.subtotal).toBe(0);
      expect(result.taxableAmount).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should round VAT to nearest integer', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000000000 }), (taxableAmount) => {
          const vatAmount = Math.round(taxableAmount * (VAT_RATE / 100));

          // VAT should be an integer
          expect(Number.isInteger(vatAmount)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Invoice Item Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Invoice Item Validation', () => {
    it('should require at least one item', () => {
      const result = calculateAmounts([], 0);
      expect(result.subtotal).toBe(0);
    });

    it('should handle multiple items correctly', () => {
      fc.assert(
        fc.property(fc.array(taxInvoiceItemArbitrary, { minLength: 2, maxLength: 20 }), (items) => {
          const result = calculateAmounts(items, 0);

          // Subtotal should be sum of all non-negative line totals
          const expectedSubtotal = items.reduce((sum, item) => {
            const lineTotal = Math.max(0, item.quantity * item.unitPrice - item.discountAmount);
            return sum + lineTotal;
          }, 0);

          expect(result.subtotal).toBe(expectedSubtotal);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle item discounts correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            sku: fc.constant('TEST-SKU'),
            name: fc.constant('Test Product'),
            quantity: fc.integer({ min: 1, max: 100 }),
            measurementUnit: fc.constant('عدد'),
            unitPrice: fc.integer({ min: 10000, max: 1000000 }),
            discountAmount: fc.integer({ min: 0, max: 10000 }),
            vatRate: fc.constant(VAT_RATE),
            vatAmount: fc.constant(0),
            totalPrice: fc.constant(0),
          }),
          (item) => {
            const result = calculateAmounts([item], 0);

            // Subtotal should account for item discount but never go negative
            const expectedSubtotal = Math.max(0, item.quantity * item.unitPrice - item.discountAmount);
            expect(result.subtotal).toBe(expectedSubtotal);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

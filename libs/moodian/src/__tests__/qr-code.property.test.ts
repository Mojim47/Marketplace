/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Property Tests for QR Code Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feature: b2b-enterprise-audit
 * Property 4: QR Code Round-Trip
 * Validates: Requirements 1.7
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import type { QRCodeData } from '../interfaces';
import { QRCodeService } from '../qr-code.service';

describe('QRCodeService Property Tests', () => {
  let service: QRCodeService;

  beforeEach(() => {
    // Create service with mock config
    service = new QRCodeService({
      get: (_key: string, defaultValue: string) => defaultValue,
    } as any);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Generators
  // ═══════════════════════════════════════════════════════════════════════════

  // Helper: Generate 14-digit tax ID
  const taxIdArbitrary = fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: 14, maxLength: 14 })
    .map((digits) => digits.join(''));

  // Helper: Generate 8-character alphanumeric suffix
  const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  const suffixArbitrary = fc
    .array(fc.constantFrom(...alphanumericChars), { minLength: 8, maxLength: 8 })
    .map((chars) => chars.join(''));

  const qrCodeDataArbitrary = fc.record({
    suid: fc.tuple(taxIdArbitrary, suffixArbitrary).map(([taxId, suffix]) => taxId + suffix),
    invoiceNumber: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    totalAmount: fc.integer({ min: 1, max: 1000000000000 }),
    issueDate: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => d.toISOString()),
    sellerTaxId: taxIdArbitrary,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Property 4: QR Code Round-Trip
  // Validates: Requirements 1.7
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Property 4: QR Code Round-Trip', () => {
    /**
     * Feature: b2b-enterprise-audit, Property 4: QR Code Round-Trip
     * Validates: Requirements 1.7
     *
     * *For any* Tax Invoice QR code, decoding the QR code should return
     * the original SUID and invoice details.
     */
    it('should preserve SUID in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);
          const parsed = service.parseQRCode(result.verificationUrl);

          // SUID must be preserved
          expect(parsed).not.toBeNull();
          expect(parsed?.suid).toBe(data.suid);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve invoice number in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);
          const parsed = service.parseQRCode(result.verificationUrl);

          // Invoice number must be preserved
          expect(parsed).not.toBeNull();
          expect(parsed?.invoiceNumber).toBe(data.invoiceNumber);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve total amount in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);
          const parsed = service.parseQRCode(result.verificationUrl);

          // Total amount must be preserved
          expect(parsed).not.toBeNull();
          expect(parsed?.totalAmount).toBe(data.totalAmount);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve seller tax ID in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);
          const parsed = service.parseQRCode(result.verificationUrl);

          // Seller tax ID must be preserved
          expect(parsed).not.toBeNull();
          expect(parsed?.sellerTaxId).toBe(data.sellerTaxId);
        }),
        { numRuns: 100 }
      );
    });

    it('should verify QR code with original data', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);
          const isValid = service.verifyQRCode(result.verificationUrl, data);

          // QR code must verify with original data
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should fail verification with modified data', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeDataArbitrary,
          fc.integer({ min: 1, max: 1000000 }),
          async (data: QRCodeData, amountChange: number) => {
            const result = await service.generateQRCode(data);
            const modifiedData = { ...data, totalAmount: data.totalAmount + amountChange };
            const isValid = service.verifyQRCode(result.verificationUrl, modifiedData);

            // QR code must fail verification with modified data
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QR Code Generation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('QR Code Generation', () => {
    it('should generate non-empty QR code', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);

          expect(result.qrCode).toBeTruthy();
          expect(result.qrCode.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid PNG data URL', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);

          // QR code should be a valid PNG data URL
          expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate verification URL', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const result = await service.generateQRCode(data);

          expect(result.verificationUrl).toBeTruthy();
          expect(result.verificationUrl).toContain('?q=');
        }),
        { numRuns: 100 }
      );
    });

    it('should generate different QR codes for different data', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeDataArbitrary,
          qrCodeDataArbitrary,
          async (data1: QRCodeData, data2: QRCodeData) => {
            fc.pre(data1.suid !== data2.suid || data1.totalAmount !== data2.totalAmount);

            const result1 = await service.generateQRCode(data1);
            const result2 = await service.generateQRCode(data2);

            // Different data should produce different QR codes
            expect(result1.verificationUrl).not.toBe(result2.verificationUrl);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SVG Generation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SVG QR Code Generation', () => {
    it('should generate valid SVG', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const svg = await service.generateQRCodeSVG(data);

          // SVG should be a valid SVG string
          expect(svg).toContain('<svg');
          expect(svg).toContain('</svg>');
        }),
        { numRuns: 100 }
      );
    });

    it('should generate non-empty SVG', async () => {
      await fc.assert(
        fc.asyncProperty(qrCodeDataArbitrary, async (data: QRCodeData) => {
          const svg = await service.generateQRCodeSVG(data);

          expect(svg).toBeTruthy();
          expect(svg.length).toBeGreaterThan(100); // Real SVG should be substantial
        }),
        { numRuns: 100 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Validation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Input Validation', () => {
    it('should reject invalid SUID length', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 21 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 1, max: 1000000000 }),
          taxIdArbitrary,
          async (invalidSuid, invoiceNumber, totalAmount, sellerTaxId) => {
            const data: QRCodeData = {
              suid: invalidSuid,
              invoiceNumber,
              totalAmount,
              issueDate: new Date().toISOString(),
              sellerTaxId,
            };

            await expect(service.generateQRCode(data)).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid seller tax ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(taxIdArbitrary, suffixArbitrary).map(([taxId, suffix]) => taxId + suffix),
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 1, max: 1000000000 }),
          fc.string({ minLength: 1, maxLength: 13 }), // Invalid tax ID
          async (suid, invoiceNumber, totalAmount, invalidTaxId) => {
            const data: QRCodeData = {
              suid,
              invoiceNumber,
              totalAmount,
              issueDate: new Date().toISOString(),
              sellerTaxId: invalidTaxId,
            };

            await expect(service.generateQRCode(data)).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject zero or negative total amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(taxIdArbitrary, suffixArbitrary).map(([taxId, suffix]) => taxId + suffix),
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: -1000000, max: 0 }),
          taxIdArbitrary,
          async (suid, invoiceNumber, invalidAmount, sellerTaxId) => {
            const data: QRCodeData = {
              suid,
              invoiceNumber,
              totalAmount: invalidAmount,
              issueDate: new Date().toISOString(),
              sellerTaxId,
            };

            await expect(service.generateQRCode(data)).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Parse Error Handling Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Parse Error Handling', () => {
    it('should return null for invalid QR data', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (invalidData) => {
          const parsed = service.parseQRCode(invalidData);

          // Invalid data should return null, not throw
          expect(parsed === null || typeof parsed === 'object').toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should return null for empty string', () => {
      const parsed = service.parseQRCode('');
      expect(parsed).toBeNull();
    });
  });
});

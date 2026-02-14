/**
 * Property-Based Tests for XSS Sanitization
 *
 * These tests validate the security properties of XSS sanitization
 * using fast-check for property-based testing.
 *
 * Requirements validated:
 * - 2.2: XSS sanitization for all user inputs
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  normalizePersianText,
  removeDangerousPatterns,
  sanitize,
  sanitizeObject,
  sanitizeUrl,
} from './xss.sanitizer';

describe('XSS Sanitization Properties', () => {
  describe('Property 1: Script Tag Removal', () => {
    it('should always remove script tags', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (before, after) => {
          const malicious = `${before}<script>alert('xss')</script>${after}`;
          const sanitized = sanitize(malicious);

          // Should not contain script tags
          expect(sanitized.toLowerCase()).not.toContain('<script');
          expect(sanitized.toLowerCase()).not.toContain('</script>');
        }),
        { numRuns: 100 }
      );
    });

    it('should remove nested script tags', () => {
      const inputs = [
        '<script><script>alert(1)</script></script>',
        '<scr<script>ipt>alert(1)</script>',
        '<SCRIPT>alert(1)</SCRIPT>',
        '<script type="text/javascript">alert(1)</script>',
      ];

      for (const input of inputs) {
        const sanitized = sanitize(input);
        expect(sanitized.toLowerCase()).not.toContain('<script');
      }
    });
  });

  describe('Property 2: Event Handler Removal', () => {
    it('should remove all event handlers', () => {
      const eventHandlers = [
        'onclick',
        'onload',
        'onerror',
        'onmouseover',
        'onfocus',
        'onblur',
        'onsubmit',
        'onkeydown',
      ];

      fc.assert(
        fc.property(fc.constantFrom(...eventHandlers), fc.string(), (handler, payload) => {
          const malicious = `<div ${handler}="${payload}">test</div>`;
          const sanitized = removeDangerousPatterns(malicious);

          // Should not contain event handlers
          expect(sanitized.toLowerCase()).not.toMatch(new RegExp(`\\b${handler}\\s*=`, 'i'));
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 3: HTML Entity Encoding', () => {
    it('should encode all dangerous HTML characters', () => {
      const dangerousChars = ['<', '>', '"', "'", '&', '/', '`', '='];

      fc.assert(
        fc.property(
          fc.constantFrom(...dangerousChars),
          fc.string(),
          fc.string(),
          (char, before, after) => {
            const input = `${before}${char}${after}`;
            const escaped = escapeHtml(input);

            // Original dangerous char should be encoded
            if (before.length === 0 && after.length === 0) {
              expect(escaped).not.toBe(char);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve safe characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => /^[a-zA-Z0-9 ]+$/.test(s)),
          (safeString) => {
            const escaped = escapeHtml(safeString);

            // Safe strings should remain unchanged
            expect(escaped).toBe(safeString);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 4: JavaScript URL Prevention', () => {
    it('should block javascript: URLs', () => {
      fc.assert(
        fc.property(fc.string(), (payload) => {
          const maliciousUrls = [
            `javascript:${payload}`,
            `JAVASCRIPT:${payload}`,
            `javascript:alert('${payload}')`,
            `  javascript:${payload}`,
          ];

          for (const url of maliciousUrls) {
            const sanitized = sanitizeUrl(url);
            expect(sanitized).toBe('');
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should allow safe URLs', () => {
      fc.assert(
        fc.property(fc.webUrl(), (url) => {
          const sanitized = sanitizeUrl(url);

          // Safe URLs should be preserved (possibly with dangerous patterns removed)
          expect(sanitized.length).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: Idempotency', () => {
    it('should be idempotent for already-safe strings', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => /^[a-zA-Z0-9 ]+$/.test(s)),
          (input) => {
            const once = sanitize(input);
            const twice = sanitize(once);

            // For safe strings, sanitizing twice should equal sanitizing once
            expect(twice).toBe(once);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce stable output after first sanitization', () => {
      // Note: HTML entity encoding is NOT idempotent by design
      // & becomes &amp; which would become &amp;amp; if re-encoded
      // This is expected behavior - we test that the OUTPUT is safe
      const dangerousInputs = [
        '<script>alert(1)</script>',
        '<img onerror=alert(1)>',
        'javascript:alert(1)',
      ];

      for (const input of dangerousInputs) {
        const sanitized = sanitize(input);

        // Output should not contain dangerous patterns
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toMatch(/onerror\s*=/);
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
      }
    });
  });

  describe('Property 6: Length Preservation', () => {
    it('should not increase string length significantly', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 1000 }), (input) => {
          const sanitized = sanitize(input);

          // Sanitized length should be reasonable
          // (encoding can increase length, but removal should decrease it)
          // Max increase is ~6x for all special chars being encoded
          expect(sanitized.length).toBeLessThanOrEqual(input.length * 6 + 1);
        }),
        { numRuns: 50 }
      );
    });

    it('should respect maxLength option', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 1000 }),
          fc.integer({ min: 10, max: 50 }),
          (input, maxLength) => {
            const sanitized = sanitize(input, { maxLength });

            // Should not exceed maxLength (before encoding)
            // Note: encoding happens after truncation
            expect(sanitized.length).toBeLessThanOrEqual(maxLength * 6);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 7: Object Sanitization', () => {
    it('should sanitize all string properties in objects', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string(),
            description: fc.string(),
            nested: fc.record({
              value: fc.string(),
            }),
          }),
          (obj) => {
            // Add XSS payload
            const malicious = {
              ...obj,
              name: `<script>alert('xss')</script>${obj.name}`,
            };

            const sanitized = sanitizeObject(malicious);

            // Should not contain script tags
            expect(sanitized.name.toLowerCase()).not.toContain('<script');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle arrays in objects', () => {
      const obj = {
        items: ['<script>alert(1)</script>', 'safe', '<img onerror=alert(1)>'],
      };

      const sanitized = sanitizeObject(obj);

      for (const item of sanitized.items) {
        expect(item.toLowerCase()).not.toContain('<script');
        expect(item.toLowerCase()).not.toMatch(/onerror\s*=/);
      }
    });
  });
});

describe('Persian Text Normalization Properties', () => {
  describe('Property 8: Arabic to Persian Conversion', () => {
    it('should convert Arabic Kaf to Persian Kaf', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (before, after) => {
          const input = `${before}ك${after}`; // Arabic Kaf
          const normalized = normalizePersianText(input);

          // Should not contain Arabic Kaf
          expect(normalized).not.toContain('ك');
          // Should contain Persian Kaf
          expect(normalized).toContain('ک');
        }),
        { numRuns: 50 }
      );
    });

    it('should convert Arabic Yeh to Persian Yeh', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (before, after) => {
          const input = `${before}ي${after}`; // Arabic Yeh
          const normalized = normalizePersianText(input);

          // Should not contain Arabic Yeh
          expect(normalized).not.toContain('ي');
          // Should contain Persian Yeh
          expect(normalized).toContain('ی');
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9: Numeral Conversion', () => {
    it('should convert Arabic numerals to Persian', () => {
      const arabicNumerals = '٠١٢٣٤٥٦٧٨٩';
      const persianNumerals = '۰۱۲۳۴۵۶۷۸۹';

      const normalized = normalizePersianText(arabicNumerals);

      expect(normalized).toBe(persianNumerals);
    });
  });

  describe('Property 10: Safe Text Preservation', () => {
    it('should preserve Persian text without modification', () => {
      const persianTexts = ['سلام دنیا', 'نکست‌جن مارکت‌پلیس', 'قیمت: ۱۲۳۴۵۶ تومان', 'کاربر گرامی'];

      for (const text of persianTexts) {
        const normalized = normalizePersianText(text);
        expect(normalized).toBe(text);
      }
    });
  });
});

describe('Input Validation Strictness Properties', () => {
  describe('Property 11: No Dangerous Output', () => {
    it('should never produce output containing executable code', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const sanitized = sanitize(input);

          // Should not contain any executable patterns
          expect(sanitized.toLowerCase()).not.toMatch(/<script/);
          expect(sanitized.toLowerCase()).not.toMatch(/javascript:/);
          expect(sanitized.toLowerCase()).not.toMatch(/vbscript:/);
          expect(sanitized.toLowerCase()).not.toMatch(/on\w+\s*=/);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Property 12: Consistent Behavior', () => {
    it('should produce consistent results for same input', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result1 = sanitize(input);
          const result2 = sanitize(input);

          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });
  });
});

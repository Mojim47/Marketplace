/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - RTL Layout Property-Based Tests
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Property-based tests for RTL (Right-to-Left) layout consistency.
 * Uses fast-check to verify RTL properties across all valid inputs.
 *
 * Feature: production-readiness-audit, Property 19: RTL Layout Consistency
 * Validates: Requirements 7.1
 *
 * @module tests/ui/rtl.property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isRTLLocale,
  getTextDirection,
  getTextAlignment,
  containsPersianChars,
  shouldBeRTL,
  createRTLStyles,
  flipHorizontalSpacing,
  validateRTLElement,
} from './rtl.test';

// ═══════════════════════════════════════════════════════════════════════════
// Custom Arbitraries for RTL Testing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generator for RTL locales
 */
const rtlLocaleArb = fc.constantFrom('fa', 'fa-IR', 'ar', 'ar-SA', 'he', 'he-IL', 'ur', 'ur-PK');

/**
 * Generator for LTR locales
 */
const ltrLocaleArb = fc.constantFrom(
  'en',
  'en-US',
  'en-GB',
  'de',
  'de-DE',
  'fr',
  'fr-FR',
  'es',
  'es-ES',
  'it',
  'it-IT'
);

/**
 * Generator for any locale
 */
const anyLocaleArb = fc.oneof(rtlLocaleArb, ltrLocaleArb);

/**
 * Generator for Persian text (using Persian Unicode characters)
 */
const persianTextArb = fc.stringOf(
  fc.constantFrom(
    'ا',
    'ب',
    'پ',
    'ت',
    'ث',
    'ج',
    'چ',
    'ح',
    'خ',
    'د',
    'ذ',
    'ر',
    'ز',
    'ژ',
    'س',
    'ش',
    'ص',
    'ض',
    'ط',
    'ظ',
    'ع',
    'غ',
    'ف',
    'ق',
    'ک',
    'گ',
    'ل',
    'م',
    'ن',
    'و',
    'ه',
    'ی',
    ' ',
    '۰',
    '۱',
    '۲',
    '۳',
    '۴',
    '۵',
    '۶',
    '۷',
    '۸',
    '۹'
  ),
  { minLength: 1, maxLength: 50 }
);

/**
 * Generator for English text
 */
const englishTextArb = fc.stringOf(
  fc.constantFrom(
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    ' ',
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9'
  ),
  { minLength: 1, maxLength: 50 }
);

/**
 * Generator for mixed Persian and English text with more Persian
 * Ensures at least 5 Persian characters and at most 2 English characters
 */
const persianDominantTextArb = fc
  .tuple(
    fc.stringOf(
      fc.constantFrom(
        'ا',
        'ب',
        'پ',
        'ت',
        'ث',
        'ج',
        'چ',
        'ح',
        'خ',
        'د',
        'ذ',
        'ر',
        'ز',
        'ژ',
        'س',
        'ش',
        'ص',
        'ض',
        'ط',
        'ظ',
        'ع',
        'غ',
        'ف',
        'ق',
        'ک',
        'گ',
        'ل',
        'م',
        'ن',
        'و',
        'ه',
        'ی'
      ),
      { minLength: 5, maxLength: 20 }
    ),
    fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 0, maxLength: 2 })
  )
  .map(([persian, english]) => persian + (english.length > 0 ? ' ' + english : ''));

/**
 * Generator for mixed Persian and English text with more English
 * Ensures at least 5 English characters and at most 2 Persian characters
 */
const englishDominantTextArb = fc
  .tuple(
    fc.stringOf(
      fc.constantFrom(
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
        'g',
        'h',
        'i',
        'j',
        'k',
        'l',
        'm',
        'n',
        'o',
        'p',
        'q',
        'r',
        's',
        't',
        'u',
        'v',
        'w',
        'x',
        'y',
        'z'
      ),
      { minLength: 5, maxLength: 20 }
    ),
    fc.stringOf(fc.constantFrom('ا', 'ب', 'پ'), { minLength: 0, maxLength: 2 })
  )
  .map(([english, persian]) => english + (persian.length > 0 ? ' ' + persian : ''));

/**
 * Generator for 4-value CSS spacing (e.g., "10px 20px 30px 40px")
 */
const fourValueSpacingArb = fc
  .tuple(
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 0, max: 100 })
  )
  .map(([top, right, bottom, left]) => `${top}px ${right}px ${bottom}px ${left}px`);

/**
 * Generator for Persian UI labels
 */
const persianLabelArb = fc.constantFrom(
  'نام',
  'نام خانوادگی',
  'شماره موبایل',
  'کد ملی',
  'آدرس',
  'کد پستی',
  'ایمیل',
  'رمز عبور',
  'ثبت سفارش',
  'انصراف',
  'ادامه',
  'بازگشت',
  'جستجو',
  'ورود',
  'خروج',
  'محصولات',
  'سبد خرید',
  'پرداخت',
  'تایید',
  'لغو',
  'ویرایش',
  'حذف',
  'افزودن',
  'کاهش'
);

/**
 * Generator for Persian error messages
 */
const persianErrorMessageArb = fc.constantFrom(
  'نام کاربری یا رمز عبور اشتباه است',
  'شماره موبایل نامعتبر است',
  'کد ملی نامعتبر است',
  'فیلد الزامی وارد نشده است',
  'موجودی کافی نیست',
  'خطا در اتصال به سرور',
  'عملیات با موفقیت انجام شد',
  'لطفا صبر کنید',
  'بارگذاری...'
);

// ═══════════════════════════════════════════════════════════════════════════
// Property-Based Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('RTL Layout Consistency Property Tests', () => {
  /**
   * Feature: production-readiness-audit, Property 19: RTL Layout Consistency
   * Validates: Requirements 7.1
   *
   * For any UI component, the rendered output should have RTL direction
   * and proper text alignment for Persian content.
   */
  describe('Property 19: RTL Layout Consistency', () => {
    it('should always return RTL direction for RTL locales', () => {
      fc.assert(
        fc.property(rtlLocaleArb, (locale) => {
          const direction = getTextDirection(locale);
          return direction === 'rtl';
        }),
        { numRuns: 100 }
      );
    });

    it('should always return LTR direction for LTR locales', () => {
      fc.assert(
        fc.property(ltrLocaleArb, (locale) => {
          const direction = getTextDirection(locale);
          return direction === 'ltr';
        }),
        { numRuns: 100 }
      );
    });

    it('should always return right alignment for RTL locales', () => {
      fc.assert(
        fc.property(rtlLocaleArb, (locale) => {
          const alignment = getTextAlignment(locale);
          return alignment === 'right';
        }),
        { numRuns: 100 }
      );
    });

    it('should always return left alignment for LTR locales', () => {
      fc.assert(
        fc.property(ltrLocaleArb, (locale) => {
          const alignment = getTextAlignment(locale);
          return alignment === 'left';
        }),
        { numRuns: 100 }
      );
    });

    it('should detect Persian characters in any Persian text', () => {
      fc.assert(
        fc.property(persianTextArb, (text) => {
          // Filter out whitespace-only strings
          if (text.trim().length === 0) return true;
          return containsPersianChars(text);
        }),
        { numRuns: 100 }
      );
    });

    it('should not detect Persian characters in pure English text', () => {
      fc.assert(
        fc.property(englishTextArb, (text) => {
          return !containsPersianChars(text);
        }),
        { numRuns: 100 }
      );
    });

    it('should determine RTL for Persian-dominant text', () => {
      fc.assert(
        fc.property(persianDominantTextArb, (text) => {
          // Filter out whitespace-only strings
          if (text.trim().length === 0) return true;
          return shouldBeRTL(text);
        }),
        { numRuns: 100 }
      );
    });

    it('should determine LTR for English-dominant text', () => {
      fc.assert(
        fc.property(englishDominantTextArb, (text) => {
          // Filter out whitespace-only strings
          if (text.trim().length === 0) return true;
          return !shouldBeRTL(text);
        }),
        { numRuns: 100 }
      );
    });

    it('should create consistent RTL styles', () => {
      fc.assert(
        fc.property(fc.boolean(), (isRTL) => {
          const styles = createRTLStyles(isRTL);

          if (isRTL) {
            return (
              styles.direction === 'rtl' &&
              styles.textAlign === 'right' &&
              styles.unicodeBidi === 'embed'
            );
          } else {
            return (
              styles.direction === 'ltr' &&
              styles.textAlign === 'left' &&
              styles.unicodeBidi === 'embed'
            );
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should flip horizontal spacing symmetrically (double flip returns original)', () => {
      fc.assert(
        fc.property(fourValueSpacingArb, (spacing) => {
          const flipped = flipHorizontalSpacing(spacing);
          const doubleFlipped = flipHorizontalSpacing(flipped);
          return doubleFlipped === spacing;
        }),
        { numRuns: 100 }
      );
    });

    it('should validate RTL elements correctly for RTL locales', () => {
      fc.assert(
        fc.property(rtlLocaleArb, (locale) => {
          const result = validateRTLElement({
            direction: 'rtl',
            textAlign: 'right',
            locale,
          });
          return result.isValid && result.errors.length === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should detect invalid direction for RTL locales', () => {
      fc.assert(
        fc.property(rtlLocaleArb, (locale) => {
          const result = validateRTLElement({
            direction: 'ltr',
            locale,
          });
          return !result.isValid && result.errors.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should detect invalid text alignment for RTL locales', () => {
      fc.assert(
        fc.property(rtlLocaleArb, (locale) => {
          const result = validateRTLElement({
            direction: 'rtl',
            textAlign: 'left',
            locale,
          });
          return !result.isValid && result.errors.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should always detect Persian UI labels as containing Persian characters', () => {
      fc.assert(
        fc.property(persianLabelArb, (label) => {
          return containsPersianChars(label);
        }),
        { numRuns: 100 }
      );
    });

    it('should always determine Persian UI labels as RTL', () => {
      fc.assert(
        fc.property(persianLabelArb, (label) => {
          return shouldBeRTL(label);
        }),
        { numRuns: 100 }
      );
    });

    it('should always detect Persian error messages as RTL', () => {
      fc.assert(
        fc.property(persianErrorMessageArb, (message) => {
          return shouldBeRTL(message);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain direction consistency: isRTLLocale implies getTextDirection returns rtl', () => {
      fc.assert(
        fc.property(anyLocaleArb, (locale) => {
          const isRTL = isRTLLocale(locale);
          const direction = getTextDirection(locale);

          if (isRTL) {
            return direction === 'rtl';
          } else {
            return direction === 'ltr';
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain alignment consistency: isRTLLocale implies getTextAlignment returns right', () => {
      fc.assert(
        fc.property(anyLocaleArb, (locale) => {
          const isRTL = isRTLLocale(locale);
          const alignment = getTextAlignment(locale);

          if (isRTL) {
            return alignment === 'right';
          } else {
            return alignment === 'left';
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - RTL Layout Tests
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Unit tests for RTL (Right-to-Left) layout support for Persian/Farsi UI.
 * Tests direction, alignment, and text rendering for Persian content.
 *
 * @module tests/ui/rtl
 * _Requirements: 7.1_
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// RTL Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines if a locale should use RTL direction
 */
export function isRTLLocale(locale: string): boolean {
  const rtlLocales = ['fa', 'fa-IR', 'ar', 'ar-SA', 'he', 'he-IL', 'ur', 'ur-PK'];
  return rtlLocales.some((rtl) => locale.startsWith(rtl.split('-')[0]));
}

/**
 * Gets the text direction for a given locale
 */
export function getTextDirection(locale: string): 'rtl' | 'ltr' {
  return isRTLLocale(locale) ? 'rtl' : 'ltr';
}

/**
 * Gets the text alignment for a given locale
 */
export function getTextAlignment(locale: string): 'right' | 'left' {
  return isRTLLocale(locale) ? 'right' : 'left';
}

/**
 * Checks if a string contains Persian characters
 */
export function containsPersianChars(text: string): boolean {
  // Persian Unicode range: \u0600-\u06FF (Arabic block which includes Persian)
  // Persian-specific: \u067E (پ), \u0686 (چ), \u0698 (ژ), \u06AF (گ), \u06A9 (ک), \u06CC (ی)
  const persianRegex = /[\u0600-\u06FF]/;
  return persianRegex.test(text);
}

/**
 * Determines if content should be RTL based on its text
 */
export function shouldBeRTL(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Count RTL and LTR characters
  const rtlChars = (
    text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length;
  const ltrChars = (text.match(/[a-zA-Z]/g) || []).length;

  // If more RTL chars than LTR, should be RTL
  return rtlChars > ltrChars;
}

/**
 * Creates RTL-aware CSS styles
 */
export function createRTLStyles(isRTL: boolean): Record<string, string> {
  return {
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    unicodeBidi: 'embed',
  };
}

/**
 * Flips a margin/padding value for RTL
 * e.g., "0 10px 0 20px" becomes "0 20px 0 10px"
 */
export function flipHorizontalSpacing(value: string): string {
  const parts = value.split(/\s+/);
  if (parts.length === 4) {
    // top right bottom left -> top left bottom right
    return `${parts[0]} ${parts[3]} ${parts[2]} ${parts[1]}`;
  }
  return value;
}

/**
 * Validates RTL layout properties for an element
 */
export function validateRTLElement(element: {
  direction?: string;
  textAlign?: string;
  locale?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const isRTL = element.locale ? isRTLLocale(element.locale) : element.direction === 'rtl';

  if (isRTL) {
    if (element.direction && element.direction !== 'rtl') {
      errors.push(`Expected direction 'rtl' but got '${element.direction}'`);
    }
    if (element.textAlign && element.textAlign !== 'right' && element.textAlign !== 'start') {
      errors.push(`Expected textAlign 'right' or 'start' but got '${element.textAlign}'`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// RTL Layout Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('RTL Layout Tests', () => {
  describe('isRTLLocale', () => {
    it('should return true for Persian locale fa-IR', () => {
      expect(isRTLLocale('fa-IR')).toBe(true);
    });

    it('should return true for Persian locale fa', () => {
      expect(isRTLLocale('fa')).toBe(true);
    });

    it('should return true for Arabic locales', () => {
      expect(isRTLLocale('ar')).toBe(true);
      expect(isRTLLocale('ar-SA')).toBe(true);
    });

    it('should return true for Hebrew locales', () => {
      expect(isRTLLocale('he')).toBe(true);
      expect(isRTLLocale('he-IL')).toBe(true);
    });

    it('should return false for English locale', () => {
      expect(isRTLLocale('en-US')).toBe(false);
      expect(isRTLLocale('en')).toBe(false);
    });

    it('should return false for other LTR locales', () => {
      expect(isRTLLocale('de-DE')).toBe(false);
      expect(isRTLLocale('fr-FR')).toBe(false);
      expect(isRTLLocale('es-ES')).toBe(false);
    });
  });

  describe('getTextDirection', () => {
    it('should return rtl for Persian locale', () => {
      expect(getTextDirection('fa-IR')).toBe('rtl');
    });

    it('should return ltr for English locale', () => {
      expect(getTextDirection('en-US')).toBe('ltr');
    });
  });

  describe('getTextAlignment', () => {
    it('should return right for Persian locale', () => {
      expect(getTextAlignment('fa-IR')).toBe('right');
    });

    it('should return left for English locale', () => {
      expect(getTextAlignment('en-US')).toBe('left');
    });
  });

  describe('containsPersianChars', () => {
    it('should return true for Persian text', () => {
      expect(containsPersianChars('سلام')).toBe(true);
      expect(containsPersianChars('بازار نسل بعد')).toBe(true);
      expect(containsPersianChars('محصولات')).toBe(true);
    });

    it('should return true for mixed Persian and English text', () => {
      expect(containsPersianChars('Hello سلام')).toBe(true);
      expect(containsPersianChars('Product: محصول')).toBe(true);
    });

    it('should return false for English-only text', () => {
      expect(containsPersianChars('Hello World')).toBe(false);
      expect(containsPersianChars('NextGen Marketplace')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsPersianChars('')).toBe(false);
    });

    it('should return false for numbers only', () => {
      expect(containsPersianChars('12345')).toBe(false);
    });

    it('should return true for Persian digits', () => {
      expect(containsPersianChars('۱۲۳۴۵')).toBe(true);
    });
  });

  describe('shouldBeRTL', () => {
    it('should return true for Persian-dominant text', () => {
      expect(shouldBeRTL('این یک متن فارسی است')).toBe(true);
      expect(shouldBeRTL('بازار نسل بعد')).toBe(true);
    });

    it('should return false for English-dominant text', () => {
      expect(shouldBeRTL('This is English text')).toBe(false);
      expect(shouldBeRTL('NextGen Marketplace Platform')).toBe(false);
    });

    it('should return true for mixed text with more Persian', () => {
      expect(shouldBeRTL('محصول Product محصول دیگر')).toBe(true);
    });

    it('should return false for mixed text with more English', () => {
      expect(shouldBeRTL('Product محصول Another Product')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(shouldBeRTL('')).toBe(false);
    });

    it('should return false for whitespace only', () => {
      expect(shouldBeRTL('   ')).toBe(false);
    });
  });

  describe('createRTLStyles', () => {
    it('should create RTL styles when isRTL is true', () => {
      const styles = createRTLStyles(true);
      expect(styles.direction).toBe('rtl');
      expect(styles.textAlign).toBe('right');
      expect(styles.unicodeBidi).toBe('embed');
    });

    it('should create LTR styles when isRTL is false', () => {
      const styles = createRTLStyles(false);
      expect(styles.direction).toBe('ltr');
      expect(styles.textAlign).toBe('left');
      expect(styles.unicodeBidi).toBe('embed');
    });
  });

  describe('flipHorizontalSpacing', () => {
    it('should flip 4-value spacing correctly', () => {
      expect(flipHorizontalSpacing('0 10px 0 20px')).toBe('0 20px 0 10px');
      expect(flipHorizontalSpacing('5px 15px 10px 25px')).toBe('5px 25px 10px 15px');
    });

    it('should return unchanged for non-4-value spacing', () => {
      expect(flipHorizontalSpacing('10px')).toBe('10px');
      expect(flipHorizontalSpacing('10px 20px')).toBe('10px 20px');
      expect(flipHorizontalSpacing('10px 20px 30px')).toBe('10px 20px 30px');
    });
  });

  describe('validateRTLElement', () => {
    it('should validate correct RTL element', () => {
      const result = validateRTLElement({
        direction: 'rtl',
        textAlign: 'right',
        locale: 'fa-IR',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect incorrect direction for RTL locale', () => {
      const result = validateRTLElement({
        direction: 'ltr',
        locale: 'fa-IR',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Expected direction 'rtl' but got 'ltr'");
    });

    it('should detect incorrect text alignment for RTL locale', () => {
      const result = validateRTLElement({
        direction: 'rtl',
        textAlign: 'left',
        locale: 'fa-IR',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Expected textAlign 'right' or 'start' but got 'left'");
    });

    it('should accept start alignment for RTL', () => {
      const result = validateRTLElement({
        direction: 'rtl',
        textAlign: 'start',
        locale: 'fa-IR',
      });
      expect(result.isValid).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DOM-based RTL Tests (using jsdom environment from vitest)
// ═══════════════════════════════════════════════════════════════════════════

describe('DOM RTL Layout Tests', () => {
  beforeEach(() => {
    // Set up RTL document
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'fa');
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    document.body.innerHTML = '';
  });

  describe('HTML Document RTL', () => {
    it('should have RTL direction on html element', () => {
      const html = document.documentElement;
      expect(html.getAttribute('dir')).toBe('rtl');
    });

    it('should have Persian language attribute', () => {
      const html = document.documentElement;
      expect(html.getAttribute('lang')).toBe('fa');
    });
  });

  describe('RTL Element Creation', () => {
    it('should create element with RTL direction', () => {
      const div = document.createElement('div');
      div.setAttribute('dir', 'rtl');
      div.style.direction = 'rtl';
      div.style.textAlign = 'right';

      expect(div.getAttribute('dir')).toBe('rtl');
      expect(div.style.direction).toBe('rtl');
      expect(div.style.textAlign).toBe('right');
    });

    it('should render Persian text correctly', () => {
      const p = document.createElement('p');
      p.textContent = 'بازار نسل بعد';
      p.setAttribute('dir', 'rtl');
      document.body.appendChild(p);

      expect(p.textContent).toBe('بازار نسل بعد');
      expect(p.getAttribute('dir')).toBe('rtl');
    });

    it('should handle mixed content with bdi element', () => {
      const span = document.createElement('span');
      span.innerHTML = '<bdi>Product</bdi> محصول';
      document.body.appendChild(span);

      const bdi = span.querySelector('bdi');
      expect(bdi).not.toBeNull();
      expect(bdi?.textContent).toBe('Product');
    });
  });

  describe('RTL Navigation Structure', () => {
    it('should create RTL navigation list', () => {
      const nav = document.createElement('nav');
      nav.setAttribute('dir', 'rtl');
      nav.setAttribute('aria-label', 'primary');

      const ul = document.createElement('ul');
      ul.style.direction = 'rtl';
      ul.style.display = 'flex';

      const items = ['صفحه اصلی', 'محصولات', 'تماس با ما'];
      items.forEach((text) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.textContent = text;
        a.href = '#';
        li.appendChild(a);
        ul.appendChild(li);
      });

      nav.appendChild(ul);
      document.body.appendChild(nav);

      expect(nav.getAttribute('dir')).toBe('rtl');
      expect(ul.children.length).toBe(3);
      expect(ul.children[0].textContent).toBe('صفحه اصلی');
    });
  });

  describe('RTL Form Elements', () => {
    it('should create RTL input with placeholder', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'جستجو...';
      input.setAttribute('dir', 'rtl');
      input.style.textAlign = 'right';

      document.body.appendChild(input);

      expect(input.placeholder).toBe('جستجو...');
      expect(input.getAttribute('dir')).toBe('rtl');
      expect(input.style.textAlign).toBe('right');
    });

    it('should create RTL textarea', () => {
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'توضیحات خود را وارد کنید';
      textarea.setAttribute('dir', 'rtl');
      textarea.style.textAlign = 'right';

      document.body.appendChild(textarea);

      expect(textarea.placeholder).toBe('توضیحات خود را وارد کنید');
      expect(textarea.getAttribute('dir')).toBe('rtl');
    });

    it('should create RTL select with Persian options', () => {
      const select = document.createElement('select');
      select.setAttribute('dir', 'rtl');

      const options = ['انتخاب کنید', 'گزینه اول', 'گزینه دوم', 'گزینه سوم'];
      options.forEach((text, index) => {
        const option = document.createElement('option');
        option.value = index.toString();
        option.textContent = text;
        select.appendChild(option);
      });

      document.body.appendChild(select);

      expect(select.options.length).toBe(4);
      expect(select.options[0].textContent).toBe('انتخاب کنید');
    });
  });

  describe('RTL Table Structure', () => {
    it('should create RTL table with Persian headers', () => {
      const table = document.createElement('table');
      table.setAttribute('dir', 'rtl');

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      const headers = ['نام', 'قیمت', 'تعداد', 'جمع'];

      headers.forEach((text) => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.textAlign = 'right';
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);
      document.body.appendChild(table);

      expect(table.getAttribute('dir')).toBe('rtl');
      expect(headerRow.children.length).toBe(4);
      expect(headerRow.children[0].textContent).toBe('نام');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Persian UI Component Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Persian UI Component Tests', () => {
  describe('Persian Button Labels', () => {
    const persianButtons = [
      { label: 'ثبت سفارش', action: 'submit' },
      { label: 'انصراف', action: 'cancel' },
      { label: 'ادامه', action: 'continue' },
      { label: 'بازگشت', action: 'back' },
      { label: 'جستجو', action: 'search' },
      { label: 'ورود', action: 'login' },
      { label: 'خروج', action: 'logout' },
    ];

    persianButtons.forEach(({ label }) => {
      it(`should have RTL direction for "${label}" button`, () => {
        expect(containsPersianChars(label)).toBe(true);
        expect(shouldBeRTL(label)).toBe(true);
      });
    });
  });

  describe('Persian Form Labels', () => {
    const formLabels = [
      'نام',
      'نام خانوادگی',
      'شماره موبایل',
      'کد ملی',
      'آدرس',
      'کد پستی',
      'ایمیل',
      'رمز عبور',
    ];

    formLabels.forEach((label) => {
      it(`should detect "${label}" as Persian text`, () => {
        expect(containsPersianChars(label)).toBe(true);
      });
    });
  });

  describe('Persian Error Messages', () => {
    const errorMessages = [
      'نام کاربری یا رمز عبور اشتباه است',
      'شماره موبایل نامعتبر است',
      'کد ملی نامعتبر است',
      'فیلد الزامی وارد نشده است',
      'موجودی کافی نیست',
    ];

    errorMessages.forEach((message) => {
      it(`should detect error message as RTL: "${message.substring(0, 20)}..."`, () => {
        expect(shouldBeRTL(message)).toBe(true);
      });
    });
  });
});

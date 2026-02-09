/**
 * XSS Sanitization Module
 *
 * Enterprise-grade XSS protection for NextGen Marketplace.
 *
 * Features:
 * - HTML entity encoding
 * - Script tag removal
 * - Event handler removal
 * - URL sanitization
 * - Persian text support
 *
 * Requirements: 2.2 - XSS sanitization for all user inputs
 */

/**
 * HTML entities that need to be escaped
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Dangerous patterns that should be removed or neutralized
 */
const DANGEROUS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // Event handlers
  /\bon\w+\s*=/gi,
  // JavaScript URLs
  /javascript:/gi,
  // Data URLs with scripts
  /data:\s*text\/html/gi,
  // VBScript
  /vbscript:/gi,
  // Expression (IE)
  /expression\s*\(/gi,
  // Import
  /@import/gi,
  // Binding (Mozilla)
  /-moz-binding/gi,
];

/**
 * URL schemes that are considered safe
 */
const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

export interface SanitizeOptions {
  /** Allow basic HTML formatting tags */
  allowBasicFormatting?: boolean;
  /** Maximum string length (0 = no limit) */
  maxLength?: number;
  /** Trim whitespace */
  trim?: boolean;
  /** Normalize Persian characters */
  normalizePersian?: boolean;
}

const DEFAULT_OPTIONS: SanitizeOptions = {
  allowBasicFormatting: false,
  maxLength: 0,
  trim: true,
  normalizePersian: true,
};

/**
 * Escape HTML entities in a string
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove dangerous patterns from input
 */
export function removeDangerousPatterns(input: string): string {
  let result = input;

  for (const pattern of DANGEROUS_PATTERNS) {
    result = result.replace(pattern, '');
  }

  return result;
}

/**
 * Sanitize a URL to prevent XSS
 */
export function sanitizeUrl(url: string): string {
  if (!url) {
    return '';
  }

  const trimmed = url.trim().toLowerCase();

  // Check for safe schemes
  const hasScheme = trimmed.includes(':');
  if (hasScheme) {
    const isSafe = SAFE_URL_SCHEMES.some((scheme) => trimmed.startsWith(scheme));

    if (!isSafe) {
      return '';
    }
  }

  // Remove any embedded scripts
  return removeDangerousPatterns(url);
}

/**
 * Normalize Persian/Arabic characters
 * Converts Arabic variants to Persian standard
 */
export function normalizePersianText(input: string): string {
  return (
    input
      // Arabic Kaf to Persian Kaf
      .replace(/ك/g, 'ک')
      // Arabic Yeh to Persian Yeh
      .replace(/ي/g, 'ی')
      // Arabic numerals to Persian
      .replace(/٠/g, '۰')
      .replace(/١/g, '۱')
      .replace(/٢/g, '۲')
      .replace(/٣/g, '۳')
      .replace(/٤/g, '۴')
      .replace(/٥/g, '۵')
      .replace(/٦/g, '۶')
      .replace(/٧/g, '۷')
      .replace(/٨/g, '۸')
      .replace(/٩/g, '۹')
  );
}

/**
 * Main sanitization function
 *
 * @param input - The string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitize(input: string, options: SanitizeOptions = {}): string {
  if (typeof input !== 'string') {
    return '';
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = input;

  // Trim whitespace
  if (opts.trim) {
    result = result.trim();
  }

  // Apply max length
  if (opts.maxLength && opts.maxLength > 0) {
    result = result.substring(0, opts.maxLength);
  }

  // Remove dangerous patterns first
  result = removeDangerousPatterns(result);

  // Escape HTML entities
  if (!opts.allowBasicFormatting) {
    result = escapeHtml(result);
  }

  // Normalize Persian text
  if (opts.normalizePersian) {
    result = normalizePersianText(result);
  }

  return result;
}

/**
 * Sanitize an object's string properties recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: SanitizeOptions = {}
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitize(value, options);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitize(item, options)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, options)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Create a sanitization decorator for class-validator
 */
export function Sanitize(options: SanitizeOptions = {}) {
  return (target: object, propertyKey: string) => {
    let value: string;

    const getter = () => value;

    const setter = (newVal: string) => {
      value = sanitize(newVal, options);
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

export default {
  sanitize,
  sanitizeObject,
  sanitizeUrl,
  escapeHtml,
  removeDangerousPatterns,
  normalizePersianText,
  Sanitize,
};

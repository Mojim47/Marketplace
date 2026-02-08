/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Persian Validators
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Custom Zod refinements and validators for Persian/Iranian data.
 *
 * @module @nextgen/validation
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert Persian digits to English
 */
export function toEnglishDigits(input: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = input;

  persianDigits.forEach((digit, index) => {
    result = result.replace(new RegExp(digit, 'g'), index.toString());
  });
  arabicDigits.forEach((digit, index) => {
    result = result.replace(new RegExp(digit, 'g'), index.toString());
  });

  return result;
}

/**
 * Convert English digits to Persian
 */
export function toPersianDigits(input: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return input.toString().replace(/\d/g, (d) => persianDigits[parseInt(d)] ?? d);
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate Iranian National ID (کد ملی)
 */
export function validateNationalId(nationalId: string): boolean {
  const cleaned = toEnglishDigits(nationalId).replace(/\D/g, '');

  if (cleaned.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }

  const remainder = sum % 11;
  const checkDigit = parseInt(cleaned.charAt(9));

  return remainder < 2 ? checkDigit === remainder : checkDigit === 11 - remainder;
}

/**
 * Validate Iranian Mobile Number
 */
export function validateMobileNumber(mobile: string): boolean {
  const cleaned = toEnglishDigits(mobile).replace(/\D/g, '');

  if (cleaned.length !== 11 || !cleaned.startsWith('09')) {
    return false;
  }

  const validPrefixes = [
    '0910',
    '0911',
    '0912',
    '0913',
    '0914',
    '0915',
    '0916',
    '0917',
    '0918',
    '0919',
    '0930',
    '0933',
    '0935',
    '0936',
    '0937',
    '0938',
    '0939',
    '0920',
    '0921',
    '0922',
    '0901',
    '0902',
    '0903',
    '0932',
    '0990',
    '0991',
    '0992',
    '0993',
    '0994',
  ];

  return validPrefixes.some((prefix) => cleaned.startsWith(prefix));
}

/**
 * Validate Iranian IBAN (شماره شبا)
 */
export function validateIBAN(iban: string): boolean {
  const cleaned = toEnglishDigits(iban).replace(/\s/g, '').toUpperCase();

  if (!cleaned.startsWith('IR') || cleaned.length !== 26) {
    return false;
  }

  const numericPart = cleaned.slice(2);
  if (!/^\d{24}$/.test(numericPart)) {
    return false;
  }

  // IBAN mod-97 validation
  const rearranged = numericPart + '1827' + cleaned.slice(2, 4);
  let remainder = '';
  for (const char of rearranged) {
    remainder = (parseInt(remainder + char) % 97).toString();
  }

  return parseInt(remainder) === 1;
}

/**
 * Validate Iranian Postal Code (کد پستی)
 */
export function validatePostalCode(postalCode: string): boolean {
  const cleaned = toEnglishDigits(postalCode).replace(/\D/g, '');

  if (cleaned.length !== 10) return false;

  // First digit cannot be 0 or 2
  if (cleaned[0] === '0' || cleaned[0] === '2') return false;

  // Cannot have 5 consecutive same digits
  if (/(\d)\1{4}/.test(cleaned)) return false;

  return true;
}

/**
 * Validate Iranian Bank Card Number (شماره کارت)
 */
export function validateBankCard(cardNumber: string): boolean {
  const cleaned = toEnglishDigits(cardNumber).replace(/\D/g, '');

  if (cleaned.length !== 16) return false;

  // Luhn algorithm
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let digit = parseInt(cleaned[i] ?? '0');
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Validate Iranian Company Registration Number (شماره ثبت)
 */
export function validateRegistrationNumber(regNumber: string): boolean {
  const cleaned = toEnglishDigits(regNumber).replace(/\D/g, '');
  return cleaned.length >= 4 && cleaned.length <= 12;
}

/**
 * Validate Iranian Economic Code (کد اقتصادی)
 */
export function validateEconomicCode(code: string): boolean {
  const cleaned = toEnglishDigits(code).replace(/\D/g, '');
  return cleaned.length === 12;
}

// ═══════════════════════════════════════════════════════════════════════════
// Zod Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Iranian National ID Schema
 */
export const nationalIdSchema = z
  .string()
  .min(10, { message: 'کد ملی باید ۱۰ رقم باشد' })
  .max(10, { message: 'کد ملی باید ۱۰ رقم باشد' })
  .refine((val) => validateNationalId(val), {
    message: 'کد ملی وارد شده معتبر نیست',
  });

/**
 * Iranian Mobile Number Schema
 */
export const mobileSchema = z
  .string()
  .min(11, { message: 'شماره موبایل باید ۱۱ رقم باشد' })
  .max(11, { message: 'شماره موبایل باید ۱۱ رقم باشد' })
  .refine((val) => validateMobileNumber(val), {
    message: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)',
  });

/**
 * Iranian IBAN Schema
 */
export const ibanSchema = z
  .string()
  .min(26, { message: 'شماره شبا باید ۲۶ کاراکتر باشد' })
  .max(26, { message: 'شماره شبا باید ۲۶ کاراکتر باشد' })
  .refine((val) => validateIBAN(val), {
    message: 'شماره شبا معتبر نیست (مثال: IR820540102680020817909002)',
  });

/**
 * Iranian Postal Code Schema
 */
export const postalCodeSchema = z
  .string()
  .min(10, { message: 'کد پستی باید ۱۰ رقم باشد' })
  .max(10, { message: 'کد پستی باید ۱۰ رقم باشد' })
  .refine((val) => validatePostalCode(val), {
    message: 'کد پستی معتبر نیست',
  });

/**
 * Iranian Bank Card Schema
 */
export const bankCardSchema = z
  .string()
  .min(16, { message: 'شماره کارت باید ۱۶ رقم باشد' })
  .max(16, { message: 'شماره کارت باید ۱۶ رقم باشد' })
  .refine((val) => validateBankCard(val), {
    message: 'شماره کارت معتبر نیست',
  });

/**
 * Persian Name Schema (allows Persian characters, spaces)
 */
export const persianNameSchema = z
  .string()
  .min(2, { message: 'نام باید حداقل ۲ حرف باشد' })
  .max(50, { message: 'نام نباید بیش از ۵۰ حرف باشد' })
  .regex(/^[\u0600-\u06FF\s]+$/, {
    message: 'نام فقط می‌تواند شامل حروف فارسی باشد',
  });

/**
 * Persian Text Schema (allows Persian, English, numbers, common punctuation)
 */
export const persianTextSchema = z
  .string()
  .min(1, { message: 'متن نمی‌تواند خالی باشد' })
  .regex(/^[\u0600-\u06FFa-zA-Z0-9\s\.\,\!\?\-\(\)]+$/, {
    message: 'متن شامل کاراکترهای غیرمجاز است',
  });

/**
 * Price Schema (Iranian Rial)
 */
export const priceRialSchema = z
  .number()
  .min(0, { message: 'قیمت نمی‌تواند منفی باشد' })
  .max(100_000_000_000_000, { message: 'قیمت بیش از حد مجاز است' })
  .int({ message: 'قیمت باید عدد صحیح باشد' });

/**
 * Price Schema (Iranian Toman)
 */
export const priceTomanSchema = z
  .number()
  .min(0, { message: 'قیمت نمی‌تواند منفی باشد' })
  .max(10_000_000_000_000, { message: 'قیمت بیش از حد مجاز است' });

/**
 * Email Schema with Persian error messages
 */
export const emailSchema = z
  .string()
  .email({ message: 'ایمیل معتبر نیست' })
  .max(255, { message: 'ایمیل نباید بیش از ۲۵۵ کاراکتر باشد' });

/**
 * Password Schema with Persian error messages
 */
export const passwordSchema = z
  .string()
  .min(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد' })
  .max(128, { message: 'رمز عبور نباید بیش از ۱۲۸ کاراکتر باشد' })
  .regex(/[A-Z]/, { message: 'رمز عبور باید شامل حداقل یک حرف بزرگ باشد' })
  .regex(/[a-z]/, { message: 'رمز عبور باید شامل حداقل یک حرف کوچک باشد' })
  .regex(/[0-9]/, { message: 'رمز عبور باید شامل حداقل یک عدد باشد' })
  .regex(/[!@#$%^&*(),.?":{}|<>]/, { message: 'رمز عبور باید شامل حداقل یک کاراکتر خاص باشد' });

/**
 * UUID Schema with Persian error messages
 */
export const uuidSchema = z.string().uuid({ message: 'شناسه معتبر نیست' });

/**
 * Date Schema (ISO format)
 */
export const dateSchema = z.string().datetime({ message: 'تاریخ معتبر نیست' });

/**
 * URL Schema with Persian error messages
 */
export const urlSchema = z.string().url({ message: 'آدرس اینترنتی معتبر نیست' });

// ═══════════════════════════════════════════════════════════════════════════
// Type Exports
// ═══════════════════════════════════════════════════════════════════════════

export type NationalId = z.infer<typeof nationalIdSchema>;
export type Mobile = z.infer<typeof mobileSchema>;
export type IBAN = z.infer<typeof ibanSchema>;
export type PostalCode = z.infer<typeof postalCodeSchema>;
export type BankCard = z.infer<typeof bankCardSchema>;
export type PersianName = z.infer<typeof persianNameSchema>;
export type PriceRial = z.infer<typeof priceRialSchema>;
export type PriceToman = z.infer<typeof priceTomanSchema>;
export type Email = z.infer<typeof emailSchema>;
export type Password = z.infer<typeof passwordSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Enhanced Validators - Security Hardening
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safe Integer Schema with overflow protection
 * Prevents integer overflow attacks
 */
export const safeIntegerSchema = z
  .number()
  .int({ message: 'مقدار باید عدد صحیح باشد' })
  .min(Number.MIN_SAFE_INTEGER, { message: 'مقدار کمتر از حد مجاز است' })
  .max(Number.MAX_SAFE_INTEGER, { message: 'مقدار بیشتر از حد مجاز است' });

/**
 * Positive Integer Schema
 */
export const positiveIntegerSchema = z
  .number()
  .int({ message: 'مقدار باید عدد صحیح باشد' })
  .min(1, { message: 'مقدار باید بزرگتر از صفر باشد' })
  .max(Number.MAX_SAFE_INTEGER, { message: 'مقدار بیشتر از حد مجاز است' });

/**
 * Non-negative Integer Schema
 */
export const nonNegativeIntegerSchema = z
  .number()
  .int({ message: 'مقدار باید عدد صحیح باشد' })
  .min(0, { message: 'مقدار نمی‌تواند منفی باشد' })
  .max(Number.MAX_SAFE_INTEGER, { message: 'مقدار بیشتر از حد مجاز است' });

/**
 * Quantity Schema (for inventory, cart items, etc.)
 */
export const quantitySchema = z
  .number()
  .int({ message: 'تعداد باید عدد صحیح باشد' })
  .min(1, { message: 'تعداد باید حداقل ۱ باشد' })
  .max(10000, { message: 'تعداد نمی‌تواند بیش از ۱۰,۰۰۰ باشد' });

/**
 * Percentage Schema (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, { message: 'درصد نمی‌تواند منفی باشد' })
  .max(100, { message: 'درصد نمی‌تواند بیش از ۱۰۰ باشد' });

/**
 * Discount Percentage Schema (0-99)
 */
export const discountPercentageSchema = z
  .number()
  .min(0, { message: 'تخفیف نمی‌تواند منفی باشد' })
  .max(99, { message: 'تخفیف نمی‌تواند ۱۰۰٪ یا بیشتر باشد' });

/**
 * Pagination Page Schema
 */
export const pageSchema = z
  .number()
  .int({ message: 'شماره صفحه باید عدد صحیح باشد' })
  .min(1, { message: 'شماره صفحه باید حداقل ۱ باشد' })
  .max(10000, { message: 'شماره صفحه بیش از حد مجاز است' });

/**
 * Pagination Limit Schema
 */
export const limitSchema = z
  .number()
  .int({ message: 'تعداد در صفحه باید عدد صحیح باشد' })
  .min(1, { message: 'تعداد در صفحه باید حداقل ۱ باشد' })
  .max(100, { message: 'تعداد در صفحه نمی‌تواند بیش از ۱۰۰ باشد' });

/**
 * Email normalizer - lowercase and trim
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Mobile normalizer - convert to standard format
 */
export function normalizeMobile(mobile: string): string {
  const cleaned = toEnglishDigits(mobile).replace(/\D/g, '');

  // Convert +98 to 0
  if (cleaned.startsWith('98') && cleaned.length === 12) {
    return '0' + cleaned.slice(2);
  }

  return cleaned;
}

/**
 * Normalized Email Schema
 */
export const normalizedEmailSchema = z.string().transform(normalizeEmail).pipe(emailSchema);

/**
 * Normalized Mobile Schema
 */
export const normalizedMobileSchema = z.string().transform(normalizeMobile).pipe(mobileSchema);

// Type exports for new schemas
export type SafeInteger = z.infer<typeof safeIntegerSchema>;
export type PositiveInteger = z.infer<typeof positiveIntegerSchema>;
export type NonNegativeInteger = z.infer<typeof nonNegativeIntegerSchema>;
export type Quantity = z.infer<typeof quantitySchema>;
export type Percentage = z.infer<typeof percentageSchema>;
export type DiscountPercentage = z.infer<typeof discountPercentageSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Limit = z.infer<typeof limitSchema>;

/**
 * Common validation schemas using Zod
 */

import { z } from 'zod';

// Persian/Iranian specific validations
export const IranianNationalIdSchema = z
  .string()
  .regex(/^\d{10}$/, 'کد ملی باید ۱۰ رقم باشد')
  .refine((value) => {
    // Iranian national ID validation algorithm
    const digits = value.split('').map(Number);
    const checkDigit = digits[9] ?? 0;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += (digits[i] ?? 0) * (10 - i);
    }

    const remainder = sum % 11;
    return remainder < 2 ? checkDigit === remainder : checkDigit === 11 - remainder;
  }, 'کد ملی نامعتبر است');

export const IranianMobileSchema = z
  .string()
  .regex(/^(\+98|0)?9\d{9}$/, 'شماره موبایل نامعتبر است')
  .transform((value) => {
    // Normalize to +98 format
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('98')) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('0')) {
      return `+98${cleaned.substring(1)}`;
    }
    if (cleaned.startsWith('9')) {
      return `+98${cleaned}`;
    }
    return value;
  });

export const IranianPostalCodeSchema = z.string().regex(/^\d{10}$/, 'کد پستی باید ۱۰ رقم باشد');

// Common business schemas
export const EmailSchema = z
  .string()
  .email('آدرس ایمیل نامعتبر است')
  .max(254, 'آدرس ایمیل بیش از حد طولانی است');

export const PasswordSchema = z
  .string()
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
  .max(128, 'رمز عبور بیش از حد طولانی است')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'رمز عبور باید شامل حروف کوچک، بزرگ، عدد و نماد باشد'
  );

export const UUIDSchema = z.string().uuid('شناسه نامعتبر است');

export const CurrencyAmountSchema = z
  .number()
  .positive('مبلغ باید مثبت باشد')
  .max(999999999999, 'مبلغ بیش از حد مجاز است')
  .multipleOf(0.01, 'مبلغ باید با دقت دو رقم اعشار باشد');

// Pagination schemas
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Date schemas
export const DateRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.from <= data.to, {
    message: 'تاریخ شروع باید قبل از تاریخ پایان باشد',
    path: ['from'],
  });

// File upload schemas
export const FileUploadSchema = z.object({
  filename: z.string().min(1, 'نام فایل الزامی است'),
  mimetype: z.string().min(1, 'نوع فایل الزامی است'),
  size: z
    .number()
    .positive()
    .max(10 * 1024 * 1024, 'حجم فایل نباید بیش از ۱۰ مگابایت باشد'),
});

export const ImageUploadSchema = FileUploadSchema.extend({
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'فقط فایل‌های JPEG، PNG و WebP مجاز هستند' }),
  }),
});

// Security schemas
export const IPAddressSchema = z.string().ip({ message: 'آدرس IP نامعتبر است' });

export const UserAgentSchema = z
  .string()
  .min(1, 'User Agent الزامی است')
  .max(512, 'User Agent بیش از حد طولانی است');

// Business-specific schemas
export const ProductCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6,20}$/, 'کد محصول باید شامل حروف انگلیسی بزرگ و اعداد باشد');

export const OrderNumberSchema = z.string().regex(/^ORD-\d{4}-\d{6}$/, 'شماره سفارش نامعتبر است');

export const InvoiceNumberSchema = z
  .string()
  .regex(/^INV-\d{4}-\d{6}$/, 'شماره فاکتور نامعتبر است');

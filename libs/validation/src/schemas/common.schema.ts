/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Common Validation Schemas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  emailSchema,
  ibanSchema,
  mobileSchema,
  persianNameSchema,
  postalCodeSchema,
} from '../persian-validators.js';

/**
 * Iranian Address Schema
 */
export const addressSchema = z.object({
  province: z.string().min(2, { message: 'استان الزامی است' }),
  city: z.string().min(2, { message: 'شهر الزامی است' }),
  district: z.string().optional(),
  street: z.string().min(3, { message: 'خیابان الزامی است' }),
  alley: z.string().optional(),
  plaque: z.string().min(1, { message: 'پلاک الزامی است' }),
  unit: z.string().optional(),
  postalCode: postalCodeSchema,
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Pagination Schema
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Date Range Schema
 */
export const dateRangeSchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    { message: 'تاریخ شروع باید قبل از تاریخ پایان باشد' }
  );

/**
 * Search Query Schema
 */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  filters: z.record(z.string(), z.unknown()).optional(),
  ...paginationSchema.shape,
});

/**
 * File Upload Schema
 */
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string(),
  size: z.number().max(10 * 1024 * 1024, { message: 'حجم فایل نباید بیش از ۱۰ مگابایت باشد' }),
});

/**
 * Image Upload Schema
 */
export const imageUploadSchema = fileUploadSchema.extend({
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif'], {
    errorMap: () => ({ message: 'فرمت تصویر باید JPEG، PNG، WebP یا GIF باشد' }),
  }),
  width: z.number().optional(),
  height: z.number().optional(),
});

/**
 * Contact Info Schema
 */
export const contactInfoSchema = z.object({
  mobile: mobileSchema,
  phone: z.string().optional(),
  email: emailSchema.optional(),
  website: z.string().url().optional(),
});

/**
 * Bank Account Schema
 */
export const bankAccountSchema = z.object({
  iban: ibanSchema,
  accountNumber: z.string().optional(),
  bankName: z.string().min(2, { message: 'نام بانک الزامی است' }),
  accountHolderName: persianNameSchema,
  cardNumber: z.string().length(16).optional(),
});

export type Address = z.infer<typeof addressSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type ImageUpload = z.infer<typeof imageUploadSchema>;
export type ContactInfo = z.infer<typeof contactInfoSchema>;
export type BankAccount = z.infer<typeof bankAccountSchema>;

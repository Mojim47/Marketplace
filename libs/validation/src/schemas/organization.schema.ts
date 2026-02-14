/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Organization (B2B) Validation Schemas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  mobileSchema,
  nationalIdSchema,
  persianNameSchema,
  priceRialSchema,
  toEnglishDigits,
  uuidSchema,
  validateEconomicCode,
  validateRegistrationNumber,
} from '../persian-validators.js';
import { addressSchema, bankAccountSchema } from './common.schema.js';

/**
 * Organization Type
 */
export const organizationTypeSchema = z.enum([
  'COMPANY',
  'PARTNERSHIP',
  'SOLE_PROPRIETORSHIP',
  'COOPERATIVE',
  'GOVERNMENT',
  'NON_PROFIT',
]);

/**
 * Dealer Tier
 */
export const dealerTierSchema = z.enum(['BRONZE', 'SILVER', 'GOLD']);

/**
 * Organization Registration Schema
 */
export const organizationRegistrationSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'نام سازمان باید حداقل ۳ حرف باشد' })
    .max(100, { message: 'نام سازمان نباید بیش از ۱۰۰ حرف باشد' }),
  type: organizationTypeSchema,
  registrationNumber: z.string().refine((val) => validateRegistrationNumber(val), {
    message: 'شماره ثبت معتبر نیست',
  }),
  nationalId: z
    .string()
    .length(11, { message: 'شناسه ملی شرکت باید ۱۱ رقم باشد' })
    .refine((val) => /^\d{11}$/.test(toEnglishDigits(val)), {
      message: 'شناسه ملی شرکت معتبر نیست',
    }),
  economicCode: z.string().refine((val) => validateEconomicCode(val), {
    message: 'کد اقتصادی باید ۱۲ رقم باشد',
  }),
  ceoName: persianNameSchema,
  ceoNationalId: nationalIdSchema,
  phone: z.string().min(8).max(15),
  mobile: mobileSchema,
  email: z.string().email({ message: 'ایمیل معتبر نیست' }),
  website: z.string().url().optional(),
  address: addressSchema,
  bankAccount: bankAccountSchema,
  logo: z.string().url().optional(),
  documents: z.object({
    registrationCertificate: z.string().url(),
    nationalIdCard: z.string().url(),
    officialNewspaper: z.string().url().optional(),
    taxClearance: z.string().url().optional(),
  }),
});

/**
 * Dealer Application Schema
 */
export const dealerApplicationSchema = z.object({
  organizationId: uuidSchema,
  requestedTier: dealerTierSchema,
  annualPurchaseEstimate: priceRialSchema,
  businessDescription: z.string().min(50).max(2000),
  references: z
    .array(
      z.object({
        companyName: z.string().min(3).max(100),
        contactName: persianNameSchema,
        contactPhone: mobileSchema,
        relationship: z.string().max(100),
      })
    )
    .min(1)
    .max(5),
  additionalDocuments: z.array(z.string().url()).optional(),
});

/**
 * Credit Request Schema
 */
export const creditRequestSchema = z.object({
  organizationId: uuidSchema,
  amount: priceRialSchema.refine((val) => val >= 10_000_000, {
    message: 'حداقل مبلغ درخواست اعتبار ۱۰ میلیون ریال است',
  }),
  duration: z.number().int().min(30).max(365),
  purpose: z.string().min(20).max(500),
  collateral: z.object({
    type: z.enum(['CHEQUE', 'PROPERTY', 'GUARANTEE', 'NONE']),
    description: z.string().max(500).optional(),
    value: priceRialSchema.optional(),
    documents: z.array(z.string().url()).optional(),
  }),
});

/**
 * Cheque Registration Schema
 */
export const chequeRegistrationSchema = z.object({
  organizationId: uuidSchema,
  chequeNumber: z.string().min(10).max(20),
  bankName: z.string().min(2).max(50),
  branchCode: z.string().min(3).max(10),
  accountNumber: z.string().min(10).max(20),
  amount: priceRialSchema,
  dueDate: z.string().datetime(),
  issuerName: persianNameSchema,
  issuerNationalId: nationalIdSchema,
  image: z.string().url(),
});

/**
 * Proforma Invoice Schema
 */
export const proformaInvoiceSchema = z.object({
  organizationId: uuidSchema,
  items: z
    .array(
      z.object({
        productId: uuidSchema,
        variantId: uuidSchema.optional(),
        quantity: z.number().int().min(1),
        unitPrice: priceRialSchema,
        discount: z.number().min(0).max(100).optional(),
      })
    )
    .min(1),
  validUntil: z.string().datetime(),
  paymentTerms: z.enum(['IMMEDIATE', 'NET_30', 'NET_60', 'NET_90', 'CREDIT']),
  shippingTerms: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Organization Update Schema
 */
export const organizationUpdateSchema = organizationRegistrationSchema.partial().extend({
  id: uuidSchema,
});

/**
 * Organization Search Schema
 */
export const organizationSearchSchema = z.object({
  q: z.string().max(100).optional(),
  type: organizationTypeSchema.optional(),
  dealerTier: dealerTierSchema.optional(),
  isActive: z.boolean().optional(),
  hasCredit: z.boolean().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'creditLimit']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type OrganizationType = z.infer<typeof organizationTypeSchema>;
export type DealerTier = z.infer<typeof dealerTierSchema>;
export type OrganizationRegistration = z.infer<typeof organizationRegistrationSchema>;
export type DealerApplication = z.infer<typeof dealerApplicationSchema>;
export type CreditRequest = z.infer<typeof creditRequestSchema>;
export type ChequeRegistration = z.infer<typeof chequeRegistrationSchema>;
export type ProformaInvoice = z.infer<typeof proformaInvoiceSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
export type OrganizationSearch = z.infer<typeof organizationSearchSchema>;

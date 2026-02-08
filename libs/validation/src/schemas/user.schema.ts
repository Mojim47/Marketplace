/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - User Validation Schemas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  nationalIdSchema,
  mobileSchema,
  emailSchema,
  passwordSchema,
  persianNameSchema,
  uuidSchema,
} from '../persian-validators.js';
import { addressSchema, bankAccountSchema } from './common.schema.js';

/**
 * User Roles
 */
export const userRoleSchema = z.enum([
  'GUEST',
  'USER',
  'SELLER',
  'DEALER_BRONZE',
  'DEALER_SILVER',
  'DEALER_GOLD',
  'EXECUTOR',
  'SUPPORT',
  'MODERATOR',
  'ADMIN',
  'SUPER_ADMIN',
  'SYSTEM',
]);

/**
 * User Registration Schema
 */
export const userRegistrationSchema = z
  .object({
    firstName: persianNameSchema,
    lastName: persianNameSchema,
    mobile: mobileSchema,
    email: emailSchema.optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    nationalId: nationalIdSchema.optional(),
    referralCode: z.string().max(20).optional(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'برای ثبت‌نام باید قوانین و مقررات را بپذیرید',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'رمز عبور و تکرار آن یکسان نیستند',
    path: ['confirmPassword'],
  });

/**
 * User Login Schema
 */
export const userLoginSchema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, { message: 'رمز عبور الزامی است' }),
  rememberMe: z.boolean().default(false),
});

/**
 * OTP Verification Schema
 */
export const otpVerificationSchema = z.object({
  mobile: mobileSchema,
  code: z.string().length(6, { message: 'کد تایید باید ۶ رقم باشد' }),
});

/**
 * Password Reset Request Schema
 */
export const passwordResetRequestSchema = z.object({
  mobile: mobileSchema,
});

/**
 * Password Reset Schema
 */
export const passwordResetSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'رمز عبور و تکرار آن یکسان نیستند',
    path: ['confirmPassword'],
  });

/**
 * User Profile Update Schema
 */
export const userProfileUpdateSchema = z.object({
  firstName: persianNameSchema.optional(),
  lastName: persianNameSchema.optional(),
  email: emailSchema.optional(),
  nationalId: nationalIdSchema.optional(),
  birthDate: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  avatar: z.string().url().optional(),
});

/**
 * User Address Schema
 */
export const userAddressSchema = addressSchema.extend({
  id: uuidSchema.optional(),
  title: z.string().min(1, { message: 'عنوان آدرس الزامی است' }).max(50),
  isDefault: z.boolean().default(false),
  recipientName: persianNameSchema,
  recipientMobile: mobileSchema,
});

/**
 * Change Password Schema
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'رمز عبور فعلی الزامی است' }),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'رمز عبور جدید و تکرار آن یکسان نیستند',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'رمز عبور جدید نباید با رمز عبور فعلی یکسان باشد',
    path: ['newPassword'],
  });

/**
 * 2FA Setup Schema
 */
export const twoFactorSetupSchema = z.object({
  password: z.string().min(1, { message: 'رمز عبور الزامی است' }),
});

/**
 * 2FA Verification Schema
 */
export const twoFactorVerifySchema = z.object({
  code: z.string().length(6, { message: 'کد تایید باید ۶ رقم باشد' }),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type OtpVerification = z.infer<typeof otpVerificationSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;
export type UserAddress = z.infer<typeof userAddressSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type TwoFactorSetup = z.infer<typeof twoFactorSetupSchema>;
export type TwoFactorVerify = z.infer<typeof twoFactorVerifySchema>;

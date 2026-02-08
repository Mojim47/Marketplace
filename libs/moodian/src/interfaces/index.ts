/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Moodian Interfaces - تایپ‌های سیستم مودیان
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════════

export enum MoodianStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum TaxInvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
  CORRECTED = 'CORRECTED',
}

export enum InvoiceType {
  SALE = 1, // فروش
  EXPORT_SALE = 2, // فروش ارزی
  GOLD_JEWELRY = 3, // طلا و جواهر
  CONTRACT = 4, // پیمانکاری
  UTILITY = 5, // قبوض
  EXPORT = 6, // صادرات
}

export enum InvoicePattern {
  STANDARD = 1, // عادی
  GOLD = 2, // طلا
  CONTRACT = 3, // پیمانکاری
}

export enum InvoiceSubject {
  ORIGINAL = 1, // اصلی
  CORRECTION = 2, // اصلاحی
  CANCELLATION = 3, // ابطالی
  RETURN = 4, // برگشت از فروش
}

export enum PaymentMethod {
  CASH = 1, // نقدی
  NON_CASH = 2, // غیرنقدی
  BOTH = 3, // هردو
}

// ═══════════════════════════════════════════════════════════════════════════
// Invoice Item Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface TaxInvoiceItem {
  /** شناسه کالا/خدمت (SKU) */
  sku: string;
  /** شرح کالا/خدمت */
  name: string;
  /** کد کالا/خدمت (طبق طبقه‌بندی سازمان مالیاتی) */
  serviceCode?: string;
  /** تعداد */
  quantity: number;
  /** واحد اندازه‌گیری */
  measurementUnit: string;
  /** قیمت واحد (ریال) */
  unitPrice: number;
  /** مبلغ تخفیف */
  discountAmount: number;
  /** نرخ مالیات بر ارزش افزوده (درصد) - پیش‌فرض 9% */
  vatRate: number;
  /** مبلغ مالیات بر ارزش افزوده */
  vatAmount: number;
  /** مبلغ نهایی */
  totalPrice: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tax Invoice Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface TaxInvoiceData {
  /** شماره فاکتور داخلی */
  invoiceNumber: string;
  /** شناسه پیش‌فاکتور مرتبط */
  proformaId?: string;
  /** شناسه سفارش مرتبط */
  orderId?: string;
  /** شناسه سازمان صادرکننده */
  organizationId: string;

  /** نوع فاکتور */
  invoiceType?: InvoiceType;
  /** الگوی فاکتور */
  invoicePattern?: InvoicePattern;
  /** موضوع فاکتور */
  invoiceSubject?: InvoiceSubject;
  /** شناسه فاکتور اصلی (برای اصلاحی/ابطالی) */
  correctionInvoiceId?: string;

  // اطلاعات فروشنده
  seller: {
    /** شناسه مالیاتی فروشنده (14 رقم) */
    taxId: string;
    /** کد اقتصادی */
    economicCode?: string;
    /** نام/نام تجاری */
    name: string;
    /** کد پستی */
    postalCode: string;
    /** آدرس */
    address: string;
  };

  // اطلاعات خریدار
  buyer: {
    /** شناسه مالیاتی خریدار (14 رقم) - برای B2B الزامی */
    taxId?: string;
    /** کد ملی (برای اشخاص حقیقی) */
    nationalId?: string;
    /** کد اقتصادی */
    economicCode?: string;
    /** نام/نام تجاری */
    name: string;
    /** کد پستی */
    postalCode?: string;
    /** آدرس */
    address?: string;
    /** شماره تلفن */
    phone?: string;
  };

  /** اقلام فاکتور */
  items: TaxInvoiceItem[];

  /** جمع قبل از تخفیف و مالیات */
  subtotal: number;
  /** جمع تخفیفات */
  discountAmount: number;
  /** نرخ مالیات (درصد) */
  taxRate: number;
  /** مبلغ مالیات */
  taxAmount: number;
  /** مبلغ نهایی */
  totalAmount: number;

  /** روش پرداخت */
  paymentMethod?: PaymentMethod;
  /** مبلغ پرداخت نقدی */
  cashAmount?: number;
  /** مبلغ پرداخت غیرنقدی */
  nonCashAmount?: number;

  /** تاریخ صدور */
  issueDate?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// Moodian Response Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface MoodianResponse {
  success: boolean;
  /** شناسه یکتای مالیاتی (SUID) - 22 کاراکتر */
  suid?: string;
  /** شماره مرجع */
  referenceNumber?: string;
  /** تاریخ ثبت */
  registrationDate?: string;
  /** خطا */
  error?: MoodianError;
}

export interface MoodianError {
  code: string;
  message: string;
  details?: string[];
}

export interface InvoiceStatusResponse {
  /** وضعیت */
  status: MoodianStatus;
  /** پیام وضعیت */
  message: string;
  /** تاریخ آخرین بروزرسانی */
  lastUpdate: string;
  /** دلایل رد (در صورت رد شدن) */
  rejectionReasons?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface MoodianConfig {
  /** آدرس API مودیان */
  apiUrl: string;
  /** شناسه کلاینت */
  clientId: string;
  /** کلید خصوصی برای امضا */
  privateKey: string;
  /** شناسه مالیاتی کارگزار */
  fiscalId: string;
  /** فعال/غیرفعال */
  enabled: boolean;
  /** حداکثر تعداد تلاش مجدد */
  maxRetries?: number;
  /** تاخیر بین تلاش‌ها (میلی‌ثانیه) */
  retryDelay?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Electronic Signature Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface SignatureResult {
  /** امضای دیجیتال (Base64) */
  signature: string;
  /** شناسه کلید عمومی */
  publicKeyId: string;
  /** زمان امضا */
  signedAt: Date;
  /** الگوریتم امضا */
  algorithm: string;
}

export interface SignatureVerificationResult {
  /** معتبر است؟ */
  valid: boolean;
  /** پیام */
  message: string;
  /** زمان تایید */
  verifiedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// QR Code Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface QRCodeData {
  /** شناسه یکتای مالیاتی */
  suid: string;
  /** شماره فاکتور */
  invoiceNumber: string;
  /** مبلغ کل */
  totalAmount: number;
  /** تاریخ صدور */
  issueDate: string;
  /** شناسه مالیاتی فروشنده */
  sellerTaxId: string;
}

export interface QRCodeResult {
  /** کد QR به صورت Base64 */
  qrCode: string;
  /** لینک تایید */
  verificationUrl: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUID Generation Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface SUIDComponents {
  /** شناسه مالیاتی فروشنده (14 رقم) */
  sellerTaxId: string;
  /** تاریخ صدور (YYYYMMDD) */
  issueDate: string;
  /** شماره سریال روزانه (6 رقم) */
  dailySerial: string;
}

export interface SUIDGenerationResult {
  /** SUID تولید شده (22 کاراکتر) */
  suid: string;
  /** اجزای SUID */
  components: SUIDComponents;
  /** زمان تولید */
  generatedAt: Date;
}

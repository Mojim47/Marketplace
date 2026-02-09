/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Localization Interceptor
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Transforms API responses to include Persian/Jalali localized data.
 * Uses JalaliConverter and IranianCurrencyFormatter from libs/localization.
 *
 * Features:
 * - Automatic Jalali date conversion for date fields
 * - Persian currency formatting for amount fields
 * - Recursive transformation of nested objects and arrays
 * - Configurable field detection
 *
 * @module @nextgen/api/interceptors
 * Requirements: 3.1, 3.2
 */

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import {
  type IranianCurrencyFormatter,
  type JalaliConverter,
  iranianCurrency,
  jalaliConverter,
} from '@nextgen/localization';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Configuration options for LocalizationInterceptor
 */
export interface LocalizationInterceptorConfig {
  /** Fields to convert to Jalali date (default: createdAt, updatedAt, date, etc.) */
  dateFields?: string[];
  /** Fields to format as currency (default: amount, price, total, etc.) */
  currencyFields?: string[];
  /** Whether to use Persian digits in formatted values */
  usePersianDigits?: boolean;
  /** Whether to show currency unit (�����/����) */
  showCurrencyUnit?: boolean;
  /** Currency unit to use */
  currencyUnit?: 'toman' | 'rial';
  /** Whether to enable compact currency format for large numbers */
  compactCurrency?: boolean;
}

/**
 * Default date fields to convert to Jalali
 */
const DEFAULT_DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'deletedAt',
  'date',
  'startDate',
  'endDate',
  'dueDate',
  'expiresAt',
  'expiredAt',
  'paidAt',
  'shippedAt',
  'deliveredAt',
  'cancelledAt',
  'verifiedAt',
  'publishedAt',
  'scheduledAt',
  'completedAt',
  'lastLoginAt',
  'birthDate',
  'orderDate',
  'invoiceDate',
  'paymentDate',
];

/**
 * Default currency fields to format
 */
const DEFAULT_CURRENCY_FIELDS = [
  'amount',
  'price',
  'total',
  'subtotal',
  'discount',
  'tax',
  'shipping',
  'balance',
  'credit',
  'debit',
  'fee',
  'cost',
  'revenue',
  'profit',
  'unitPrice',
  'totalPrice',
  'grandTotal',
  'netAmount',
  'grossAmount',
  'refundAmount',
  'paidAmount',
  'dueAmount',
  'minPrice',
  'maxPrice',
  'originalPrice',
  'salePrice',
  'basePrice',
];

/**
 * Default configuration
 */
const DEFAULT_CONFIG: LocalizationInterceptorConfig = {
  dateFields: DEFAULT_DATE_FIELDS,
  currencyFields: DEFAULT_CURRENCY_FIELDS,
  usePersianDigits: true,
  showCurrencyUnit: true,
  currencyUnit: 'toman',
  compactCurrency: false,
};

/**
 * Localization Interceptor
 *
 * Automatically transforms API responses to include Persian localized data:
 * - Converts date fields to Jalali calendar format
 * - Formats currency fields with Persian number formatting
 *
 * @example
 * // Input response:
 * { createdAt: "2024-01-15T10:30:00Z", price: 1500000 }
 *
 * // Output response:
 * {
 *   createdAt: "2024-01-15T10:30:00Z",
 *   createdAtJalali: "????/??/??",
 *   price: 1500000,
 *   priceFormatted: "?,???,??? �����"
 * }
 */
@Injectable()
export class LocalizationInterceptor implements NestInterceptor {
  private readonly config: LocalizationInterceptorConfig;
  private readonly jalaliService: JalaliConverter;
  private readonly currencyService: IranianCurrencyFormatter;
  private readonly dateFieldsSet: Set<string>;
  private readonly currencyFieldsSet: Set<string>;

  constructor(config: Partial<LocalizationInterceptorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.jalaliService = jalaliConverter;
    this.currencyService = iranianCurrency;

    // Create sets for O(1) lookup
    this.dateFieldsSet = new Set(this.config.dateFields);
    this.currencyFieldsSet = new Set(this.config.currencyFields);
  }

  /**
   * Intercept HTTP requests and transform responses with localization
   */
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transformResponse(data)));
  }

  /**
   * Transform response data recursively
   */
  private transformResponse(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.transformResponse(item));
    }

    // Handle objects
    if (typeof data === 'object' && !(data instanceof Date)) {
      return this.transformObject(data);
    }

    return data;
  }

  /**
   * Transform a single object
   */
  private transformObject(obj: Record<string, any>): Record<string, any> {
    const transformed: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Copy original value
      transformed[key] = this.transformResponse(value);

      // Add Jalali date if this is a date field
      if (this.isDateField(key) && this.isValidDate(value)) {
        const jalaliKey = `${key}Jalali`;
        transformed[jalaliKey] = this.formatJalaliDate(value);
      }

      // Add formatted currency if this is a currency field
      if (this.isCurrencyField(key) && this.isValidNumber(value)) {
        const formattedKey = `${key}Formatted`;
        transformed[formattedKey] = this.formatCurrency(value);
      }
    }

    return transformed;
  }

  /**
   * Check if a field name is a date field
   */
  private isDateField(fieldName: string): boolean {
    return this.dateFieldsSet.has(fieldName);
  }

  /**
   * Check if a field name is a currency field
   */
  private isCurrencyField(fieldName: string): boolean {
    return this.currencyFieldsSet.has(fieldName);
  }

  /**
   * Check if a value is a valid date
   */
  private isValidDate(value: any): boolean {
    if (!value) {
      return false;
    }

    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return !Number.isNaN(date.getTime());
    }

    return false;
  }

  /**
   * Check if a value is a valid number for currency formatting
   */
  private isValidNumber(value: any): boolean {
    return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
  }

  /**
   * Format a date value to Jalali string
   */
  private formatJalaliDate(value: any): string {
    const date = value instanceof Date ? value : new Date(value);
    return this.jalaliService.format(date, 'jYYYY/jMM/jDD');
  }

  /**
   * Format a number value as Persian currency
   */
  private formatCurrency(value: number): string {
    return this.currencyService.format(value, {
      unit: this.config.currencyUnit,
      showUnit: this.config.showCurrencyUnit,
      usePersianDigits: this.config.usePersianDigits,
      useGrouping: true,
      compact: this.config.compactCurrency,
    });
  }

  /**
   * Get the current configuration
   */
  getConfig(): LocalizationInterceptorConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create LocalizationInterceptor with custom config
 */
export function createLocalizationInterceptor(
  config?: Partial<LocalizationInterceptorConfig>
): LocalizationInterceptor {
  return new LocalizationInterceptor(config);
}

export default LocalizationInterceptor;

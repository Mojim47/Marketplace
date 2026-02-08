/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUID Generator Service - تولید شناسه یکتای مالیاتی
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SUID (Unique Tax ID) یک شناسه 22 کاراکتری است که طبق استاندارد مودیان
 * برای هر فاکتور تولید می‌شود.
 *
 * فرمت SUID:
 * - 14 رقم اول: شناسه مالیاتی فروشنده
 * - 8 رقم بعدی: تاریخ صدور (YYYYMMDD) به صورت هگزادسیمال فشرده
 *
 * نکته: این پیاده‌سازی بر اساس مستندات رسمی مودیان است.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Injectable, Logger } from '@nestjs/common';
import { SUIDComponents, SUIDGenerationResult } from './interfaces';

@Injectable()
export class SUIDGeneratorService {
  private readonly logger = new Logger('SUIDGeneratorService');

  // Counter for daily serial numbers (in production, use Redis or DB)
  private dailySerialCounters: Map<string, number> = new Map();
  private lastResetDate: string = '';

  /**
   * تولید SUID یکتا برای فاکتور
   *
   * @param sellerTaxId شناسه مالیاتی فروشنده (14 رقم)
   * @param issueDate تاریخ صدور فاکتور
   * @returns SUID تولید شده
   */
  generateSUID(sellerTaxId: string, issueDate: Date = new Date()): SUIDGenerationResult {
    // Validate seller tax ID
    if (!this.validateTaxId(sellerTaxId)) {
      throw new Error(`شناسه مالیاتی نامعتبر است: ${sellerTaxId}`);
    }

    // Format date as YYYYMMDD
    const dateStr = this.formatDate(issueDate);

    // Reset daily counters if date changed
    this.resetDailyCountersIfNeeded(dateStr);

    // Get next serial number for this seller on this date
    const counterKey = `${sellerTaxId}-${dateStr}`;
    const serial = this.getNextSerial(counterKey);

    // Generate SUID components
    const components: SUIDComponents = {
      sellerTaxId,
      issueDate: dateStr,
      dailySerial: serial.toString().padStart(6, '0'),
    };

    // Build SUID: 14 digits tax ID + 8 chars encoded date/serial
    const suid = this.buildSUID(components);

    this.logger.debug(`Generated SUID: ${suid} for seller: ${sellerTaxId}`);

    return {
      suid,
      components,
      generatedAt: new Date(),
    };
  }

  /**
   * اعتبارسنجی فرمت SUID
   *
   * @param suid شناسه یکتای مالیاتی
   * @returns آیا فرمت معتبر است؟
   */
  validateSUID(suid: string): boolean {
    // SUID must be exactly 22 characters
    if (!suid || suid.length !== 22) {
      return false;
    }

    // First 14 characters must be digits (tax ID)
    const taxIdPart = suid.substring(0, 14);
    if (!/^\d{14}$/.test(taxIdPart)) {
      return false;
    }

    // Remaining 8 characters must be alphanumeric
    const encodedPart = suid.substring(14);
    if (!/^[A-Z0-9]{8}$/.test(encodedPart)) {
      return false;
    }

    return true;
  }

  /**
   * استخراج اجزای SUID
   *
   * @param suid شناسه یکتای مالیاتی
   * @returns اجزای SUID
   */
  parseSUID(suid: string): SUIDComponents | null {
    if (!this.validateSUID(suid)) {
      return null;
    }

    const sellerTaxId = suid.substring(0, 14);
    const encodedPart = suid.substring(14);

    // Decode the date and serial from the encoded part
    const decoded = this.decodeEncodedPart(encodedPart);

    return {
      sellerTaxId,
      issueDate: decoded.date,
      dailySerial: decoded.serial,
    };
  }

  /**
   * اعتبارسنجی شناسه مالیاتی
   *
   * @param taxId شناسه مالیاتی
   * @returns آیا معتبر است؟
   */
  validateTaxId(taxId: string): boolean {
    // Tax ID must be exactly 14 digits
    if (!taxId || !/^\d{14}$/.test(taxId)) {
      return false;
    }

    // Additional validation: check digit algorithm (simplified)
    // In production, implement full Moodian check digit algorithm
    return true;
  }

  /**
   * تولید شناسه مالیاتی تصادفی برای تست
   *
   * @returns شناسه مالیاتی تصادفی
   */
  generateRandomTaxId(): string {
    // Generate 14 random digits
    const digits = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');

    return digits;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private resetDailyCountersIfNeeded(currentDate: string): void {
    if (this.lastResetDate !== currentDate) {
      this.dailySerialCounters.clear();
      this.lastResetDate = currentDate;
      this.logger.debug(`Reset daily serial counters for date: ${currentDate}`);
    }
  }

  private getNextSerial(counterKey: string): number {
    const current = this.dailySerialCounters.get(counterKey) || 0;
    const next = current + 1;

    if (next > 999999) {
      throw new Error('حداکثر تعداد فاکتور روزانه (999,999) برای این فروشنده تکمیل شده است');
    }

    this.dailySerialCounters.set(counterKey, next);
    return next;
  }

  private buildSUID(components: SUIDComponents): string {
    // Combine date and serial into a single number
    const dateNum = parseInt(components.issueDate, 10);
    const serialNum = parseInt(components.dailySerial, 10);

    // Create a combined value: date * 1000000 + serial
    const combined = BigInt(dateNum) * BigInt(1000000) + BigInt(serialNum);

    // Convert to base36 and pad to 8 characters
    const encoded = combined.toString(36).toUpperCase().padStart(8, '0');

    // Take last 8 characters if longer
    const encodedPart = encoded.slice(-8);

    return `${components.sellerTaxId}${encodedPart}`;
  }

  private decodeEncodedPart(encoded: string): { date: string; serial: string } {
    try {
      // Convert from base36 back to number
      const combined = BigInt(parseInt(encoded, 36));

      // Extract date and serial
      const serialNum = combined % BigInt(1000000);
      const dateNum = combined / BigInt(1000000);

      return {
        date: dateNum.toString(),
        serial: serialNum.toString().padStart(6, '0'),
      };
    } catch {
      return {
        date: '00000000',
        serial: '000000',
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * تولید SUID ساده (برای استفاده خارج از NestJS)
 */
export function generateSimpleSUID(sellerTaxId: string, issueDate: Date = new Date()): string {
  const service = new SUIDGeneratorService();
  return service.generateSUID(sellerTaxId, issueDate).suid;
}

/**
 * اعتبارسنجی SUID ساده
 */
export function validateSimpleSUID(suid: string): boolean {
  const service = new SUIDGeneratorService();
  return service.validateSUID(suid);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QR Code Service - سرویس تولید کد QR برای فاکتور مالیاتی
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * این سرویس برای تولید کد QR فاکتورهای مالیاتی استفاده می‌شود.
 * کد QR شامل اطلاعات SUID و لینک تایید است که توسط خریدار قابل اسکن است.
 *
 * فرمت داده QR:
 * - SUID (شناسه یکتای مالیاتی)
 * - شماره فاکتور
 * - مبلغ کل
 * - تاریخ صدور
 * - شناسه مالیاتی فروشنده
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { QRCodeData, QRCodeResult } from './interfaces';

@Injectable()
export class QRCodeService {
  private readonly logger = new Logger('QRCodeService');
  private readonly verificationBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.verificationBaseUrl = this.configService.get<string>(
      'MOODIAN_VERIFICATION_URL',
      'https://tp.tax.gov.ir/verify'
    );
  }

  /**
   * تولید کد QR برای فاکتور مالیاتی
   *
   * @param data داده‌های فاکتور
   * @returns کد QR و لینک تایید
   */
  async generateQRCode(data: QRCodeData): Promise<QRCodeResult> {
    // Validate input data
    this.validateQRData(data);

    // Create the data payload
    const payload = this.createPayload(data);

    // Encode payload to Base64
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Generate verification URL
    const verificationUrl = `${this.verificationBaseUrl}?q=${encodedPayload}`;

    // Generate actual QR code using qrcode library
    const qrCode = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 200,
      margin: 2,
    });

    this.logger.debug(`Generated QR code for SUID: ${data.suid}`);

    return {
      qrCode,
      verificationUrl,
    };
  }

  /**
   * استخراج داده از کد QR
   *
   * @param qrData داده کد QR (Base64)
   * @returns داده‌های فاکتور
   */
  parseQRCode(qrData: string): QRCodeData | null {
    try {
      // Extract the encoded payload from URL or direct data
      let encodedPayload = qrData;

      if (qrData.includes('?q=')) {
        encodedPayload = qrData.split('?q=')[1] ?? '';
      }

      // Decode from Base64
      const decoded = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      const payload = JSON.parse(decoded);

      // Validate and return
      if (this.isValidPayload(payload)) {
        return {
          suid: payload.suid,
          invoiceNumber: payload.inv,
          totalAmount: payload.amt,
          issueDate: payload.date,
          sellerTaxId: payload.seller,
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to parse QR code:', error);
      return null;
    }
  }

  /**
   * تایید صحت کد QR
   *
   * @param qrData داده کد QR
   * @param expectedData داده‌های مورد انتظار
   * @returns آیا معتبر است؟
   */
  verifyQRCode(qrData: string, expectedData: QRCodeData): boolean {
    const parsed = this.parseQRCode(qrData);

    if (!parsed) {
      return false;
    }

    return (
      parsed.suid === expectedData.suid &&
      parsed.invoiceNumber === expectedData.invoiceNumber &&
      parsed.totalAmount === expectedData.totalAmount &&
      parsed.sellerTaxId === expectedData.sellerTaxId
    );
  }

  /**
   * تولید لینک تایید مستقیم
   *
   * @param suid شناسه یکتای مالیاتی
   * @returns لینک تایید
   */
  getVerificationUrl(suid: string): string {
    return `${this.verificationBaseUrl}/${suid}`;
  }

  /**
   * تولید کد QR به صورت SVG
   *
   * @param data داده‌های فاکتور
   * @returns SVG string
   */
  async generateQRCodeSVG(data: QRCodeData): Promise<string> {
    // Validate input data
    this.validateQRData(data);

    // Create the data payload
    const payload = this.createPayload(data);

    // Encode payload to Base64
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Generate verification URL
    const verificationUrl = `${this.verificationBaseUrl}?q=${encodedPayload}`;

    // Generate actual SVG QR code using qrcode library
    const svg = await QRCode.toString(verificationUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      width: 200,
      margin: 2,
    });

    this.logger.debug(`Generated SVG QR code for SUID: ${data.suid}`);

    return svg;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private validateQRData(data: QRCodeData): void {
    const errors: string[] = [];

    if (!data.suid || data.suid.length !== 22) {
      errors.push('SUID باید 22 کاراکتر باشد');
    }

    if (!data.invoiceNumber) {
      errors.push('شماره فاکتور الزامی است');
    }

    if (data.totalAmount <= 0) {
      errors.push('مبلغ کل باید بزرگتر از صفر باشد');
    }

    if (!data.sellerTaxId || data.sellerTaxId.length !== 14) {
      errors.push('شناسه مالیاتی فروشنده باید 14 رقم باشد');
    }

    if (errors.length > 0) {
      throw new Error(`خطا در داده‌های QR: ${errors.join(', ')}`);
    }
  }

  private createPayload(data: QRCodeData): object {
    return {
      suid: data.suid,
      inv: data.invoiceNumber,
      amt: data.totalAmount,
      date: data.issueDate,
      seller: data.sellerTaxId,
      ts: Date.now(),
      hash: this.generatePayloadHash(data),
    };
  }

  private generatePayloadHash(data: QRCodeData): string {
    const hashInput = `${data.suid}|${data.invoiceNumber}|${data.totalAmount}|${data.sellerTaxId}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  private isValidPayload(payload: any): boolean {
    return (
      payload &&
      typeof payload.suid === 'string' &&
      typeof payload.inv === 'string' &&
      typeof payload.amt === 'number' &&
      typeof payload.seller === 'string'
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * تولید ساده کد QR
 */
export async function generateSimpleQRCode(data: QRCodeData): Promise<QRCodeResult> {
  const service = new QRCodeService(null as any);
  return service.generateQRCode(data);
}

/**
 * استخراج ساده داده از کد QR
 */
export function parseSimpleQRCode(qrData: string): QRCodeData | null {
  const service = new QRCodeService(null as any);
  return service.parseQRCode(qrData);
}

/**
 * تولید ساده کد QR به صورت SVG
 */
export async function generateSimpleQRCodeSVG(data: QRCodeData): Promise<string> {
  const service = new QRCodeService(null as any);
  return service.generateQRCodeSVG(data);
}

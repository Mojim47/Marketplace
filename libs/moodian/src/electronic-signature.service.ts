/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Electronic Signature Service - سرویس امضای الکترونیک
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * این سرویس برای امضای دیجیتال فاکتورهای مالیاتی با الگوریتم RSA-SHA256
 * استفاده می‌شود. امضای الکترونیک برای ارسال به سامانه مودیان الزامی است.
 *
 * الگوریتم: RSA-SHA256
 * فرمت کلید: PEM
 * فرمت امضا: Base64
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SignatureResult, SignatureVerificationResult } from './interfaces';

@Injectable()
export class ElectronicSignatureService {
  private readonly logger = new Logger('ElectronicSignatureService');
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly keyId: string;
  private readonly algorithm = 'RSA-SHA256';

  constructor(private readonly configService: ConfigService) {
    this.privateKey = this.configService.get<string>('MOODIAN_PRIVATE_KEY', '');
    this.publicKey = this.configService.get<string>('MOODIAN_PUBLIC_KEY', '');
    this.keyId = this.configService.get<string>('MOODIAN_KEY_ID', 'default-key');

    if (!this.privateKey) {
      this.logger.warn('Private key not configured. Signature operations will fail.');
    }
  }

  /**
   * امضای داده با کلید خصوصی RSA-SHA256
   *
   * @param data داده برای امضا (string یا object)
   * @returns نتیجه امضا
   */
  sign(data: string | object): SignatureResult {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);

    if (!this.privateKey) {
      throw new Error('کلید خصوصی برای امضا تنظیم نشده است');
    }

    try {
      const sign = crypto.createSign(this.algorithm);
      sign.update(dataString, 'utf8');
      sign.end();

      const signature = sign.sign(this.privateKey, 'base64');

      this.logger.debug(`Data signed successfully. Signature length: ${signature.length}`);

      return {
        signature,
        publicKeyId: this.keyId,
        signedAt: new Date(),
        algorithm: this.algorithm,
      };
    } catch (error) {
      this.logger.error('Failed to sign data:', error);
      throw new Error(
        `خطا در امضای داده: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * تایید امضا با کلید عمومی
   *
   * @param data داده اصلی
   * @param signature امضای Base64
   * @param publicKey کلید عمومی (اختیاری - از تنظیمات استفاده می‌شود)
   * @returns نتیجه تایید
   */
  verify(
    data: string | object,
    signature: string,
    publicKey?: string
  ): SignatureVerificationResult {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const keyToUse = publicKey || this.publicKey;

    if (!keyToUse) {
      throw new Error('کلید عمومی برای تایید امضا تنظیم نشده است');
    }

    try {
      const verify = crypto.createVerify(this.algorithm);
      verify.update(dataString, 'utf8');
      verify.end();

      const isValid = verify.verify(keyToUse, signature, 'base64');

      return {
        valid: isValid,
        message: isValid ? 'امضا معتبر است' : 'امضا نامعتبر است',
        verifiedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to verify signature:', error);
      return {
        valid: false,
        message: `خطا در تایید امضا: ${error instanceof Error ? error.message : 'Unknown error'}`,
        verifiedAt: new Date(),
      };
    }
  }

  /**
   * تولید هش SHA256 از داده
   *
   * @param data داده برای هش
   * @returns هش به صورت hex
   */
  hash(data: string | object): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');
  }

  /**
   * تولید جفت کلید RSA جدید (برای تست)
   *
   * @param modulusLength طول کلید (پیش‌فرض 2048)
   * @returns جفت کلید
   */
  generateKeyPair(modulusLength = 2048): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { privateKey, publicKey };
  }

  /**
   * امضای فاکتور مالیاتی
   *
   * @param invoice داده فاکتور
   * @returns فاکتور با امضا
   */
  signInvoice<T extends object>(invoice: T): T & { electronicSign: string; signedAt: Date } {
    const signResult = this.sign(invoice);

    return {
      ...invoice,
      electronicSign: signResult.signature,
      signedAt: signResult.signedAt,
    };
  }

  /**
   * تایید امضای فاکتور مالیاتی
   *
   * @param invoice فاکتور با امضا
   * @returns نتیجه تایید
   */
  verifyInvoice<T extends { electronicSign?: string }>(invoice: T): SignatureVerificationResult {
    const { electronicSign, ...invoiceData } = invoice;

    if (!electronicSign) {
      return {
        valid: false,
        message: 'فاکتور امضا ندارد',
        verifiedAt: new Date(),
      };
    }

    return this.verify(invoiceData, electronicSign);
  }

  /**
   * بررسی وجود کلید خصوصی
   */
  hasPrivateKey(): boolean {
    return !!this.privateKey;
  }

  /**
   * بررسی وجود کلید عمومی
   */
  hasPublicKey(): boolean {
    return !!this.publicKey;
  }

  /**
   * دریافت شناسه کلید
   */
  getKeyId(): string {
    return this.keyId;
  }

  /**
   * دریافت الگوریتم امضا
   */
  getAlgorithm(): string {
    return this.algorithm;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * امضای ساده داده با کلید خصوصی
 */
export function signData(data: string | object, privateKey: string): string {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(dataString, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * تایید ساده امضا با کلید عمومی
 */
export function verifySignature(
  data: string | object,
  signature: string,
  publicKey: string
): boolean {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(dataString, 'utf8');
  verify.end();
  return verify.verify(publicKey, signature, 'base64');
}

/**
 * تولید هش SHA256
 */
export function hashData(data: string | object): string {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');
}

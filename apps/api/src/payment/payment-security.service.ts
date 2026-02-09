import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/**
 * Payment data that should never be stored
 */
export interface SensitivePaymentData {
  cardNumber?: string;
  cvv?: string;
  pin?: string;
  fullCardNumber?: string;
}

/**
 * Masked payment data safe for storage/logging
 */
export interface MaskedPaymentData {
  maskedCardNumber?: string;
  cardLastFour?: string;
  cardBrand?: string;
}

/**
 * Idempotency key record
 */
export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  response: unknown;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

/**
 * Payment callback data from gateway
 */
export interface PaymentCallbackData {
  authority: string;
  status: string;
  refId?: string;
  amount?: number;
  timestamp?: number;
  signature?: string;
}

/**
 * Patterns for detecting sensitive payment data
 */
const SENSITIVE_PATTERNS = {
  // Card number patterns (13-19 digits)
  cardNumber: /\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b/g,
  // CVV patterns (3-4 digits)
  cvv: /\b\d{3,4}\b/g,
  // Iranian card number (16 digits starting with 6)
  iranianCard: /\b6\d{15}\b/g,
  // Sheba IBAN
  sheba: /\bIR\d{24}\b/gi,
};

/**
 * Card brand detection patterns
 */
const CARD_BRANDS: Record<string, RegExp> = {
  visa: /^4/,
  mastercard: /^5[1-5]/,
  amex: /^3[47]/,
  // Iranian banks
  mellat: /^6104/,
  saderat: /^6037/,
  melli: /^6037/,
  parsian: /^6221/,
  pasargad: /^5022/,
  saman: /^6219/,
  tejarat: /^6273/,
  refah: /^5894/,
  keshavarzi: /^6037/,
};

/**
 * Mask a card number for safe storage
 * Shows only first 6 and last 4 digits
 */
export function maskCardNumber(cardNumber: string): string {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  if (cleaned.length < 13) {
    return '****';
  }

  const firstSix = cleaned.slice(0, 6);
  const lastFour = cleaned.slice(-4);
  const maskedMiddle = '*'.repeat(cleaned.length - 10);

  return `${firstSix}${maskedMiddle}${lastFour}`;
}

/**
 * Get last 4 digits of card number
 */
export function getCardLastFour(cardNumber: string): string {
  const cleaned = cardNumber.replace(/[\s-]/g, '');
  return cleaned.slice(-4);
}

/**
 * Detect card brand from number
 */
export function detectCardBrand(cardNumber: string): string | null {
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  for (const [brand, pattern] of Object.entries(CARD_BRANDS)) {
    if (pattern.test(cleaned)) {
      return brand;
    }
  }

  return null;
}

/**
 * Check if data contains sensitive payment information
 */
export function containsSensitiveData(data: unknown): boolean {
  const str = typeof data === 'string' ? data : JSON.stringify(data);

  return Object.values(SENSITIVE_PATTERNS).some((pattern) => pattern.test(str));
}

/**
 * Sanitize payment data for logging
 * Removes or masks all sensitive information
 */
export function sanitizePaymentData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'cardNumber',
    'card_number',
    'pan',
    'cvv',
    'cvc',
    'cvv2',
    'cvc2',
    'pin',
    'password',
    'secret',
    'expiry',
    'exp_date',
    'expiration',
    'track1',
    'track2',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && containsSensitiveData(value)) {
      sanitized[key] = '[CONTAINS_SENSITIVE_DATA]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePaymentData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Generate idempotency key from request data
 */
export function generateIdempotencyKey(userId: string, orderId: string, amount: number): string {
  const data = `${userId}:${orderId}:${amount}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate request hash for idempotency comparison
 */
export function generateRequestHash(request: Record<string, unknown>): string {
  const normalized = JSON.stringify(request, Object.keys(request).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verify webhook signature from ZarinPal
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

/**
 * Verify webhook timestamp to prevent replay attacks
 */
export function verifyWebhookTimestamp(timestamp: number, toleranceSeconds: number = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= toleranceSeconds;
}

/**
 * Verify complete webhook callback
 */
export function verifyWebhookCallback(
  data: PaymentCallbackData,
  rawPayload: string,
  signature: string | undefined,
  secret: string
): WebhookVerificationResult {
  // Verify signature if provided
  if (signature) {
    const signatureValid = verifyWebhookSignature(rawPayload, signature, secret);
    if (!signatureValid) {
      return { valid: false, reason: '����� �������' };
    }
  }

  // Verify timestamp if provided
  if (data.timestamp) {
    const timestampValid = verifyWebhookTimestamp(data.timestamp);
    if (!timestampValid) {
      return { valid: false, reason: '���� ������� ����� ���' };
    }
  }

  // Verify required fields
  if (!data.authority) {
    return { valid: false, reason: '����� ��ǘ�� ������ ���' };
  }

  return { valid: true, timestamp: data.timestamp };
}

/**
 * Payment Security Service
 *
 * Features:
 * - Sensitive data masking and sanitization
 * - Idempotency key management
 * - Webhook signature verification
 * - Replay attack prevention
 * - Secure logging
 */
@Injectable()
export class PaymentSecurityService {
  private readonly logger = new Logger(PaymentSecurityService.name);
  private readonly idempotencyCache = new Map<string, IdempotencyRecord>();
  private readonly webhookSecret: string;
  private readonly idempotencyTTL: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.webhookSecret = process.env.ZARINPAL_WEBHOOK_SECRET || '';

    if (!this.webhookSecret && process.env.NODE_ENV === 'production') {
      this.logger.warn('ZARINPAL_WEBHOOK_SECRET not configured');
    }
  }

  /**
   * Mask sensitive payment data for storage
   */
  maskPaymentData(data: SensitivePaymentData): MaskedPaymentData {
    const masked: MaskedPaymentData = {};

    if (data.cardNumber || data.fullCardNumber) {
      const cardNumber = data.cardNumber || data.fullCardNumber || '';
      masked.maskedCardNumber = maskCardNumber(cardNumber);
      masked.cardLastFour = getCardLastFour(cardNumber);
      masked.cardBrand = detectCardBrand(cardNumber) || undefined;
    }

    return masked;
  }

  /**
   * Sanitize data for logging
   */
  sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
    return sanitizePaymentData(data);
  }

  /**
   * Check and get idempotent response
   */
  async checkIdempotency(
    idempotencyKey: string,
    requestHash: string
  ): Promise<{ isDuplicate: boolean; response?: unknown }> {
    const record = this.idempotencyCache.get(idempotencyKey);

    if (!record) {
      return { isDuplicate: false };
    }

    // Check if expired
    if (record.expiresAt < new Date()) {
      this.idempotencyCache.delete(idempotencyKey);
      return { isDuplicate: false };
    }

    // Check if request hash matches
    if (record.requestHash !== requestHash) {
      throw new BadRequestException('���� ������� �� ������� ������� ������� ��� ���');
    }

    this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
    return { isDuplicate: true, response: record.response };
  }

  /**
   * Store idempotent response
   */
  async storeIdempotentResponse(
    idempotencyKey: string,
    requestHash: string,
    response: unknown
  ): Promise<void> {
    const record: IdempotencyRecord = {
      key: idempotencyKey,
      requestHash,
      response,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.idempotencyTTL),
    };

    this.idempotencyCache.set(idempotencyKey, record);
  }

  /**
   * Verify webhook callback
   */
  verifyCallback(
    data: PaymentCallbackData,
    rawPayload: string,
    signature?: string
  ): WebhookVerificationResult {
    return verifyWebhookCallback(data, rawPayload, signature, this.webhookSecret);
  }

  /**
   * Generate secure payment reference
   */
  generatePaymentReference(): string {
    return `PAY-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  /**
   * Validate payment amount
   */
  validateAmount(amount: number): boolean {
    // Minimum 1000 Rials (100 Tomans)
    if (amount < 1000) {
      return false;
    }

    // Maximum 500,000,000 Rials (50 million Tomans)
    if (amount > 500000000) {
      return false;
    }

    // Must be positive integer
    if (!Number.isInteger(amount) || amount <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Clean up expired idempotency records
   */
  cleanupExpiredRecords(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [key, record] of this.idempotencyCache.entries()) {
      if (record.expiresAt < now) {
        this.idempotencyCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired idempotency records`);
    }

    return cleaned;
  }
}

/**
 * Export for testing
 */
export const __testing = {
  maskCardNumber,
  getCardLastFour,
  detectCardBrand,
  containsSensitiveData,
  sanitizePaymentData,
  generateIdempotencyKey,
  generateRequestHash,
  verifyWebhookSignature,
  verifyWebhookTimestamp,
  verifyWebhookCallback,
  SENSITIVE_PATTERNS,
  CARD_BRANDS,
};

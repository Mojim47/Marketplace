import { createHmac } from 'crypto';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaymentCallbackData, PaymentSecurityService, __testing } from './payment-security.service';

const {
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
} = __testing;

describe('Payment Security', () => {
  describe('Property 17: Payment Data Protection', () => {
    it('should mask card numbers correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000000000, max: 9999999999999999 }).map((n) => n.toString()),
          (cardNumber) => {
            const masked = maskCardNumber(cardNumber);

            // Should show first 6 digits
            expect(masked.slice(0, 6)).toBe(cardNumber.slice(0, 6));

            // Should show last 4 digits
            expect(masked.slice(-4)).toBe(cardNumber.slice(-4));

            // Middle should be masked
            const middle = masked.slice(6, -4);
            expect(middle).toMatch(/^\*+$/);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should extract last 4 digits correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000000000, max: 9999999999999999 }).map((n) => n.toString()),
          (cardNumber) => {
            const lastFour = getCardLastFour(cardNumber);
            expect(lastFour).toBe(cardNumber.slice(-4));
            expect(lastFour.length).toBe(4);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect Iranian card brands', () => {
      const iranianCards = [
        { number: '6104337812345678', brand: 'mellat' },
        { number: '6221061234567890', brand: 'parsian' },
        { number: '5022291234567890', brand: 'pasargad' },
        { number: '6219861234567890', brand: 'saman' },
      ];

      for (const { number, brand } of iranianCards) {
        expect(detectCardBrand(number)).toBe(brand);
      }
    });

    it('should detect sensitive data in strings', () => {
      const testCases = [
        { data: { card: '6104337812345678' }, expected: true },
        { data: { message: 'Hello world' }, expected: false },
        { data: { pan: '4111111111111111' }, expected: true },
      ];

      for (const { data, expected } of testCases) {
        expect(containsSensitiveData(data)).toBe(expected);
      }
    });

    it('should sanitize payment data for logging', () => {
      const sensitiveData = {
        cardNumber: '6104337812345678',
        cvv: '123',
        description: 'Test payment',
        amount: 50000,
      };

      const sanitized = sanitizePaymentData(sensitiveData);

      // cardNumber key matches sensitive keys, so it's REDACTED
      expect(sanitized.cardNumber).toBe('[REDACTED]');
      expect(sanitized.cvv).toBe('[REDACTED]');
      expect(sanitized.description).toBe('Test payment');
      expect(sanitized.amount).toBe(50000);
    });

    it('should mark strings containing card numbers as sensitive', () => {
      const data = {
        message: 'Card is 6104337812345678',
        note: 'Regular note',
      };

      const sanitized = sanitizePaymentData(data);

      // String containing card number is marked as containing sensitive data
      expect(sanitized.message).toBe('[CONTAINS_SENSITIVE_DATA]');
      expect(sanitized.note).toBe('Regular note');
    });

    it('should never expose CVV in any form', () => {
      const cvvVariants = ['cvv', 'cvc', 'cvv2', 'cvc2'];

      for (const key of cvvVariants) {
        const data = { [key]: '123' };
        const sanitized = sanitizePaymentData(data);
        expect(sanitized[key]).toBe('[REDACTED]');
      }
    });

    it('should handle nested sensitive data', () => {
      const data = {
        payment: {
          card: {
            cardNumber: '6104337812345678',
            cvv: '123',
          },
          amount: 50000,
        },
      };

      const sanitized = sanitizePaymentData(data);

      expect((sanitized.payment as any).card.cardNumber).toBe('[REDACTED]');
      expect((sanitized.payment as any).card.cvv).toBe('[REDACTED]');
      expect((sanitized.payment as any).amount).toBe(50000);
    });
  });

  describe('Property 18: Payment Callback Verification', () => {
    it('should verify valid webhook signatures', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 32, maxLength: 64 }),
          fc.integer({ min: 1000, max: 1000000 }),
          fc.uuid(),
          (secret, amount, orderId) => {
            const payload = JSON.stringify({ amount, orderId });
            const signature = createHmac('sha256', secret).update(payload).digest('hex');

            const isValid = verifyWebhookSignature(payload, signature, secret);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should reject invalid webhook signatures', () => {
      const secret = 'test-secret-key-12345678901234567890';
      const payload = JSON.stringify({ amount: 50000, orderId: 'order-123' });
      const fakeSignature = 'a'.repeat(64);

      const isValid = verifyWebhookSignature(payload, fakeSignature, secret);
      expect(isValid).toBe(false);
    });

    it('should reject tampered payloads', () => {
      const secret = 'test-secret-key-12345678901234567890';
      const originalPayload = { amount: 50000, orderId: 'order-123' };
      const payloadStr = JSON.stringify(originalPayload);
      const signature = createHmac('sha256', secret).update(payloadStr).digest('hex');

      // Tamper with the payload
      const tamperedPayload = { ...originalPayload, amount: 100000 };
      const tamperedStr = JSON.stringify(tamperedPayload);

      const isValid = verifyWebhookSignature(tamperedStr, signature, secret);
      expect(isValid).toBe(false);
    });

    it('should verify timestamps within tolerance', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 299 }), (secondsAgo) => {
          const timestamp = Math.floor(Date.now() / 1000) - secondsAgo;
          const isValid = verifyWebhookTimestamp(timestamp, 300);
          expect(isValid).toBe(true);
        }),
        { numRuns: 30 }
      );
    });

    it('should reject expired timestamps', () => {
      fc.assert(
        fc.property(fc.integer({ min: 301, max: 3600 }), (secondsAgo) => {
          const timestamp = Math.floor(Date.now() / 1000) - secondsAgo;
          const isValid = verifyWebhookTimestamp(timestamp, 300);
          expect(isValid).toBe(false);
        }),
        { numRuns: 30 }
      );
    });

    it('should validate complete callback data', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.constantFrom('OK', 'NOK'), (authority, status) => {
          const data: PaymentCallbackData = {
            authority,
            status,
            timestamp: Math.floor(Date.now() / 1000),
          };

          const result = verifyWebhookCallback(data, JSON.stringify(data), undefined, '');
          expect(result.valid).toBe(true);
        }),
        { numRuns: 30 }
      );
    });

    it('should reject callback without authority', () => {
      const data: PaymentCallbackData = {
        authority: '',
        status: 'OK',
      };

      const result = verifyWebhookCallback(data, JSON.stringify(data), undefined, '');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('����� ��ǘ��');
    });
  });

  describe('Property 19: Payment Idempotency', () => {
    let service: PaymentSecurityService;

    beforeEach(() => {
      service = new PaymentSecurityService();
    });

    it('should generate consistent idempotency keys', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1000, max: 1000000 }),
          (userId, orderId, amount) => {
            const key1 = generateIdempotencyKey(userId, orderId, amount);
            const key2 = generateIdempotencyKey(userId, orderId, amount);
            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate different keys for different inputs', () => {
      const key1 = generateIdempotencyKey('user1', 'order1', 1000);
      const key2 = generateIdempotencyKey('user2', 'order1', 1000);
      const key3 = generateIdempotencyKey('user1', 'order2', 1000);
      const key4 = generateIdempotencyKey('user1', 'order1', 2000);

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).not.toBe(key4);
    });

    it('should generate consistent request hashes', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1000, max: 1000000 }),
          (userId, orderId, amount) => {
            const request = { userId, orderId, amount };
            const hash1 = generateRequestHash(request);
            const hash2 = generateRequestHash(request);
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return cached response for duplicate requests', async () => {
      const idempotencyKey = 'test-key-123';
      const requestHash = 'hash-123';
      const response = { success: true, refId: 'REF123' };

      await service.storeIdempotentResponse(idempotencyKey, requestHash, response);
      const result = await service.checkIdempotency(idempotencyKey, requestHash);

      expect(result.isDuplicate).toBe(true);
      expect(result.response).toEqual(response);
    });

    it('should reject mismatched request hash', async () => {
      const idempotencyKey = 'test-key-456';
      const originalHash = 'hash-original';
      const differentHash = 'hash-different';

      await service.storeIdempotentResponse(idempotencyKey, originalHash, { success: true });

      await expect(service.checkIdempotency(idempotencyKey, differentHash)).rejects.toThrow(
        '���� �������'
      );
    });

    it('should not find non-existent idempotency key', async () => {
      const result = await service.checkIdempotency('non-existent-key', 'any-hash');

      expect(result.isDuplicate).toBe(false);
      expect(result.response).toBeUndefined();
    });

    it('should validate payment amounts', () => {
      // Valid amounts
      expect(service.validateAmount(1000)).toBe(true);
      expect(service.validateAmount(500000000)).toBe(true);
      expect(service.validateAmount(50000)).toBe(true);

      // Invalid amounts
      expect(service.validateAmount(999)).toBe(false);
      expect(service.validateAmount(0)).toBe(false);
      expect(service.validateAmount(-1000)).toBe(false);
      expect(service.validateAmount(500000001)).toBe(false);
      expect(service.validateAmount(1000.5)).toBe(false);
    });

    it('should generate unique payment references', () => {
      const references = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const ref = service.generatePaymentReference();
        expect(references.has(ref)).toBe(false);
        references.add(ref);
        expect(ref).toMatch(/^PAY-\d+-[A-Z0-9]{8}$/);
      }
    });
  });

  describe('Card Brand Detection', () => {
    it('should detect international card brands', () => {
      expect(detectCardBrand('4111111111111111')).toBe('visa');
      expect(detectCardBrand('5111111111111111')).toBe('mastercard');
    });

    it('should return null for unknown cards', () => {
      expect(detectCardBrand('9999999999999999')).toBeNull();
    });
  });

  describe('PaymentSecurityService', () => {
    let service: PaymentSecurityService;

    beforeEach(() => {
      service = new PaymentSecurityService();
    });

    it('should mask payment data correctly', () => {
      const masked = service.maskPaymentData({
        cardNumber: '6104337812345678',
      });

      expect(masked.maskedCardNumber).toBe('610433******5678');
      expect(masked.cardLastFour).toBe('5678');
      expect(masked.cardBrand).toBe('mellat');
    });

    it('should sanitize data for logging', () => {
      const sanitized = service.sanitizeForLogging({
        cardNumber: '6104337812345678',
        cvv: '123',
        amount: 50000,
      });

      expect(sanitized.cardNumber).toBe('[REDACTED]');
      expect(sanitized.cvv).toBe('[REDACTED]');
      expect(sanitized.amount).toBe(50000);
    });

    it('should clean up expired records', async () => {
      await service.storeIdempotentResponse('key1', 'hash1', { data: 'test' });

      // Manually expire it
      const cache = (service as any).idempotencyCache;
      const record = cache.get('key1');
      record.expiresAt = new Date(Date.now() - 1000);

      const cleaned = service.cleanupExpiredRecords();
      expect(cleaned).toBe(1);

      const result = await service.checkIdempotency('key1', 'hash1');
      expect(result.isDuplicate).toBe(false);
    });
  });
});

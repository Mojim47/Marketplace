import { describe, it, expect, vi } from 'vitest';
import { PaymentService, PAYMENT_AUDIT_SERVICE } from './payment.service';
import { ConfigService } from '@nestjs/config';

// Minimal fakes
const prisma: any = {};
const securityService: any = {};
const circuitBreakerService: any = { createBreaker: () => ({}), fire: vi.fn() };
const auditService: any = {};
const taxService: any = {};
const queueService: any = { registerWorker: vi.fn(), addJob: vi.fn() };

describe('PaymentService helpers', () => {
  it('masks PAN to 6-6-4 format', () => {
    const service = new PaymentService(
      prisma,
      securityService,
      circuitBreakerService,
      auditService,
      taxService,
      new ConfigService({ FEATURE_MOODIAN_V2: 'false' }),
      {} as any,
      queueService,
    );
    const masked = (service as any).maskPan('1234567890123456');
    expect(masked).toBe('123456******3456');
  });

  it('returns **** when PAN too short', () => {
    const service = new PaymentService(
      prisma,
      securityService,
      circuitBreakerService,
      auditService,
      taxService,
      new ConfigService({ FEATURE_MOODIAN_V2: 'false' }),
      {} as any,
      queueService,
    );
    const masked = (service as any).maskPan('12345');
    expect(masked).toBe('****');
  });
});

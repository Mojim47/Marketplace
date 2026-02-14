// iso27001:A.12.4.1 | fata:1404-07.art8 | data-residency:IR
import { randomUUID } from 'node:crypto';

export type EscrowIntent = {
  id: string;
  from: string;
  to: string;
  points: number;
  createdAt: number;
  expiresAt: number;
  nonce: string;
};

export type EscrowStatus = 'open' | 'released' | 'canceled';

export type EscrowRecord = EscrowIntent & {
  status: EscrowStatus;
  releasedAt?: number;
  canceledAt?: number;
};

export class PointsEscrow {
  private readonly ttlMs: number;
  private readonly storage = new Map<string, EscrowRecord>();

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  open(from: string, to: string, points: number): EscrowRecord {
    if (points <= 0) {
      throw new Error('مقدار امتیاز معتبر نیست');
    }
    const now = Date.now();
    const intent: EscrowRecord = {
      id: randomUUID(),
      from,
      to,
      points,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      nonce: randomUUID().replace(/-/g, ''),
      status: 'open',
    };
    this.storage.set(intent.id, intent);
    return intent;
  }

  release(id: string, verifier: (record: EscrowRecord) => boolean): EscrowRecord {
    const record = this.storage.get(id);
    if (!record) {
      throw new Error('درخواست یافت نشد');
    }
    if (record.status !== 'open') {
      return record;
    }
    if (record.expiresAt < Date.now()) {
      record.status = 'canceled';
      record.canceledAt = Date.now();
      return record;
    }
    if (!verifier(record)) {
      throw new Error('تأیید انتقال انجام نشد');
    }
    record.status = 'released';
    record.releasedAt = Date.now();
    return record;
  }

  cancel(id: string): EscrowRecord {
    const record = this.storage.get(id);
    if (!record) {
      throw new Error('درخواست یافت نشد');
    }
    if (record.status !== 'open') {
      return record;
    }
    record.status = 'canceled';
    record.canceledAt = Date.now();
    return record;
  }

  listActive(): EscrowRecord[] {
    const now = Date.now();
    for (const record of this.storage.values()) {
      if (record.status === 'open' && record.expiresAt < now) {
        record.status = 'canceled';
        record.canceledAt = now;
      }
    }
    return Array.from(this.storage.values()).filter((record) => record.status === 'open');
  }
}

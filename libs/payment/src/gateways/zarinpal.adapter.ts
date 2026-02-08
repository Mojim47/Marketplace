import { PaymentGateway, PaymentInitRequest } from '../types.js';

export type VerifyStatus = 'success' | 'failed' | 'pending';

export interface ZarinpalClientV5 {
  requestPayment(input: {
    amount: number;
    callbackUrl: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<{ authority: string; url: string }>;
  verifyPayment(input: { authority: string; amount: number }): Promise<{
    status: VerifyStatus;
    refId?: string;
  }>;
  refundPayment?(input: { authority: string; amount: number }): Promise<{ ok: boolean }>;
}

export interface IdempotencyStore {
  has(key: string): boolean;
  set(key: string, value: string, ttlSeconds?: number): void;
}
export class MemoryIdempotency implements IdempotencyStore {
  private m = new Map<string, { v: string; exp: number }>();
  has(key: string): boolean {
    const e = this.m.get(key);
    if (!e) return false;
    if (e.exp && Date.now() > e.exp) {
      this.m.delete(key);
      return false;
    }
    return true;
  }
  set(key: string, value: string, ttlSeconds = 86400): void {
    const exp = Date.now() + ttlSeconds * 1000;
    this.m.set(key, { v: value, exp });
  }
}

export class ZarinpalPaymentService implements PaymentGateway {
  private readonly authorityToKey = new Map<string, string>();
  private readonly initCache = new Map<
    string,
    { authority: string; url: string; status: 'initialized' }
  >();
  private readonly verifyCache = new Map<string, { status: VerifyStatus; refId?: string }>();
  constructor(
    private client: ZarinpalClientV5,
    private idem: IdempotencyStore = new MemoryIdempotency()
  ) {}

  async initialize(
    req: PaymentInitRequest
  ): Promise<{ authority: string; url: string; status: 'initialized' }> {
    if (!req.idempotencyKey) throw new Error('idempotency-key-required');
    if (this.initCache.has(req.idempotencyKey)) return this.initCache.get(req.idempotencyKey)!;
    if (this.idem.has(req.idempotencyKey)) throw new Error('idempotency-replay');
    this.idem.set(req.idempotencyKey, req.orderId);
    const base: {
      amount: number;
      callbackUrl: string;
      description?: string;
      metadata?: Record<string, any>;
    } = { amount: req.amount, callbackUrl: req.callbackUrl };
    if (Object.prototype.hasOwnProperty.call(req, 'description'))
      base.description = req.description as any;
    if (Object.prototype.hasOwnProperty.call(req, 'metadata')) base.metadata = req.metadata as any;
    const res = await this.client.requestPayment(base);
    this.authorityToKey.set(res.authority, req.idempotencyKey);
    const out = { authority: res.authority, url: res.url, status: 'initialized' as const };
    this.initCache.set(req.idempotencyKey, out);
    return out;
  }

  async verify(authority: string, amount: number, idempotencyKey: string) {
    const bound = this.authorityToKey.get(authority);
    if (bound && bound !== idempotencyKey) throw new Error('idempotency-mismatch');
    const cacheKey = `${authority}:${amount}`;
    if (this.verifyCache.has(cacheKey)) return this.verifyCache.get(cacheKey)!;
    const res = await this.client.verifyPayment({ authority, amount });
    this.verifyCache.set(cacheKey, res);
    return res;
  }

  getIdempotencyKey(authority: string): string | undefined {
    return this.authorityToKey.get(authority);
  }

  // Force a fresh verification (used by reconciliation jobs)
  async reverify(
    authority: string,
    amount: number
  ): Promise<{ status: VerifyStatus; refId?: string }> {
    const res = await this.client.verifyPayment({ authority, amount });
    const cacheKey = `${authority}:${amount}`;
    this.verifyCache.set(cacheKey, res);
    return res;
  }
}

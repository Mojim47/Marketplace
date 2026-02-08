import { describe, expect, it } from 'vitest';
import { MemoryIdempotency, ZarinpalPaymentService } from '../src/gateways/zarinpal.adapter.js';

describe('ZarinpalPaymentService edge cases', () => {
  it('initialize throws when idempotency key missing', async () => {
    const svc = new ZarinpalPaymentService({
      requestPayment: async () => ({ authority: 'a', url: 'u' }),
      verifyPayment: async () => ({ status: 'success', refId: 'r' }),
    } as any);
    await expect(
      svc.initialize({
        amount: 100,
        currency: 'IRR',
        callbackUrl: 'http://',
        orderId: 'o',
        idempotencyKey: '',
      } as any)
    ).rejects.toThrow('idempotency-key-required');
  });

  it('verify throws idempotency-mismatch when authority bound to different key', async () => {
    const client = {
      requestPayment: async () => ({ authority: 'auth1', url: 'u' }),
      verifyPayment: async () => ({ status: 'success' }),
    };
    const idem = new MemoryIdempotency();
    const svc = new ZarinpalPaymentService(client as any, idem);
    // prime with an initialize to bind authority
    const init = await svc.initialize({
      idempotencyKey: 'k1',
      amount: 10,
      currency: 'IRR',
      callbackUrl: 'c',
      orderId: 'o',
    });
    // now call verify with different key
    await expect(svc.verify(init.authority, 10, 'other')).rejects.toThrow('idempotency-mismatch');
  });

  it('initialize propagates client errors', async () => {
    const client = {
      requestPayment: async () => {
        throw new Error('net');
      },
      verifyPayment: async () => ({ status: 'failed' }),
    };
    const svc = new ZarinpalPaymentService(client as any);
    await expect(
      svc.initialize({
        idempotencyKey: 'k2',
        amount: 5,
        currency: 'IRR',
        callbackUrl: 'c',
        orderId: 'o',
      } as any)
    ).rejects.toThrow('net');
  });

  it('verify returns cached value when called twice', async () => {
    const client = {
      requestPayment: async () => ({ authority: 'auth2', url: 'u' }),
      verifyPayment: async () => ({ status: 'success', refId: 'r2' }),
    };
    const svc = new ZarinpalPaymentService(client as any);
    const init = await svc.initialize({
      idempotencyKey: 'k3',
      amount: 20,
      currency: 'IRR',
      callbackUrl: 'c',
      orderId: 'o',
    });
    const first = await svc.verify(init.authority, 20, 'k3');
    const second = await svc.verify(init.authority, 20, 'k3');
    expect(second).toEqual(first);
  });

  it('reverify forces fresh verify and updates cache', async () => {
    let called = 0;
    const client = {
      requestPayment: async () => ({ authority: 'auth3', url: 'u' }),
      verifyPayment: async () => {
        called++;
        return {
          status: called === 1 ? 'pending' : 'success',
          refId: called === 1 ? undefined : 'r3',
        };
      },
    };
    const svc = new ZarinpalPaymentService(client as any);
    const init = await svc.initialize({
      idempotencyKey: 'k4',
      amount: 30,
      currency: 'IRR',
      callbackUrl: 'c',
      orderId: 'o',
    });
    const first = await svc.verify(init.authority, 30, 'k4');
    expect(first.status).toBe('pending');
    const fresh = await svc.reverify(init.authority, 30);
    expect(fresh.status).toBe('success');
  });

  it('initialize throws idempotency-replay when idem.has true but no cache', async () => {
    const client = {
      requestPayment: async () => ({ authority: 'auth4', url: 'u' }),
      verifyPayment: async () => ({ status: 'success' }),
    };
    const idem = new MemoryIdempotency();
    // prime in idem but not in initCache
    idem.set('k5', 'v');
    const svc = new ZarinpalPaymentService(client as any, idem);
    await expect(
      svc.initialize({
        idempotencyKey: 'k5',
        amount: 5,
        currency: 'IRR',
        callbackUrl: 'c',
        orderId: 'o',
      } as any)
    ).rejects.toThrow('idempotency-replay');
  });
});

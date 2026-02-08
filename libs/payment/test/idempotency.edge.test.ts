import { describe, expect, it } from 'vitest';
import { IdempotencyService, InMemoryRedis } from '../src/services/idempotency.service.js';

describe('IdempotencyService edge', () => {
  it('ensure returns true when key expired in store', async () => {
    const mem = new InMemoryRedis();
    const svc = new IdempotencyService(mem, 1000);
    // set a key with very short expiry by directly using mem.set with PX in the past
    await mem.set('k-expired', 'v', { PX: -1000 as any });
    const ok = await svc.ensure('k-expired', 'new');
    expect(ok).toBe(true);
  });

  it('ensure returns false when key exists', async () => {
    const mem = new InMemoryRedis();
    const svc = new IdempotencyService(mem, 1000);
    await mem.set('k1', 'v', { PX: 10000 } as any);
    const ok = await svc.ensure('k1', 'v2');
    expect(ok).toBe(false);
  });
});

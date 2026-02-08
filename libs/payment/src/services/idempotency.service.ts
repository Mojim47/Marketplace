export interface RedisLike {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, opts?: { PX?: number }): Promise<'OK'> | 'OK';
}

export class IdempotencyService {
  constructor(
    private client: RedisLike,
    private ttlMs = 86400000
  ) {}
  async ensure(key: string, value: string): Promise<boolean> {
    const existing = await this.client.get(key);
    if (existing) return false;
    await this.client.set(key, value, { PX: this.ttlMs });
    return true;
  }
}

export class InMemoryRedis implements RedisLike {
  private m = new Map<string, { v: string; exp: number }>();
  async get(key: string) {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) {
      this.m.delete(key);
      return null;
    }
    return e.v;
  }
  async set(key: string, value: string, opts?: { PX?: number }): Promise<'OK'> {
    const exp = Date.now() + (opts?.PX ?? 0);
    this.m.set(key, { v: value, exp });
    return 'OK';
  }
}

export interface IdempotencyStore {
  has(key: string): boolean;
  set(key: string, value: string): void;
}
export class MemoryIdemStore implements IdempotencyStore {
  private m = new Map<string, string>();
  has(k: string) {
    return this.m.has(k);
  }
  set(k: string, v: string) {
    this.m.set(k, v);
  }
}
export class IdempotencyGuard {
  constructor(private store: IdempotencyStore) {}
  ensure(key: string): boolean {
    if (!key) {
      return false;
    }
    if (this.store.has(key)) {
      return false;
    }
    this.store.set(key, '1');
    return true;
  }
}

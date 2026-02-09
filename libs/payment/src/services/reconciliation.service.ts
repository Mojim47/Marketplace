import type { VerifyStatus, ZarinpalPaymentService } from '../gateways/zarinpal.adapter.js';

export interface ReconcileResult {
  authority: string;
  status: VerifyStatus;
  refId?: string | undefined;
}

export class PaymentReconciliationService {
  constructor(
    private zarinpal: ZarinpalPaymentService,
    private clock: () => number = () => Date.now()
  ) {}
  private pending = new Map<string, { amount: number; lastChecked: number }>();

  markPending(authority: string, amount: number) {
    this.pending.set(authority, { amount, lastChecked: this.clock() });
  }

  async run(): Promise<ReconcileResult[]> {
    const results: ReconcileResult[] = [];
    for (const [authority, info] of Array.from(this.pending.entries())) {
      const r = await this.zarinpal.reverify(authority, info.amount);
      results.push({ authority, status: r.status, refId: r.refId });
      if (r.status !== 'pending') {
        this.pending.delete(authority);
      }
    }
    return results;
  }
}

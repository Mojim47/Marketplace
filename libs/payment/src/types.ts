export interface PaymentInitRequest {
  amount: number;
  currency: string;
  orderId: string;
  callbackUrl: string;
  description?: string;
  metadata?: Record<string, any>;
  idempotencyKey: string;
}
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type ReconciliationStatus = 'PENDING' | 'DONE' | 'FAILED';

export interface PaymentRecord {
  id: string;
  status: PaymentStatus;
  gateway: 'ZARINPAL';
  gatewayRefId?: string; // authority
  reconciliationStatus: ReconciliationStatus;
  amount: number;
  currency: string;
  orderId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface PaymentGateway {
  initialize(
    req: PaymentInitRequest
  ): Promise<{ authority: string; url: string; status: 'initialized' }>;
  verify(
    authority: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ status: 'success' | 'failed' | 'pending'; refId?: string }>;
}

export interface CurrencyConverter {
  convert(amount: number, from: string, to: string): number;
}

export class StaticCurrencyConverter implements CurrencyConverter {
  constructor(
    private rates: Record<string, number> = { IRR: 1, USD: 1 / 580000, EUR: 1 / 620000 }
  ) {}
  convert(amount: number, from: string, to: string): number {
    if (!this.rates[from] || !this.rates[to]) throw new Error('unsupported-currency');
    const base = amount / this.rates[from]!;
    return +(base * this.rates[to]!).toFixed(2);
  }
}

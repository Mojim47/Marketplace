export abstract class BaseWafService {
  abstract inspect(payload: unknown): Promise<void>;
  async validateRequest(_req: unknown): Promise<void> {
    return;
  }
}

// No-op implementation for environments without a real WAF
export class WAFService extends BaseWafService {
  async inspect(_payload: unknown): Promise<void> {
    return;
  }
}

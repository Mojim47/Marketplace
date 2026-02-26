import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { LoggingService } from '../../_observability/logging.service';
import { MetricsService } from '../../monitoring/metrics.service';
import {
  RuntimeReconciliationService,
  RuntimeState,
} from '../../runtime/runtime-reconciliation.service';

type ModuleKey = 'cart' | 'checkout' | 'orders';

type BucketState = {
  windowStartMs: number;
  count: number;
};

const WINDOW_MS = 1000;

@Injectable()
export class AdaptiveThrottlingGuard implements CanActivate {
  private readonly buckets = new Map<string, BucketState>();

  constructor(
    private readonly runtime: RuntimeReconciliationService,
    private readonly logging: LoggingService,
    private readonly metrics: MetricsService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const path = String(req.path || req.url || '');
    const moduleKey = this.detectModule(path);
    if (!moduleKey) {
      return true;
    }

    const snapshot = this.runtime.getSnapshot();
    const runtimeState = snapshot.state;
    const limit = this.resolveLimit(moduleKey, runtimeState);
    const accepted = this.consume(moduleKey, limit);
    if (!accepted) {
      this.metrics.adaptiveThrottleEventsTotal.inc({
        module: moduleKey,
        runtime_state: runtimeState,
        event: 'rejected',
      });
      this.logging.warn('adaptive_throttle_rejected', AdaptiveThrottlingGuard.name, {
        module: moduleKey,
        runtimeState,
        limit,
        path,
      });
      throw new HttpException('adaptive_throttle_limit_exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    this.metrics.adaptiveThrottleEventsTotal.inc({
      module: moduleKey,
      runtime_state: runtimeState,
      event: 'accepted',
    });
    return true;
  }

  private detectModule(path: string): ModuleKey | null {
    if (path.startsWith('/checkout')) return 'checkout';
    if (path.startsWith('/orders')) return 'orders';
    if (path.startsWith('/cart')) return 'cart';
    return null;
  }

  private resolveLimit(moduleKey: ModuleKey, runtimeState: RuntimeState): number {
    const normal = {
      cart: Number.parseInt(process.env.RATE_LIMIT_CART_RPS || '40', 10),
      checkout: Number.parseInt(process.env.RATE_LIMIT_CHECKOUT_RPS || '20', 10),
      orders: Number.parseInt(process.env.RATE_LIMIT_ORDERS_RPS || '25', 10),
    };
    const degraded = {
      cart: Number.parseInt(process.env.RATE_LIMIT_CART_RPS_DEGRADED || '20', 10),
      checkout: Number.parseInt(process.env.RATE_LIMIT_CHECKOUT_RPS_DEGRADED || '5', 10),
      orders: Number.parseInt(process.env.RATE_LIMIT_ORDERS_RPS_DEGRADED || '8', 10),
    };
    if (runtimeState === RuntimeState.DEGRADED) {
      return degraded[moduleKey];
    }
    return normal[moduleKey];
  }

  private consume(moduleKey: ModuleKey, limit: number): boolean {
    const now = Date.now();
    const key = moduleKey;
    const prev = this.buckets.get(key);
    if (!prev || now - prev.windowStartMs >= WINDOW_MS) {
      this.buckets.set(key, { windowStartMs: now, count: 1 });
      return true;
    }
    if (prev.count >= limit) {
      return false;
    }
    prev.count += 1;
    return true;
  }
}

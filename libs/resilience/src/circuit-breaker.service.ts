import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
// @ts-ignore
import CircuitBreaker from 'opossum';
type CircuitBreakerType = any;

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreakerType>();

  createBreaker<TArgs extends unknown[], TResult>(
    name: string,
    action: (...args: TArgs) => Promise<TResult>,
    options: CircuitBreakerOptions
  ): CircuitBreakerType {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const breaker = new CircuitBreaker(action, {
      timeout: options.timeout ?? 3000,
      errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
      resetTimeout: options.resetTimeout ?? 30000,
    });

    breaker.on('open', () => this.logger.warn(`Circuit breaker opened: ${name}`));
    breaker.on('halfOpen', () => this.logger.warn(`Circuit breaker half-open: ${name}`));
    breaker.on('close', () => this.logger.log(`Circuit breaker closed: ${name}`));

    this.breakers.set(name, breaker);
    return breaker;
  }

  async fire<TResult>(
    breaker: CircuitBreakerType,
    args: unknown[],
    fallbackMessage: string
  ): Promise<TResult> {
    try {
      return (await breaker.fire(...args)) as TResult;
    } catch (error: any) {
      if (error?.code === 'EOPENBREAKER') {
        throw new ServiceUnavailableException(fallbackMessage);
      }
      throw error;
    }
  }
}

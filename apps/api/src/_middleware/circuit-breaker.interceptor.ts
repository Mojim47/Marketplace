/**
 * ???????????????????????????????????????????????????????????????????????????
 * Circuit Breaker - Production-Ready Implementation
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Features:
 * - Three states: CLOSED, OPEN, HALF_OPEN
 * - Configurable failure threshold and reset timeout
 * - Half-open state with limited test requests
 * - Metrics for monitoring circuit state changes
 * - NestJS interceptor integration
 *
 * Security Requirements:
 * - REQ 5.6: Circuit breaker for downstream services
 * ???????????????????????????????????????????????????????????????????????????
 */

import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Circuit is closed - requests flow normally */
  CLOSED = 'closed',
  /** Circuit is open - requests are rejected immediately */
  OPEN = 'open',
  /** Circuit is half-open - limited test requests allowed */
  HALF_OPEN = 'half-open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Name for identification in logs/metrics */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit */
  resetTimeoutMs: number;
  /** Number of successful requests needed to close circuit from half-open */
  successThreshold: number;
  /** Maximum concurrent requests in half-open state */
  halfOpenMaxRequests: number;
  /** Timeout for individual requests in ms */
  requestTimeoutMs?: number;
  /** Custom clock function for testing */
  clock?: () => number;
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
  /** Callback when request fails */
  onFailure?: (error: Error, name: string) => void;
  /** Callback when request succeeds */
  onSuccess?: (name: string) => void;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  /** Current state */
  state: CircuitState;
  /** Total failure count */
  failures: number;
  /** Total success count */
  successes: number;
  /** Consecutive failures in current window */
  consecutiveFailures: number;
  /** Consecutive successes in half-open state */
  consecutiveSuccesses: number;
  /** Time of last state change */
  lastStateChange: number;
  /** Time of last failure */
  lastFailure?: number;
  /** Time of last success */
  lastSuccess?: number;
  /** Number of times circuit opened */
  openCount: number;
  /** Current requests in half-open state */
  halfOpenRequests: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  successThreshold: 3,
  halfOpenMaxRequests: 3,
  requestTimeoutMs: 10000, // 10 seconds
};

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Production-ready Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastStateChange: number;
  private lastFailure?: number;
  private lastSuccess?: number;
  private nextTry = 0;
  private openCount = 0;
  private halfOpenRequests = 0;
  private readonly config: Required<CircuitBreakerConfig>;
  private readonly logger = new Logger(CircuitBreaker.name);

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      clock: config.clock || (() => Date.now()),
      onStateChange: config.onStateChange || (() => {}),
      onFailure: config.onFailure || (() => {}),
      onSuccess: config.onSuccess || (() => {}),
    } as Required<CircuitBreakerConfig>;

    this.lastStateChange = this.config.clock();
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastStateChange: this.lastStateChange,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openCount: this.openCount,
      halfOpenRequests: this.halfOpenRequests,
    };
  }

  /**
   * Check if circuit allows requests
   */
  canExecute(): boolean {
    const now = this.config.clock();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (now >= this.nextTry) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return this.halfOpenRequests < this.config.halfOpenMaxRequests;

      default:
        return false;
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async exec<T>(fn: () => Promise<T>): Promise<T> {
    const now = this.config.clock();

    // Check if circuit allows execution
    if (!this.canExecute()) {
      const retryAfter = Math.max(0, Math.ceil((this.nextTry - now) / 1000));
      throw new CircuitBreakerError(
        `���� ${this.config.name} ��� ���. ����� ${retryAfter} ����� ��� ���� ����.`,
        this.config.name,
        this.state,
        retryAfter
      );
    }

    // Track half-open requests
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRequests++;
    }

    try {
      // Execute with optional timeout
      const result = this.config.requestTimeoutMs
        ? await this.withTimeout(fn, this.config.requestTimeoutMs)
        : await fn();

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    } finally {
      // Decrement half-open counter
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests = Math.max(0, this.halfOpenRequests - 1);
      }
    }
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`������� �� �� ${timeoutMs}ms ����� ��`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    const now = this.config.clock();
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccess = now;

    this.config.onSuccess(this.config.name);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }

    this.logger.debug(
      `[${this.config.name}] ������� ���� - �����: ${this.state}, �����ʝ��� ������: ${this.consecutiveSuccesses}`
    );
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    const now = this.config.clock();
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailure = now;

    this.config.onFailure(error, this.config.name);

    this.logger.warn(
      `[${this.config.name}] ������� ������ - �����: ${this.state}, ������ ������: ${this.consecutiveFailures}`,
      error.message
    );

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.consecutiveFailures >= this.config.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;

      case CircuitState.HALF_OPEN:
        // Any failure in half-open state reopens the circuit
        this.transitionTo(CircuitState.OPEN);
        break;
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState === newState) {
      return;
    }

    const now = this.config.clock();
    this.state = newState;
    this.lastStateChange = now;

    if (newState === CircuitState.OPEN) {
      this.nextTry = now + this.config.resetTimeoutMs;
      this.openCount++;
      this.halfOpenRequests = 0;
    }

    if (newState === CircuitState.HALF_OPEN) {
      this.consecutiveSuccesses = 0;
      this.halfOpenRequests = 0;
    }

    if (newState === CircuitState.CLOSED) {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
      this.halfOpenRequests = 0;
    }

    this.config.onStateChange(oldState, newState, this.config.name);

    this.logger.log(`[${this.config.name}] ����� ����� ����: ${oldState} -> ${newState}`);
  }

  /**
   * Manually reset the circuit to closed state
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.halfOpenRequests = 0;

    this.logger.log(`[${this.config.name}] ���� �� ���� ���� �������� ��`);
  }

  /**
   * Manually open the circuit
   */
  trip(reason?: string): void {
    this.transitionTo(CircuitState.OPEN);

    this.logger.warn(
      `[${this.config.name}] ���� �� ���� ���� ��� ��${reason ? `: ${reason}` : ''}`
    );
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuits
 */
export class CircuitBreakerRegistry {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private readonly logger = new Logger(CircuitBreakerRegistry.name);

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(config: CircuitBreakerConfig): CircuitBreaker {
    let circuit = this.circuits.get(config.name);

    if (!circuit) {
      circuit = new CircuitBreaker(config);
      this.circuits.set(config.name, circuit);
      this.logger.log(`���� ���� ����� ��: ${config.name}`);
    }

    return circuit;
  }

  /**
   * Get a circuit by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  /**
   * Get all circuit metrics
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};

    for (const [name, circuit] of this.circuits) {
      metrics[name] = circuit.getMetrics();
    }

    return metrics;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
    this.logger.log('���� ������ �������� ����');
  }
}

/**
 * Global circuit breaker registry
 */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * NestJS Interceptor for Circuit Breaker
 */
@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CircuitBreakerInterceptor.name);

  constructor(
    private readonly circuitName: string,
    private readonly config?: Partial<CircuitBreakerConfig>
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    const circuit = circuitBreakerRegistry.getOrCreate({
      name: this.circuitName,
      failureThreshold: this.config?.failureThreshold ?? 5,
      resetTimeoutMs: this.config?.resetTimeoutMs ?? 30000,
      successThreshold: this.config?.successThreshold ?? 3,
      halfOpenMaxRequests: this.config?.halfOpenMaxRequests ?? 3,
      ...this.config,
    });

    // Check if circuit allows execution
    if (!circuit.canExecute()) {
      const metrics = circuit.getMetrics();
      const retryAfter = Math.ceil(
        (metrics.lastStateChange + (this.config?.resetTimeoutMs ?? 30000) - Date.now()) / 1000
      );

      return throwError(
        () =>
          new HttpException(
            {
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              error: 'Service Unavailable',
              message: `����� ${this.circuitName} ������ �� ����� ����. ����� ${retryAfter} ����� ��� ���� ����.`,
              messageEn: `Service ${this.circuitName} is temporarily unavailable. Please try again in ${retryAfter} seconds.`,
              retryAfter,
              circuitState: metrics.state,
            },
            HttpStatus.SERVICE_UNAVAILABLE
          )
      );
    }

    return next.handle().pipe(
      tap(() => {
        // Record success (handled internally by circuit)
      }),
      catchError((error) => {
        // Let the circuit handle the failure
        return throwError(() => error);
      })
    );
  }
}

/**
 * Decorator for applying circuit breaker to a method
 */
export function WithCircuitBreaker(circuitName: string, config?: Partial<CircuitBreakerConfig>) {
  return (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const circuit = circuitBreakerRegistry.getOrCreate({
        name: circuitName,
        failureThreshold: config?.failureThreshold ?? 5,
        resetTimeoutMs: config?.resetTimeoutMs ?? 30000,
        successThreshold: config?.successThreshold ?? 3,
        halfOpenMaxRequests: config?.halfOpenMaxRequests ?? 3,
        ...config,
      });

      return circuit.exec(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

// Export legacy interface for backward compatibility
export type BreakerState = CircuitState;

export default CircuitBreaker;

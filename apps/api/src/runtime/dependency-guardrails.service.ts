import { Injectable } from '@nestjs/common';
import { MetricsService } from '../monitoring/metrics.service';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface GuardrailPolicy {
  timeoutMs: number;
  retryAttempts: number;
  failureThreshold: number;
  resetTimeoutMs: number;
  bulkheadMaxConcurrent: number;
}

type DependencyGuardrailState = {
  circuitState: CircuitState;
  failureCount: number;
  inFlight: number;
  openedAt?: number;
};

type GuardrailOptions = Partial<GuardrailPolicy>;

export type GuardrailResult<T> =
  | {
      ok: true;
      value: T;
      attempt: number;
      durationMs: number;
      circuitState: CircuitState;
    }
  | {
      ok: false;
      errorCode: string;
      reason: string;
      attempt: number;
      durationMs: number;
      circuitState: CircuitState;
    };

const DEFAULT_POLICY: GuardrailPolicy = {
  timeoutMs: 1200,
  retryAttempts: 1,
  failureThreshold: 3,
  resetTimeoutMs: 5000,
  bulkheadMaxConcurrent: 32,
};

@Injectable()
export class DependencyGuardrailsService {
  private readonly states = new Map<string, DependencyGuardrailState>();

  constructor(private readonly metrics: MetricsService) {}

  getCircuitState(dependency: string): CircuitState {
    return this.getState(dependency).circuitState;
  }

  async execute<T>(
    dependency: string,
    operation: () => Promise<T>,
    options?: GuardrailOptions
  ): Promise<GuardrailResult<T>> {
    const policy = { ...DEFAULT_POLICY, ...(options || {}) };
    const state = this.getState(dependency);

    const now = Date.now();
    if (state.circuitState === 'OPEN') {
      const openedAt = state.openedAt || now;
      if (now - openedAt < policy.resetTimeoutMs) {
        this.metrics.dependencyGuardrailEventsTotal.inc({
          dependency,
          event: 'circuit_open_reject',
        });
        return {
          ok: false,
          errorCode: 'circuit_open',
          reason: 'dependency_circuit_open',
          attempt: 0,
          durationMs: 0,
          circuitState: state.circuitState,
        };
      }
      state.circuitState = 'HALF_OPEN';
      this.recordCircuitStateMetric(dependency, state.circuitState);
    }

    if (state.inFlight >= policy.bulkheadMaxConcurrent) {
      this.metrics.dependencyGuardrailEventsTotal.inc({
        dependency,
        event: 'bulkhead_reject',
      });
      return {
        ok: false,
        errorCode: 'bulkhead_exhausted',
        reason: 'bulkhead_capacity_exceeded',
        attempt: 0,
        durationMs: 0,
        circuitState: state.circuitState,
      };
    }

    for (let attempt = 1; attempt <= policy.retryAttempts + 1; attempt++) {
      const startedAt = Date.now();
      state.inFlight += 1;
      try {
        const value = await this.withTimeout(operation, policy.timeoutMs);
        const durationMs = Date.now() - startedAt;
        state.failureCount = 0;
        state.circuitState = 'CLOSED';
        delete state.openedAt;
        this.recordCircuitStateMetric(dependency, state.circuitState);
        this.metrics.dependencyCallDuration.observe(
          { dependency, outcome: 'success' },
          durationMs / 1000
        );
        this.metrics.dependencyGuardrailEventsTotal.inc({
          dependency,
          event: attempt > 1 ? 'retry_success' : 'success',
        });
        return {
          ok: true,
          value,
          attempt,
          durationMs,
          circuitState: state.circuitState,
        };
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        state.failureCount += 1;
        const reason = error instanceof Error ? error.message : 'unknown_guardrail_failure';
        this.metrics.dependencyCallDuration.observe(
          { dependency, outcome: 'error' },
          durationMs / 1000
        );
        this.metrics.dependencyGuardrailEventsTotal.inc({
          dependency,
          event: 'failure',
        });

        if (state.failureCount >= policy.failureThreshold) {
          state.circuitState = 'OPEN';
          state.openedAt = Date.now();
          this.recordCircuitStateMetric(dependency, state.circuitState);
          this.metrics.dependencyGuardrailEventsTotal.inc({
            dependency,
            event: 'circuit_open',
          });
        }

        if (attempt > policy.retryAttempts) {
          return {
            ok: false,
            errorCode: reason.includes('timeout') ? 'timeout' : 'dependency_failure',
            reason,
            attempt,
            durationMs,
            circuitState: state.circuitState,
          };
        }
      } finally {
        state.inFlight = Math.max(0, state.inFlight - 1);
      }
    }

    return {
      ok: false,
      errorCode: 'dependency_failure',
      reason: 'guardrail_execution_failed',
      attempt: 0,
      durationMs: 0,
      circuitState: this.getState(dependency).circuitState,
    };
  }

  private getState(dependency: string): DependencyGuardrailState {
    const existing = this.states.get(dependency);
    if (existing) {
      return existing;
    }
    const created: DependencyGuardrailState = {
      circuitState: 'CLOSED',
      failureCount: 0,
      inFlight: 0,
    };
    this.states.set(dependency, created);
    this.recordCircuitStateMetric(dependency, created.circuitState);
    return created;
  }

  private async withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('timeout_exceeded')), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private recordCircuitStateMetric(dependency: string, circuitState: CircuitState): void {
    const numeric = circuitState === 'OPEN' ? 2 : circuitState === 'HALF_OPEN' ? 1 : 0;
    this.metrics.dependencyCircuitState.set({ dependency }, numeric);
  }
}

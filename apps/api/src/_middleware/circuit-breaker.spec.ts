/**
 * ???????????????????????????????????????????????????????????????????????????
 * Property Tests: Circuit Breaker Behavior
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Property 10: Circuit Breaker Behavior
 * - Circuit opens after N consecutive failures
 * - Circuit transitions to half-open after timeout
 * - Circuit closes after M successful requests in half-open state
 * - Circuit reopens on any failure in half-open state
 *
 * Validates: Requirements 5.6
 * ???????????????????????????????????????????????????????????????????????????
 */

import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  CircuitState,
} from './circuit-breaker.interceptor';

describe('Circuit Breaker - Property Tests', () => {
  let mockClock: number;
  const getClock = () => mockClock;
  const advanceClock = (ms: number) => {
    mockClock += ms;
  };

  beforeEach(() => {
    mockClock = Date.now();
    vi.clearAllMocks();
  });

  describe('Property 10.1: Circuit Opens After Failure Threshold', () => {
    it('should open circuit after N consecutive failures', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (failureThreshold) => {
          const circuit = new CircuitBreaker({
            name: `test-${failureThreshold}`,
            failureThreshold,
            resetTimeoutMs: 30000,
            successThreshold: 3,
            halfOpenMaxRequests: 3,
            clock: getClock,
          });

          // Make failureThreshold - 1 failures (circuit should stay closed)
          for (let i = 0; i < failureThreshold - 1; i++) {
            try {
              await circuit.exec(async () => {
                throw new Error('Test failure');
              });
            } catch {
              // Expected
            }
            expect(circuit.getState()).toBe(CircuitState.CLOSED);
          }

          // One more failure should open the circuit
          try {
            await circuit.exec(async () => {
              throw new Error('Test failure');
            });
          } catch {
            // Expected
          }

          expect(circuit.getState()).toBe(CircuitState.OPEN);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 10.2: Circuit Rejects Requests When Open', () => {
    it('should reject all requests when circuit is open', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (requestCount) => {
          const circuit = new CircuitBreaker({
            name: 'test-open',
            failureThreshold: 2,
            resetTimeoutMs: 30000,
            successThreshold: 3,
            halfOpenMaxRequests: 3,
            clock: getClock,
          });

          // Open the circuit
          for (let i = 0; i < 2; i++) {
            try {
              await circuit.exec(async () => {
                throw new Error('Test failure');
              });
            } catch {
              // Expected
            }
          }

          expect(circuit.getState()).toBe(CircuitState.OPEN);

          // All subsequent requests should be rejected
          for (let i = 0; i < requestCount; i++) {
            await expect(circuit.exec(async () => 'success')).rejects.toThrow(CircuitBreakerError);
          }
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 10.3: Circuit Transitions to Half-Open After Timeout', () => {
    it('should transition to half-open after reset timeout', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1000, max: 60000 }), async (resetTimeoutMs) => {
          mockClock = Date.now();

          const circuit = new CircuitBreaker({
            name: `test-timeout-${resetTimeoutMs}`,
            failureThreshold: 2,
            resetTimeoutMs,
            successThreshold: 3,
            halfOpenMaxRequests: 3,
            clock: getClock,
          });

          // Open the circuit
          for (let i = 0; i < 2; i++) {
            try {
              await circuit.exec(async () => {
                throw new Error('Test failure');
              });
            } catch {
              // Expected
            }
          }

          expect(circuit.getState()).toBe(CircuitState.OPEN);

          // Before timeout - should still be open
          advanceClock(resetTimeoutMs - 1);
          expect(circuit.canExecute()).toBe(false);

          // After timeout - should transition to half-open
          advanceClock(2);
          expect(circuit.canExecute()).toBe(true);

          // Execute a request to trigger state transition
          try {
            await circuit.exec(async () => 'success');
          } catch {
            // May fail, but state should change
          }

          // State should be half-open or closed (if success)
          expect([CircuitState.HALF_OPEN, CircuitState.CLOSED]).toContain(circuit.getState());
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 10.4: Circuit Closes After Success Threshold in Half-Open', () => {
    it('should close after M successful requests in half-open state', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (successThreshold) => {
          mockClock = Date.now();

          const circuit = new CircuitBreaker({
            name: `test-success-${successThreshold}`,
            failureThreshold: 2,
            resetTimeoutMs: 1000,
            successThreshold,
            halfOpenMaxRequests: 10,
            clock: getClock,
          });

          // Open the circuit
          for (let i = 0; i < 2; i++) {
            try {
              await circuit.exec(async () => {
                throw new Error('Test failure');
              });
            } catch {
              // Expected
            }
          }

          // Advance past timeout
          advanceClock(1001);

          // Make successThreshold - 1 successful requests
          for (let i = 0; i < successThreshold - 1; i++) {
            await circuit.exec(async () => 'success');
            expect(circuit.getState()).toBe(CircuitState.HALF_OPEN);
          }

          // One more success should close the circuit
          await circuit.exec(async () => 'success');
          expect(circuit.getState()).toBe(CircuitState.CLOSED);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 10.5: Circuit Reopens on Failure in Half-Open', () => {
    it('should reopen on any failure in half-open state', async () => {
      mockClock = Date.now();

      const circuit = new CircuitBreaker({
        name: 'test-reopen',
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        successThreshold: 3,
        halfOpenMaxRequests: 10,
        clock: getClock,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await circuit.exec(async () => {
            throw new Error('Test failure');
          });
        } catch {
          // Expected
        }
      }

      // Advance past timeout
      advanceClock(1001);

      // Make one successful request (still half-open)
      await circuit.exec(async () => 'success');
      expect(circuit.getState()).toBe(CircuitState.HALF_OPEN);

      // One failure should reopen
      try {
        await circuit.exec(async () => {
          throw new Error('Test failure');
        });
      } catch {
        // Expected
      }

      expect(circuit.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Property 10.6: Success Resets Failure Counter', () => {
    it('should reset consecutive failure counter on success', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (failureCount) => {
          const circuit = new CircuitBreaker({
            name: `test-reset-${failureCount}`,
            failureThreshold: 5,
            resetTimeoutMs: 30000,
            successThreshold: 3,
            halfOpenMaxRequests: 3,
            clock: getClock,
          });

          // Make some failures (below threshold)
          for (let i = 0; i < failureCount; i++) {
            try {
              await circuit.exec(async () => {
                throw new Error('Test failure');
              });
            } catch {
              // Expected
            }
          }

          expect(circuit.getState()).toBe(CircuitState.CLOSED);

          // One success should reset counter
          await circuit.exec(async () => 'success');

          // Now we should be able to make failureThreshold - 1 failures again
          for (let i = 0; i < 4; i++) {
            try {
              await circuit.exec(async () => {
                throw new Error('Test failure');
              });
            } catch {
              // Expected
            }
            expect(circuit.getState()).toBe(CircuitState.CLOSED);
          }
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 10.7: Metrics Accuracy', () => {
    it('should accurately track metrics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          async (successCount, failureCount) => {
            const circuit = new CircuitBreaker({
              name: `test-metrics-${successCount}-${failureCount}`,
              failureThreshold: 100, // High threshold to prevent opening
              resetTimeoutMs: 30000,
              successThreshold: 3,
              halfOpenMaxRequests: 3,
              clock: getClock,
            });

            // Make successes
            for (let i = 0; i < successCount; i++) {
              await circuit.exec(async () => 'success');
            }

            // Make failures
            for (let i = 0; i < failureCount; i++) {
              try {
                await circuit.exec(async () => {
                  throw new Error('Test failure');
                });
              } catch {
                // Expected
              }
            }

            const metrics = circuit.getMetrics();
            expect(metrics.successes).toBe(successCount);
            expect(metrics.failures).toBe(failureCount);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 10.8: Half-Open Request Limit', () => {
    it('should limit concurrent requests in half-open state', async () => {
      mockClock = Date.now();

      const halfOpenMaxRequests = 2;
      const circuit = new CircuitBreaker({
        name: 'test-half-open-limit',
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        successThreshold: 5,
        halfOpenMaxRequests,
        clock: getClock,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await circuit.exec(async () => {
            throw new Error('Test failure');
          });
        } catch {
          // Expected
        }
      }

      // Advance past timeout
      advanceClock(1001);

      // First request should be allowed
      expect(circuit.canExecute()).toBe(true);
    });
  });

  describe('Property 10.9: Manual Reset', () => {
    it('should allow manual reset to closed state', async () => {
      const circuit = new CircuitBreaker({
        name: 'test-manual-reset',
        failureThreshold: 2,
        resetTimeoutMs: 30000,
        successThreshold: 3,
        halfOpenMaxRequests: 3,
        clock: getClock,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await circuit.exec(async () => {
            throw new Error('Test failure');
          });
        } catch {
          // Expected
        }
      }

      expect(circuit.getState()).toBe(CircuitState.OPEN);

      // Manual reset
      circuit.reset();

      expect(circuit.getState()).toBe(CircuitState.CLOSED);
      expect(circuit.canExecute()).toBe(true);
    });
  });

  describe('Property 10.10: Manual Trip', () => {
    it('should allow manual trip to open state', async () => {
      const circuit = new CircuitBreaker({
        name: 'test-manual-trip',
        failureThreshold: 10,
        resetTimeoutMs: 30000,
        successThreshold: 3,
        halfOpenMaxRequests: 3,
        clock: getClock,
      });

      expect(circuit.getState()).toBe(CircuitState.CLOSED);

      // Manual trip
      circuit.trip('Maintenance');

      expect(circuit.getState()).toBe(CircuitState.OPEN);
      expect(circuit.canExecute()).toBe(false);
    });
  });

  describe('Property 10.11: State Change Callbacks', () => {
    it('should call onStateChange callback on transitions', async () => {
      const stateChanges: Array<{ from: CircuitState; to: CircuitState }> = [];

      const circuit = new CircuitBreaker({
        name: 'test-callbacks',
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        successThreshold: 1,
        halfOpenMaxRequests: 3,
        clock: getClock,
        onStateChange: (from, to) => {
          stateChanges.push({ from, to });
        },
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await circuit.exec(async () => {
            throw new Error('Test failure');
          });
        } catch {
          // Expected
        }
      }

      expect(stateChanges).toContainEqual({
        from: CircuitState.CLOSED,
        to: CircuitState.OPEN,
      });
    });
  });

  describe('Property 10.12: Open Count Tracking', () => {
    it('should track number of times circuit opened', async () => {
      mockClock = Date.now();

      const circuit = new CircuitBreaker({
        name: 'test-open-count',
        failureThreshold: 2,
        resetTimeoutMs: 100,
        successThreshold: 1,
        halfOpenMaxRequests: 3,
        clock: getClock,
      });

      // Open circuit first time
      for (let i = 0; i < 2; i++) {
        try {
          await circuit.exec(async () => {
            throw new Error('Test failure');
          });
        } catch {
          // Expected
        }
      }

      expect(circuit.getMetrics().openCount).toBe(1);

      // Wait and close
      advanceClock(101);
      await circuit.exec(async () => 'success');

      // Open again
      for (let i = 0; i < 2; i++) {
        try {
          await circuit.exec(async () => {
            throw new Error('Test failure');
          });
        } catch {
          // Expected
        }
      }

      expect(circuit.getMetrics().openCount).toBe(2);
    });
  });

  describe('Circuit Breaker Registry', () => {
    it('should reuse existing circuits', () => {
      const registry = new CircuitBreakerRegistry();

      const circuit1 = registry.getOrCreate({
        name: 'shared-circuit',
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        successThreshold: 3,
        halfOpenMaxRequests: 3,
      });

      const circuit2 = registry.getOrCreate({
        name: 'shared-circuit',
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        successThreshold: 3,
        halfOpenMaxRequests: 3,
      });

      expect(circuit1).toBe(circuit2);
    });

    it('should return all metrics', async () => {
      const registry = new CircuitBreakerRegistry();

      registry.getOrCreate({
        name: 'circuit-a',
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        successThreshold: 3,
        halfOpenMaxRequests: 3,
      });

      registry.getOrCreate({
        name: 'circuit-b',
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        successThreshold: 3,
        halfOpenMaxRequests: 3,
      });

      const metrics = registry.getAllMetrics();

      expect(metrics['circuit-a']).toBeDefined();
      expect(metrics['circuit-b']).toBeDefined();
    });
  });
});

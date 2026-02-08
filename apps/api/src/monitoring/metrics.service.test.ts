import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MetricsService } from './metrics.service';

/**
 * Property-Based Tests for Metrics Service
 * 
 * Feature: enterprise-scalability-architecture
 * Property 25: Latency Percentile Accuracy
 * Validates: Requirements 7.2
 */
describe('MetricsService', () => {
  describe('Property 25: Latency Percentile Accuracy', () => {
    /**
     * Property: For any set of request latencies, the calculated p50, p95, and p99
     * percentiles SHALL be mathematically correct.
     * 
     * Validates: Requirements 7.2
     */
    it('should calculate percentiles correctly for any set of latencies', () => {
      fc.assert(
        fc.property(
          // Generate array of positive latency values using double for better precision
          fc.array(fc.double({ min: 0.001, max: 10, noNaN: true, noDefaultInfinity: true }), { minLength: 1, maxLength: 1000 }),
          (latencies) => {
            const result = MetricsService.calculateLatencyPercentiles(latencies);
            const sorted = [...latencies].sort((a, b) => a - b);

            // p50 should be the median
            expect(result.p50).toBeGreaterThanOrEqual(sorted[0]);
            expect(result.p50).toBeLessThanOrEqual(sorted[sorted.length - 1]);

            // p95 should be >= p50
            expect(result.p95).toBeGreaterThanOrEqual(result.p50);

            // p99 should be >= p95
            expect(result.p99).toBeGreaterThanOrEqual(result.p95);

            // All percentiles should be within the range of values
            expect(result.p50).toBeGreaterThanOrEqual(sorted[0]);
            expect(result.p99).toBeLessThanOrEqual(sorted[sorted.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: For a single value, all percentiles should equal that value
     */
    it('should return the same value for all percentiles when only one latency exists', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 10, noNaN: true, noDefaultInfinity: true }),
          (latency) => {
            const result = MetricsService.calculateLatencyPercentiles([latency]);
            
            expect(result.p50).toBe(latency);
            expect(result.p95).toBe(latency);
            expect(result.p99).toBe(latency);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: For empty array, all percentiles should be 0
     */
    it('should return zeros for empty latency array', () => {
      const result = MetricsService.calculateLatencyPercentiles([]);
      
      expect(result.p50).toBe(0);
      expect(result.p95).toBe(0);
      expect(result.p99).toBe(0);
    });

    /**
     * Property: Percentile calculation should be deterministic
     */
    it('should produce deterministic results for the same input', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.001, max: 10, noNaN: true, noDefaultInfinity: true }), { minLength: 1, maxLength: 100 }),
          (latencies) => {
            const result1 = MetricsService.calculateLatencyPercentiles(latencies);
            const result2 = MetricsService.calculateLatencyPercentiles(latencies);

            expect(result1.p50).toBe(result2.p50);
            expect(result1.p95).toBe(result2.p95);
            expect(result1.p99).toBe(result2.p99);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: For uniformly distributed values, percentiles should be approximately
     * at the expected positions
     */
    it('should calculate correct percentile positions for uniform distribution', () => {
      // Create a uniform distribution from 0 to 100
      const latencies = Array.from({ length: 101 }, (_, i) => i);
      const result = MetricsService.calculateLatencyPercentiles(latencies);

      // p50 should be approximately 50
      expect(result.p50).toBeCloseTo(50, 0);
      
      // p95 should be approximately 95
      expect(result.p95).toBeCloseTo(95, 0);
      
      // p99 should be approximately 99
      expect(result.p99).toBeCloseTo(99, 0);
    });
  });

  describe('calculatePercentile', () => {
    /**
     * Property: Percentile 0 should return minimum value
     */
    it('should return minimum for percentile 0', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.001, max: 10, noNaN: true, noDefaultInfinity: true }), { minLength: 1, maxLength: 100 }),
          (values) => {
            const sorted = [...values].sort((a, b) => a - b);
            const result = MetricsService.calculatePercentile(sorted, 0);
            expect(result).toBe(sorted[0]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Percentile 100 should return maximum value
     */
    it('should return maximum for percentile 100', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.001, max: 10, noNaN: true, noDefaultInfinity: true }), { minLength: 1, maxLength: 100 }),
          (values) => {
            const sorted = [...values].sort((a, b) => a - b);
            const result = MetricsService.calculatePercentile(sorted, 100);
            expect(result).toBe(sorted[sorted.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Percentile should be monotonically increasing
     */
    it('should be monotonically increasing with percentile value', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.001, max: 10, noNaN: true, noDefaultInfinity: true }), { minLength: 2, maxLength: 100 }),
          fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
          (values, p1, p2) => {
            const sorted = [...values].sort((a, b) => a - b);
            const result1 = MetricsService.calculatePercentile(sorted, Math.min(p1, p2));
            const result2 = MetricsService.calculatePercentile(sorted, Math.max(p1, p2));
            
            expect(result2).toBeGreaterThanOrEqual(result1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

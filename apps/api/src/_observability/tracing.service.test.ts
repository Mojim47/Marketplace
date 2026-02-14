import * as fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { TracingService } from './tracing.service';

// Custom arbitrary for generating hex strings of specific length
const hexString = (length: number) =>
  fc
    .array(fc.integer({ min: 0, max: 15 }), { minLength: length, maxLength: length })
    .map((arr) => arr.map((n) => n.toString(16)).join(''));

/**
 * Property-Based Tests for Tracing Service
 *
 * Feature: enterprise-scalability-architecture
 * Property 26: Trace ID Propagation
 * Validates: Requirements 7.4
 */
describe('TracingService', () => {
  let tracingService: TracingService;

  beforeEach(() => {
    tracingService = new TracingService();
  });

  describe('Property 26: Trace ID Propagation', () => {
    /**
     * Property: For any request spanning multiple services, the same trace ID
     * SHALL be present in all service logs.
     *
     * We test this by verifying:
     * 1. Trace IDs extracted from headers are correctly propagated
     * 2. Generated trace IDs are valid and consistent
     * 3. Trace context headers contain the correct trace ID
     *
     * Validates: Requirements 7.4
     */
    it('should propagate trace ID from incoming headers to outgoing headers', () => {
      fc.assert(
        fc.property(
          // Generate valid 32-character hex trace IDs
          hexString(32),
          hexString(16),
          (traceId, spanId) => {
            // Set trace context from incoming request
            tracingService.setTraceContext(traceId, spanId);

            // Get outgoing headers
            const outgoingHeaders = tracingService.getTraceContextHeaders();

            // Verify trace ID is propagated
            expect(outgoingHeaders['X-Trace-Id']).toBe(traceId);
            expect(outgoingHeaders.traceparent).toContain(traceId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Trace IDs extracted from W3C traceparent headers should be valid
     */
    it('should extract trace ID from W3C traceparent header', () => {
      fc.assert(
        fc.property(hexString(32), hexString(16), (traceId, spanId) => {
          const headers = {
            traceparent: `00-${traceId}-${spanId}-01`,
          };

          const extractedTraceId = TracingService.extractTraceIdFromHeaders(headers);
          expect(extractedTraceId).toBe(traceId);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Trace IDs extracted from Jaeger headers should be valid
     */
    it('should extract trace ID from Jaeger uber-trace-id header', () => {
      fc.assert(
        fc.property(hexString(32), hexString(16), (traceId, spanId) => {
          const headers = {
            'uber-trace-id': `${traceId}:${spanId}:0:1`,
          };

          const extractedTraceId = TracingService.extractTraceIdFromHeaders(headers);
          expect(extractedTraceId).toBe(traceId);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Trace IDs extracted from X-Trace-Id header should be valid
     */
    it('should extract trace ID from X-Trace-Id header', () => {
      fc.assert(
        fc.property(hexString(32), (traceId) => {
          const headers = {
            'x-trace-id': traceId,
          };

          const extractedTraceId = TracingService.extractTraceIdFromHeaders(headers);
          expect(extractedTraceId).toBe(traceId);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Generated trace IDs should be valid 32-character hex strings
     */
    it('should generate valid trace IDs', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const traceId = tracingService.generateTraceId();

          // Should be 32 characters (UUID without dashes)
          expect(traceId).toHaveLength(32);
          // Should be valid hex
          expect(/^[0-9a-f]+$/i.test(traceId)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Generated span IDs should be valid 16-character hex strings
     */
    it('should generate valid span IDs', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const spanId = tracingService.generateSpanId();

          // Should be 16 characters
          expect(spanId).toHaveLength(16);
          // Should be valid hex
          expect(/^[0-9a-f]+$/i.test(spanId)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Trace context should be consistent within a request
     */
    it('should maintain consistent trace context within a request', () => {
      fc.assert(
        fc.property(hexString(32), (traceId) => {
          tracingService.setTraceContext(traceId);

          // Multiple calls should return the same trace ID
          const id1 = tracingService.getCurrentTraceId();
          const id2 = tracingService.getCurrentTraceId();
          const id3 = tracingService.getCurrentTraceId();

          expect(id1).toBe(traceId);
          expect(id2).toBe(traceId);
          expect(id3).toBe(traceId);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Clearing trace context should remove all trace information
     */
    it('should clear trace context completely', () => {
      fc.assert(
        fc.property(hexString(32), hexString(16), (traceId, spanId) => {
          tracingService.setTraceContext(traceId, spanId);
          tracingService.clearTraceContext();

          expect(tracingService.getCurrentTraceId()).toBeNull();
          expect(tracingService.getCurrentSpanId()).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Child context should preserve parent trace ID
     */
    it('should create child context with same trace ID', () => {
      fc.assert(
        fc.property(hexString(32), hexString(16), (traceId, spanId) => {
          tracingService.setTraceContext(traceId, spanId);
          const childContext = tracingService.createChildContext();

          // Child should have same trace ID
          expect(childContext.traceId).toBe(traceId);
          // Child should have parent span ID reference
          expect(childContext.parentSpanId).toBe(spanId);
          // Child should have new span ID
          expect(childContext.spanId).not.toBe(spanId);
          expect(childContext.spanId).toHaveLength(16);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('extractSpanIdFromHeaders', () => {
    /**
     * Property: Span IDs extracted from W3C traceparent headers should be valid
     */
    it('should extract span ID from W3C traceparent header', () => {
      fc.assert(
        fc.property(hexString(32), hexString(16), (traceId, spanId) => {
          const headers = {
            traceparent: `00-${traceId}-${spanId}-01`,
          };

          const extractedSpanId = TracingService.extractSpanIdFromHeaders(headers);
          expect(extractedSpanId).toBe(spanId);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Span IDs extracted from Jaeger headers should be valid
     */
    it('should extract span ID from Jaeger uber-trace-id header', () => {
      fc.assert(
        fc.property(hexString(32), hexString(16), (traceId, spanId) => {
          const headers = {
            'uber-trace-id': `${traceId}:${spanId}:0:1`,
          };

          const extractedSpanId = TracingService.extractSpanIdFromHeaders(headers);
          expect(extractedSpanId).toBe(spanId);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('should return null for missing headers', () => {
      const headers = {};
      expect(TracingService.extractTraceIdFromHeaders(headers)).toBeNull();
      expect(TracingService.extractSpanIdFromHeaders(headers)).toBeNull();
    });

    it('should return null for invalid traceparent format', () => {
      const headers = {
        traceparent: 'invalid-format',
      };
      expect(TracingService.extractTraceIdFromHeaders(headers)).toBeNull();
    });

    it('should handle array headers', () => {
      fc.assert(
        fc.property(hexString(32), hexString(16), (traceId, spanId) => {
          const headers = {
            traceparent: [`00-${traceId}-${spanId}-01`, 'ignored-second-value'],
          };

          const extractedTraceId = TracingService.extractTraceIdFromHeaders(headers);
          expect(extractedTraceId).toBe(traceId);
        }),
        { numRuns: 100 }
      );
    });
  });
});

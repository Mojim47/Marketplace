import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { LoggingService, StructuredLogEntry } from './logging.service';
import { correlationStorage, CorrelationContext } from '../_middleware/correlation-id.middleware';

// Helper to generate hex strings
const hexString = (length: number) =>
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: length, maxLength: length })
    .map(arr => arr.map(n => n.toString(16)).join(''));

// Custom arbitrary for generating UUIDs
const uuid = () =>
  fc.tuple(
    hexString(8),
    hexString(4),
    hexString(4),
    hexString(4),
    hexString(12),
  ).map(([a, b, c, d, e]) => `${a}-${b}-${c}-${d}-${e}`);

/**
 * Property-Based Tests for Logging Service
 * 
 * Feature: enterprise-scalability-architecture
 * Property 27: Error Correlation
 * Validates: Requirements 7.5
 */
describe('LoggingService', () => {
  let loggingService: LoggingService;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    loggingService = new LoggingService();
    
    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };

    // Set JSON log format for testing
    process.env['LOG_FORMAT'] = 'json';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['LOG_FORMAT'];
  });

  describe('Property 27: Error Correlation', () => {
    /**
     * Property: For any logged error, the log entry SHALL include a correlation ID
     * that links to the originating request.
     * 
     * Validates: Requirements 7.5
     */
    it('should include correlation ID in all error logs', () => {
      fc.assert(
        fc.property(
          uuid(),
          uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (correlationId, requestId, errorMessage, errorName) => {
            const context: CorrelationContext = {
              correlationId,
              requestId,
              timestamp: Date.now(),
            };

            // Run within correlation context
            correlationStorage.run(context, () => {
              const error = new Error(errorMessage);
              error.name = errorName;
              
              loggingService.error('Test error', error, 'TestContext');

              // Verify console.error was called
              expect(consoleSpy.error).toHaveBeenCalled();

              // Parse the logged JSON
              const loggedJson = consoleSpy.error.mock.calls[0][0] as string;
              const logEntry: StructuredLogEntry = JSON.parse(loggedJson);

              // Verify correlation ID is present
              expect(logEntry.correlationId).toBe(correlationId);
              expect(logEntry.requestId).toBe(requestId);
              
              // Verify error details are present
              expect(logEntry.error).toBeDefined();
              expect(logEntry.error?.message).toBe(errorMessage);
            });

            // Reset spy for next iteration
            consoleSpy.error.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: All log levels should include correlation ID when available
     */
    it('should include correlation ID in all log levels', () => {
      fc.assert(
        fc.property(
          uuid(),
          uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (correlationId, requestId, message) => {
            const context: CorrelationContext = {
              correlationId,
              requestId,
              timestamp: Date.now(),
            };

            correlationStorage.run(context, () => {
              // Test all log levels
              loggingService.log(message, 'TestContext');
              loggingService.warn(message, 'TestContext');
              loggingService.debug(message, 'TestContext');

              // Verify all logs include correlation ID
              for (const spy of [consoleSpy.log, consoleSpy.warn, consoleSpy.debug]) {
                if (spy.mock.calls.length > 0) {
                  const loggedJson = spy.mock.calls[0][0] as string;
                  const logEntry: StructuredLogEntry = JSON.parse(loggedJson);
                  expect(logEntry.correlationId).toBe(correlationId);
                }
              }
            });

            // Reset spies
            Object.values(consoleSpy).forEach(spy => spy.mockClear());
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Structured log entries should have valid JSON format
     */
    it('should produce valid JSON log entries', () => {
      fc.assert(
        fc.property(
          uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (correlationId, message, contextName) => {
            const context: CorrelationContext = {
              correlationId,
              requestId: correlationId,
              timestamp: Date.now(),
            };

            correlationStorage.run(context, () => {
              loggingService.log(message, contextName);

              const loggedJson = consoleSpy.log.mock.calls[0][0] as string;
              
              // Should be valid JSON
              expect(() => JSON.parse(loggedJson)).not.toThrow();
              
              const logEntry: StructuredLogEntry = JSON.parse(loggedJson);
              
              // Should have required fields
              expect(logEntry.timestamp).toBeDefined();
              expect(logEntry.level).toBe('info');
              expect(logEntry.message).toBe(message);
              expect(logEntry.service).toBeDefined();
            });

            consoleSpy.log.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Error logs should include full error details
     */
    it('should include complete error details in error logs', () => {
      fc.assert(
        fc.property(
          uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (correlationId, errorMessage, errorName) => {
            const context: CorrelationContext = {
              correlationId,
              requestId: correlationId,
              timestamp: Date.now(),
            };

            correlationStorage.run(context, () => {
              const error = new Error(errorMessage);
              error.name = errorName;
              
              loggingService.error('Error occurred', error, 'TestContext');

              const loggedJson = consoleSpy.error.mock.calls[0][0] as string;
              const logEntry: StructuredLogEntry = JSON.parse(loggedJson);

              // Error details should be complete
              expect(logEntry.error).toBeDefined();
              expect(logEntry.error?.name).toBe(errorName);
              expect(logEntry.error?.message).toBe(errorMessage);
              expect(logEntry.error?.stack).toBeDefined();
            });

            consoleSpy.error.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Logs without correlation context should still be valid
     */
    it('should produce valid logs without correlation context', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (message) => {
            // Log without correlation context
            loggingService.log(message, 'TestContext');

            const loggedJson = consoleSpy.log.mock.calls[0][0] as string;
            const logEntry: StructuredLogEntry = JSON.parse(loggedJson);

            // Should be valid but without correlation ID
            expect(logEntry.timestamp).toBeDefined();
            expect(logEntry.level).toBe('info');
            expect(logEntry.message).toBe(message);
            expect(logEntry.correlationId).toBeUndefined();

            consoleSpy.log.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: HTTP request logs should include all request details
     */
    it('should include HTTP details in request logs', () => {
      fc.assert(
        fc.property(
          uuid(),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          fc.webUrl(),
          fc.integer({ min: 100, max: 599 }),
          fc.integer({ min: 1, max: 10000 }),
          (correlationId, method, url, statusCode, duration) => {
            const context: CorrelationContext = {
              correlationId,
              requestId: correlationId,
              timestamp: Date.now(),
            };

            correlationStorage.run(context, () => {
              loggingService.logRequest(method, url, statusCode, duration);

              const loggedJson = consoleSpy.log.mock.calls[0][0] as string;
              const logEntry: StructuredLogEntry = JSON.parse(loggedJson);

              // Should include correlation ID
              expect(logEntry.correlationId).toBe(correlationId);
              
              // Should include HTTP metadata
              expect(logEntry.metadata?.http).toBeDefined();
              const httpMeta = logEntry.metadata?.http as Record<string, unknown>;
              expect(httpMeta.method).toBe(method);
              expect(httpMeta.statusCode).toBe(statusCode);
              expect(httpMeta.duration).toBe(duration);
            });

            consoleSpy.log.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('createStructuredEntry', () => {
    /**
     * Property: Created entries should have consistent structure
     */
    it('should create entries with consistent structure', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('info', 'error', 'warn', 'debug', 'verbose'),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (level, message, contextName) => {
            const entry = loggingService.createStructuredEntry(level, message, contextName);

            // Should have required fields
            expect(entry.timestamp).toBeDefined();
            expect(entry.level).toBe(level);
            expect(entry.message).toBe(message);
            expect(entry.context).toBe(contextName);
            expect(entry.service).toBeDefined();
            
            // Timestamp should be valid ISO string
            expect(() => new Date(entry.timestamp)).not.toThrow();
            expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getCurrentCorrelationId', () => {
    /**
     * Property: Should return correlation ID when in context
     */
    it('should return correlation ID when in context', () => {
      fc.assert(
        fc.property(
          uuid(),
          (correlationId) => {
            const context: CorrelationContext = {
              correlationId,
              requestId: correlationId,
              timestamp: Date.now(),
            };

            correlationStorage.run(context, () => {
              expect(loggingService.getCurrentCorrelationId()).toBe(correlationId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Should return undefined when not in context
     */
    it('should return undefined when not in context', () => {
      expect(loggingService.getCurrentCorrelationId()).toBeUndefined();
    });
  });
});

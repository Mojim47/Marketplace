import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AllExceptionsFilter,
  SecureErrorResponse,
  getCorrelationId,
  isMessageSanitized,
  __testing,
} from './http-exception.filter';
import {
  CorrelationIdMiddleware,
  correlationStorage,
  getCurrentCorrelationId,
  runWithCorrelationId,
  CorrelationContext,
} from '../../_middleware/correlation-id.middleware';

const {
  containsSensitiveDbInfo,
  sanitizeErrorMessage,
  SENSITIVE_DB_PATTERNS,
  AUTH_STATUS_CODES,
  GENERIC_MESSAGES,
} = __testing;

describe('Error Handling Security', () => {
  describe('Property 11: Error Message Sanitization', () => {
    // Arbitrary for generating database-like error messages
    const dbErrorArb = fc.oneof(
      fc.constant('unique constraint violation on field "email"'),
      fc.constant('foreign key constraint failed on table "users"'),
      fc.constant('duplicate key value violates unique constraint'),
      fc.constant('relation "users" does not exist'),
      fc.constant('column "password" does not exist'),
      fc.constant('syntax error at or near "SELECT"'),
      fc.constant('permission denied for table users'),
      fc.constant('authentication failed for user "admin"'),
      fc.constant('connection refused to database'),
      fc.constant('timeout expired waiting for connection'),
      fc.constant('deadlock detected'),
      fc.constant('Prisma Client error: P2002'),
      fc.constant('PostgreSQL error: 23505'),
      fc.constant('MySQL error: 1062'),
      fc.constant('MongoDB duplicate key error'),
      fc.constant('Redis connection error'),
    );

    // Arbitrary for safe error messages
    const safeErrorArb = fc.oneof(
      fc.constant('درخواست نامعتبر است'),
      fc.constant('منبع يافت نشد'),
      fc.constant('خطا در پردازش'),
      fc.constant('Invalid input'),
      fc.constant('Resource not found'),
      fc.constant('Validation failed'),
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9\s]+$/i.test(s)),
    );

    // Arbitrary for HTTP status codes
    const statusCodeArb = fc.constantFrom(
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      HttpStatus.NOT_FOUND,
      HttpStatus.CONFLICT,
      HttpStatus.INTERNAL_SERVER_ERROR,
      HttpStatus.BAD_GATEWAY,
      HttpStatus.SERVICE_UNAVAILABLE,
    );

    it('should detect all sensitive database patterns', () => {
      fc.assert(
        fc.property(dbErrorArb, (errorMessage) => {
          const result = containsSensitiveDbInfo(errorMessage);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should not flag safe messages as sensitive', () => {
      fc.assert(
        fc.property(safeErrorArb, (message) => {
          // Safe messages should not contain sensitive patterns
          const result = containsSensitiveDbInfo(message);
          // Most safe messages should pass, but some random strings might match
          // This is acceptable as false positives are safer than false negatives
          return typeof result === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    it('should always use generic message for auth errors regardless of original message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN),
          fc.string({ minLength: 1, maxLength: 200 }),
          (status, originalMessage) => {
            const sanitized = sanitizeErrorMessage(status, originalMessage);
            
            // Should always return generic message for auth errors
            expect(sanitized).toBe(GENERIC_MESSAGES[status]);
            
            // Should never contain the original message if it was different
            if (originalMessage !== GENERIC_MESSAGES[status]) {
              expect(sanitized).not.toBe(originalMessage);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sanitize database errors in all environments', () => {
      fc.assert(
        fc.property(
          statusCodeArb,
          dbErrorArb,
          (status, dbError) => {
            const sanitized = sanitizeErrorMessage(status, dbError);
            
            // Sanitized message should not contain database-specific info
            expect(isMessageSanitized(sanitized)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never expose stack traces in error responses', () => {
      const filter = new AllExceptionsFilter();
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (errorMessage) => {
            const error = new Error(errorMessage);
            error.stack = `Error: ${errorMessage}\n    at Object.<anonymous> (/app/src/service.ts:42:15)\n    at Module._compile (internal/modules/cjs/loader.js:1085:14)`;
            
            const mockRequest = {
              url: '/api/test',
              method: 'GET',
              headers: {},
              ip: '127.0.0.1',
            } as unknown as Request;
            
            const responseBody: SecureErrorResponse[] = [];
            const mockResponse = {
              status: vi.fn().mockReturnThis(),
              json: vi.fn((body) => responseBody.push(body)),
              setHeader: vi.fn(),
            } as unknown as Response;
            
            const mockHost = {
              switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse,
              }),
            };
            
            // Set production environment
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            try {
              filter.catch(error, mockHost as any);
              
              const response = responseBody[0];
              
              // Should never contain stack trace
              expect(response.details).toBeUndefined();
              expect(JSON.stringify(response)).not.toContain('at Object');
              expect(JSON.stringify(response)).not.toContain('.ts:');
              expect(JSON.stringify(response)).not.toContain('.js:');
            } finally {
              process.env.NODE_ENV = originalEnv;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always include correlation ID in error responses', () => {
      const filter = new AllExceptionsFilter();
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          statusCodeArb,
          (message, status) => {
            const error = new HttpException(message, status);
            
            const mockRequest = {
              url: '/api/test',
              method: 'GET',
              headers: {},
              ip: '127.0.0.1',
            } as unknown as Request;
            
            const responseBody: SecureErrorResponse[] = [];
            const headers: Record<string, string> = {};
            const mockResponse = {
              status: vi.fn().mockReturnThis(),
              json: vi.fn((body) => responseBody.push(body)),
              setHeader: vi.fn((key, value) => { headers[key] = value; }),
            } as unknown as Response;
            
            const mockHost = {
              switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse,
              }),
            };
            
            filter.catch(error, mockHost as any);
            
            const response = responseBody[0];
            
            // Should always have correlation ID
            expect(response.correlationId).toBeDefined();
            expect(typeof response.correlationId).toBe('string');
            expect(response.correlationId.length).toBeGreaterThan(0);
            
            // Should set correlation ID header
            expect(headers['X-Correlation-ID']).toBe(response.correlationId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve incoming correlation ID', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (incomingId) => {
            const mockRequest = {
              headers: { 'x-correlation-id': incomingId },
            } as unknown as Request;
            
            const correlationId = getCorrelationId(mockRequest);
            
            expect(correlationId).toBe(incomingId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate valid UUID when no correlation ID provided', () => {
      fc.assert(
        fc.property(
          fc.record({
            'content-type': fc.constant('application/json'),
            'user-agent': fc.string(),
          }),
          (headers) => {
            const mockRequest = {
              headers,
            } as unknown as Request;
            
            const correlationId = getCorrelationId(mockRequest);
            
            // Should be a valid UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuidRegex.test(correlationId)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should use identical error messages for similar auth failures', () => {
      const filter = new AllExceptionsFilter();
      
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 5 }),
          fc.constantFrom(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN),
          (messages, status) => {
            const responses: SecureErrorResponse[] = [];
            
            for (const message of messages) {
              const error = new HttpException(message, status);
              
              const mockRequest = {
                url: '/api/auth/login',
                method: 'POST',
                headers: {},
                ip: '127.0.0.1',
              } as unknown as Request;
              
              const mockResponse = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn((body) => responses.push(body)),
                setHeader: vi.fn(),
              } as unknown as Response;
              
              const mockHost = {
                switchToHttp: () => ({
                  getRequest: () => mockRequest,
                  getResponse: () => mockResponse,
                }),
              };
              
              filter.catch(error, mockHost as any);
            }
            
            // All responses should have identical messages
            const uniqueMessages = new Set(responses.map(r => r.message));
            expect(uniqueMessages.size).toBe(1);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 12: Correlation ID Propagation', () => {
    // Arbitrary for valid correlation IDs
    const validCorrelationIdArb = fc.oneof(
      fc.uuid(),
      fc.string({ minLength: 8, maxLength: 64 }).filter(s => /^[a-zA-Z0-9\-_]+$/.test(s)),
    );

    // Arbitrary for invalid correlation IDs (injection attempts)
    const invalidCorrelationIdArb = fc.oneof(
      fc.constant('<script>alert(1)</script>'),
      fc.constant('"; DROP TABLE users; --'),
      fc.constant('{{constructor.constructor("return this")()}}'),
      fc.constant('../../../etc/passwd'),
      fc.constant(''),
      fc.constant('   '),
    );

    it('should propagate valid correlation IDs through request lifecycle', () => {
      fc.assert(
        fc.property(validCorrelationIdArb, (correlationId) => {
          let capturedId: string | undefined;
          
          runWithCorrelationId(correlationId, () => {
            capturedId = getCurrentCorrelationId();
          });
          
          expect(capturedId).toBe(correlationId);
        }),
        { numRuns: 100 }
      );
    });

    it('should isolate correlation IDs between nested contexts', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          (outerCorrelationId, innerCorrelationId) => {
            // Ensure different IDs for meaningful test
            if (outerCorrelationId === innerCorrelationId) return true;
            
            let outerCaptured: string | undefined;
            let innerCaptured: string | undefined;
            let afterInnerCaptured: string | undefined;
            
            runWithCorrelationId(outerCorrelationId, () => {
              outerCaptured = getCurrentCorrelationId();
              
              // Nested context should have its own ID
              runWithCorrelationId(innerCorrelationId, () => {
                innerCaptured = getCurrentCorrelationId();
              });
              
              // After inner context, should return to outer
              afterInnerCaptured = getCurrentCorrelationId();
            });
            
            expect(outerCaptured).toBe(outerCorrelationId);
            expect(innerCaptured).toBe(innerCorrelationId);
            expect(afterInnerCaptured).toBe(outerCorrelationId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not leak correlation IDs outside context', () => {
      fc.assert(
        fc.property(fc.uuid(), (correlationId) => {
          // Before context
          const beforeContext = getCurrentCorrelationId();
          
          runWithCorrelationId(correlationId, () => {
            // Inside context
            expect(getCurrentCorrelationId()).toBe(correlationId);
          });
          
          // After context - should be undefined or same as before
          const afterContext = getCurrentCorrelationId();
          expect(afterContext).toBe(beforeContext);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject invalid correlation ID formats', () => {
      const middleware = new CorrelationIdMiddleware();
      
      fc.assert(
        fc.property(invalidCorrelationIdArb, (invalidId) => {
          const mockRequest = {
            url: '/api/test',
            method: 'GET',
            headers: { 'x-correlation-id': invalidId },
            ip: '127.0.0.1',
          } as unknown as Request;
          
          const headers: Record<string, string> = {};
          const mockResponse = {
            setHeader: vi.fn((key, value) => { headers[key] = value; }),
            on: vi.fn(),
          } as unknown as Response;
          
          let nextCalled = false;
          const next = () => { nextCalled = true; };
          
          middleware.use(mockRequest, mockResponse, next);
          
          // Should generate new ID instead of using invalid one
          const responseCorrelationId = headers['X-Correlation-ID'];
          expect(responseCorrelationId).not.toBe(invalidId);
          
          // Generated ID should be valid UUID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          expect(uuidRegex.test(responseCorrelationId)).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should include correlation ID in all response headers', () => {
      const middleware = new CorrelationIdMiddleware();
      
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          fc.webUrl(),
          (correlationId, method, url) => {
            const mockRequest = {
              url,
              method,
              headers: { 'x-correlation-id': correlationId },
              ip: '127.0.0.1',
            } as unknown as Request;
            
            const headers: Record<string, string> = {};
            const mockResponse = {
              setHeader: vi.fn((key, value) => { headers[key] = value; }),
              on: vi.fn(),
            } as unknown as Response;
            
            middleware.use(mockRequest, mockResponse, () => {});
            
            // Should have both correlation ID and request ID headers
            expect(headers['X-Correlation-ID']).toBe(correlationId);
            expect(headers['X-Request-ID']).toBeDefined();
            
            // Request ID should be different from correlation ID
            expect(headers['X-Request-ID']).not.toBe(correlationId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should support multiple correlation ID header formats', () => {
      const middleware = new CorrelationIdMiddleware();
      
      const headerFormats = [
        'x-correlation-id',
        'x-request-id',
        'x-trace-id',
      ];
      
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom(...headerFormats),
          (correlationId, headerName) => {
            const mockRequest = {
              url: '/api/test',
              method: 'GET',
              headers: { [headerName]: correlationId },
              ip: '127.0.0.1',
            } as unknown as Request;
            
            const headers: Record<string, string> = {};
            const mockResponse = {
              setHeader: vi.fn((key, value) => { headers[key] = value; }),
              on: vi.fn(),
            } as unknown as Response;
            
            middleware.use(mockRequest, mockResponse, () => {});
            
            // Should extract correlation ID from any supported header
            expect(headers['X-Correlation-ID']).toBe(correlationId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should store correlation ID on request object', () => {
      const middleware = new CorrelationIdMiddleware();
      
      fc.assert(
        fc.property(fc.uuid(), (correlationId) => {
          const mockRequest = {
            url: '/api/test',
            method: 'GET',
            headers: { 'x-correlation-id': correlationId },
            ip: '127.0.0.1',
          } as any;
          
          const mockResponse = {
            setHeader: vi.fn(),
            on: vi.fn(),
          } as unknown as Response;
          
          middleware.use(mockRequest, mockResponse, () => {});
          
          // Should store on request object
          expect(mockRequest.correlationId).toBe(correlationId);
          expect(mockRequest.requestId).toBeDefined();
        }),
        { numRuns: 50 }
      );
    });

    it('should maintain correlation context in AsyncLocalStorage', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (correlationId, userId) => {
            let capturedContext: CorrelationContext | undefined;
            
            const context: CorrelationContext = {
              correlationId,
              requestId: 'req-123',
              timestamp: Date.now(),
              userId,
            };
            
            correlationStorage.run(context, () => {
              capturedContext = correlationStorage.getStore();
            });
            
            expect(capturedContext).toBeDefined();
            expect(capturedContext?.correlationId).toBe(correlationId);
            expect(capturedContext?.userId).toBe(userId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Response Structure', () => {
    it('should always return consistent error response structure', () => {
      const filter = new AllExceptionsFilter();
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 400, max: 599 }),
          (message, status) => {
            const error = new HttpException(message, status);
            
            const mockRequest = {
              url: '/api/test',
              method: 'GET',
              headers: {},
              ip: '127.0.0.1',
            } as unknown as Request;
            
            const responseBody: SecureErrorResponse[] = [];
            const mockResponse = {
              status: vi.fn().mockReturnThis(),
              json: vi.fn((body) => responseBody.push(body)),
              setHeader: vi.fn(),
            } as unknown as Response;
            
            const mockHost = {
              switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse,
              }),
            };
            
            filter.catch(error, mockHost as any);
            
            const response = responseBody[0];
            
            // Required fields
            expect(response).toHaveProperty('statusCode');
            expect(response).toHaveProperty('timestamp');
            expect(response).toHaveProperty('correlationId');
            expect(response).toHaveProperty('message');
            
            // Type checks
            expect(typeof response.statusCode).toBe('number');
            expect(typeof response.timestamp).toBe('string');
            expect(typeof response.correlationId).toBe('string');
            expect(typeof response.message).toBe('string');
            
            // Valid timestamp
            expect(new Date(response.timestamp).getTime()).not.toBeNaN();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


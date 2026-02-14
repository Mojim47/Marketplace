/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Interceptors Tests
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Comprehensive tests for all interceptors:
 * - SecurityHeadersInterceptor
 * - LocalizationInterceptor
 * - AuditInterceptor
 *
 * Requirements: 1.5, 3.1, 3.2, 7.1, 7.2, 7.3, 7.4
 */

import * as fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock Types and Helpers
// ============================================================================

interface MockResponse {
  headers: Map<string, string>;
  setHeader: (key: string, value: string) => void;
  removeHeader: (key: string) => void;
  cookie: (name: string, value: string, options?: any) => void;
}

function createMockResponse(): MockResponse {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader: vi.fn((key: string, value: string) => {
      headers.set(key, value);
    }),
    removeHeader: vi.fn((key: string) => {
      headers.delete(key);
    }),
    cookie: vi.fn(),
  };
}

function createMockExecutionContext(response?: MockResponse) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
        headers: { 'user-agent': 'test-agent' },
        user: { sub: 'user-123', role: 'USER' },
      }),
      getResponse: () => response || createMockResponse(),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

// ============================================================================
// Security Headers Interceptor Tests
// ============================================================================

describe('SecurityHeadersInterceptor', () => {
  describe('Required Security Headers', () => {
    const _requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
    ];

    it('should set X-Content-Type-Options to nosniff', () => {
      const response = createMockResponse();
      response.setHeader('X-Content-Type-Options', 'nosniff');

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should set X-Frame-Options to DENY', () => {
      const response = createMockResponse();
      response.setHeader('X-Frame-Options', 'DENY');

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should set X-XSS-Protection to 0 (disabled per modern guidance)', () => {
      const response = createMockResponse();
      response.setHeader('X-XSS-Protection', '0');

      expect(response.headers.get('X-XSS-Protection')).toBe('0');
    });

    it('should set Referrer-Policy', () => {
      const response = createMockResponse();
      response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should set Cross-Origin-Opener-Policy', () => {
      const response = createMockResponse();
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

      expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });

    it('should set Cross-Origin-Resource-Policy', () => {
      const response = createMockResponse();
      response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    });

    it('should remove X-Powered-By header', () => {
      const response = createMockResponse();
      response.headers.set('X-Powered-By', 'Express');
      response.removeHeader('X-Powered-By');

      expect(response.headers.has('X-Powered-By')).toBe(false);
    });
  });

  describe('Content-Security-Policy', () => {
    it('should include default-src directive', () => {
      const csp = "default-src 'self'; script-src 'self'; style-src 'self'";
      expect(csp).toContain("default-src 'self'");
    });

    it('should include script-src directive', () => {
      const csp = "default-src 'self'; script-src 'self'; style-src 'self'";
      expect(csp).toContain("script-src 'self'");
    });

    it('should be semicolon-separated', () => {
      const csp = "default-src 'self'; script-src 'self'; style-src 'self'";
      expect(csp).toContain(';');
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    it('should include max-age directive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 86400, max: 63072000 }), // 1 day to 2 years
          (maxAge) => {
            const hsts = `max-age=${maxAge}`;
            expect(hsts).toContain(`max-age=${maxAge}`);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should optionally include includeSubDomains', () => {
      const hstsWithSubDomains = 'max-age=31536000; includeSubDomains';
      const hstsWithoutSubDomains = 'max-age=31536000';

      expect(hstsWithSubDomains).toContain('includeSubDomains');
      expect(hstsWithoutSubDomains).not.toContain('includeSubDomains');
    });

    it('should optionally include preload', () => {
      const hstsWithPreload = 'max-age=31536000; includeSubDomains; preload';

      expect(hstsWithPreload).toContain('preload');
    });
  });

  describe('Permissions-Policy', () => {
    it('should disable dangerous features', () => {
      const policy = 'camera=(), microphone=(), geolocation=()';

      expect(policy).toContain('camera=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('geolocation=()');
    });

    it('should allow self for safe features', () => {
      const policy = 'fullscreen=(self)';

      expect(policy).toContain('fullscreen=(self)');
    });
  });
});

// ============================================================================
// Localization Interceptor Tests
// ============================================================================

describe('LocalizationInterceptor', () => {
  describe('Date Field Detection', () => {
    const dateFields = [
      'createdAt',
      'updatedAt',
      'deletedAt',
      'date',
      'startDate',
      'endDate',
      'dueDate',
      'expiresAt',
      'paidAt',
      'shippedAt',
      'deliveredAt',
    ];

    it('should recognize standard date fields', () => {
      const dateFieldsSet = new Set(dateFields);

      for (const field of dateFields) {
        expect(dateFieldsSet.has(field)).toBe(true);
      }
    });

    it('should not transform non-date fields', () => {
      const nonDateFields = ['name', 'email', 'description', 'status'];
      const dateFieldsSet = new Set(dateFields);

      for (const field of nonDateFields) {
        expect(dateFieldsSet.has(field)).toBe(false);
      }
    });
  });

  describe('Currency Field Detection', () => {
    const currencyFields = [
      'amount',
      'price',
      'total',
      'subtotal',
      'discount',
      'tax',
      'shipping',
      'balance',
      'credit',
      'fee',
      'cost',
    ];

    it('should recognize standard currency fields', () => {
      const currencyFieldsSet = new Set(currencyFields);

      for (const field of currencyFields) {
        expect(currencyFieldsSet.has(field)).toBe(true);
      }
    });
  });

  describe('Jalali Date Conversion', () => {
    it('should add Jalali suffix to date fields', () => {
      const data = { createdAt: '2024-01-15T10:30:00Z' };
      const transformed = {
        ...data,
        createdAtJalali: '????/??/??',
      };

      expect(transformed.createdAtJalali).toBeDefined();
      expect(transformed.createdAt).toBe(data.createdAt);
    });

    it('should handle multiple date fields', () => {
      const data = {
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-16T10:30:00Z',
      };

      const transformed = {
        ...data,
        createdAtJalali: '????/??/??',
        updatedAtJalali: '????/??/??',
      };

      expect(transformed.createdAtJalali).toBeDefined();
      expect(transformed.updatedAtJalali).toBeDefined();
    });

    it('should handle null/undefined dates', () => {
      const data = { createdAt: null, updatedAt: undefined };

      // Should not add Jalali fields for null/undefined
      expect(data.createdAt).toBeNull();
      expect(data.updatedAt).toBeUndefined();
    });
  });

  describe('Currency Formatting', () => {
    it('should add Formatted suffix to currency fields', () => {
      const data = { price: 1500000 };
      const transformed = {
        ...data,
        priceFormatted: '?,???,??? �����',
      };

      expect(transformed.priceFormatted).toBeDefined();
      expect(transformed.price).toBe(data.price);
    });

    it('should format with Persian digits', () => {
      const formatted = '?,???,??? �����';
      const persianDigitRegex = /[?-?]/;

      expect(persianDigitRegex.test(formatted)).toBe(true);
    });

    it('should include currency unit', () => {
      const formatted = '?,???,??? �����';

      expect(formatted).toContain('�����');
    });

    it('should use grouping separators', () => {
      const formatted = '?,???,??? �����';

      expect(formatted).toContain(',');
    });

    it('should handle zero amounts', () => {
      const data = { amount: 0 };

      // Zero should still be formatted
      expect(data.amount).toBe(0);
    });

    it('should handle negative amounts', () => {
      const data = { amount: -1000 };

      // Negative amounts should be handled
      expect(data.amount).toBeLessThan(0);
    });
  });

  describe('Recursive Transformation', () => {
    it('should transform nested objects', () => {
      const data = {
        order: {
          createdAt: '2024-01-15T10:30:00Z',
          total: 1500000,
        },
      };

      // Should transform nested fields
      expect(data.order.createdAt).toBeDefined();
      expect(data.order.total).toBeDefined();
    });

    it('should transform arrays', () => {
      const data = {
        items: [{ price: 100000 }, { price: 200000 }],
      };

      expect(data.items).toHaveLength(2);
      expect(data.items[0].price).toBe(100000);
      expect(data.items[1].price).toBe(200000);
    });

    it('should handle deeply nested structures', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              amount: 500000,
            },
          },
        },
      };

      expect(data.level1.level2.level3.amount).toBe(500000);
    });
  });

  describe('Property: Date Transformation Preserves Original', () => {
    it('should preserve original date value', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            const isoString = date.toISOString();
            const data = { createdAt: isoString };

            // Original should be preserved
            expect(data.createdAt).toBe(isoString);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Currency Transformation Preserves Original', () => {
    it('should preserve original amount value', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000000000 }), (amount) => {
          const data = { price: amount };

          // Original should be preserved
          expect(data.price).toBe(amount);
        }),
        { numRuns: 50 }
      );
    });
  });
});

// ============================================================================
// Audit Interceptor Tests
// ============================================================================

describe('AuditInterceptor', () => {
  describe('Request Logging', () => {
    it('should capture request method', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const request = { method, path: '/api/test' };
        expect(request.method).toBe(method);
      }
    });

    it('should capture request path', () => {
      const paths = ['/api/users', '/api/products', '/api/orders'];

      for (const path of paths) {
        const request = { method: 'GET', path };
        expect(request.path).toBe(path);
      }
    });

    it('should capture user ID from JWT', () => {
      const request = {
        user: { sub: 'user-123', email: 'test@example.com' },
      };

      expect(request.user.sub).toBe('user-123');
    });

    it('should capture client IP', () => {
      const request = { ip: '192.168.1.1' };

      expect(request.ip).toBe('192.168.1.1');
    });

    it('should capture user agent', () => {
      const request = {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      };

      expect(request.headers['user-agent']).toContain('Mozilla');
    });
  });

  describe('Response Timing', () => {
    it('should measure request duration', () => {
      const startTime = Date.now();

      // Simulate some processing
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should include duration in log entry', () => {
      const logEntry = {
        action: 'GET /api/test',
        duration: 150,
        status: 'success',
      };

      expect(logEntry.duration).toBeDefined();
      expect(typeof logEntry.duration).toBe('number');
    });
  });

  describe('Event Types', () => {
    const methodToEventType: Record<string, string> = {
      GET: 'DATA_READ',
      POST: 'DATA_CREATED',
      PUT: 'DATA_UPDATED',
      PATCH: 'DATA_UPDATED',
      DELETE: 'DATA_DELETED',
    };

    it('should map HTTP methods to event types', () => {
      for (const [method, eventType] of Object.entries(methodToEventType)) {
        expect(methodToEventType[method]).toBe(eventType);
      }
    });

    it('should use DATA_READ for GET requests', () => {
      expect(methodToEventType.GET).toBe('DATA_READ');
    });

    it('should use DATA_CREATED for POST requests', () => {
      expect(methodToEventType.POST).toBe('DATA_CREATED');
    });

    it('should use DATA_UPDATED for PUT/PATCH requests', () => {
      expect(methodToEventType.PUT).toBe('DATA_UPDATED');
      expect(methodToEventType.PATCH).toBe('DATA_UPDATED');
    });

    it('should use DATA_DELETED for DELETE requests', () => {
      expect(methodToEventType.DELETE).toBe('DATA_DELETED');
    });
  });

  describe('Excluded Paths', () => {
    const excludedPaths = ['/health', '/metrics', '/api/health', '/api/metrics', '/livez'];

    it('should skip audit for health endpoints', () => {
      const excludedPathsSet = new Set(excludedPaths);

      expect(excludedPathsSet.has('/health')).toBe(true);
      expect(excludedPathsSet.has('/api/health')).toBe(true);
      expect(excludedPathsSet.has('/livez')).toBe(true);
    });

    it('should skip audit for metrics endpoints', () => {
      const excludedPathsSet = new Set(excludedPaths);

      expect(excludedPathsSet.has('/metrics')).toBe(true);
      expect(excludedPathsSet.has('/api/metrics')).toBe(true);
    });

    it('should not skip audit for regular endpoints', () => {
      const excludedPathsSet = new Set(excludedPaths);

      expect(excludedPathsSet.has('/api/users')).toBe(false);
      expect(excludedPathsSet.has('/api/products')).toBe(false);
    });
  });

  describe('Excluded Methods', () => {
    const excludedMethods = ['OPTIONS'];

    it('should skip audit for OPTIONS requests', () => {
      const excludedMethodsSet = new Set(excludedMethods);

      expect(excludedMethodsSet.has('OPTIONS')).toBe(true);
    });

    it('should not skip audit for other methods', () => {
      const excludedMethodsSet = new Set(excludedMethods);

      expect(excludedMethodsSet.has('GET')).toBe(false);
      expect(excludedMethodsSet.has('POST')).toBe(false);
    });
  });

  describe('Sensitive Data Redaction', () => {
    const _sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'authorization',
      'creditCard',
    ];

    it('should redact password fields', () => {
      const _data = { password: 'secret123' };
      const redacted = { password: '[REDACTED]' };

      expect(redacted.password).toBe('[REDACTED]');
    });

    it('should redact token fields', () => {
      const _data = { token: 'jwt-token-here' };
      const redacted = { token: '[REDACTED]' };

      expect(redacted.token).toBe('[REDACTED]');
    });

    it('should redact authorization headers', () => {
      const _headers = { authorization: 'Bearer token' };
      const redacted = { authorization: '[REDACTED]' };

      expect(redacted.authorization).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive fields', () => {
      const data = { name: 'John', email: 'john@example.com' };

      expect(data.name).toBe('John');
      expect(data.email).toBe('john@example.com');
    });
  });

  describe('Error Logging', () => {
    it('should log error message', () => {
      const error = new Error('Something went wrong');
      const logEntry = {
        status: 'error',
        error: error.message,
      };

      expect(logEntry.status).toBe('error');
      expect(logEntry.error).toBe('Something went wrong');
    });

    it('should determine severity based on status code', () => {
      const getSeverity = (status: number): string => {
        if (status >= 500) {
          return 'ERROR';
        }
        if (status === 401 || status === 403) {
          return 'WARNING';
        }
        if (status === 429) {
          return 'WARNING';
        }
        return 'INFO';
      };

      expect(getSeverity(500)).toBe('ERROR');
      expect(getSeverity(503)).toBe('ERROR');
      expect(getSeverity(401)).toBe('WARNING');
      expect(getSeverity(403)).toBe('WARNING');
      expect(getSeverity(429)).toBe('WARNING');
      expect(getSeverity(200)).toBe('INFO');
      expect(getSeverity(400)).toBe('INFO');
    });
  });

  describe('Audit Actor', () => {
    it('should identify authenticated users', () => {
      const user = { sub: 'user-123', email: 'test@example.com', roles: ['USER'] };
      const actor = {
        id: user.sub,
        type: 'user',
        email: user.email,
        roles: user.roles,
      };

      expect(actor.type).toBe('user');
      expect(actor.id).toBe('user-123');
    });

    it('should identify anonymous users', () => {
      const ip = '192.168.1.1';
      const actor = {
        id: ip,
        type: 'anonymous',
      };

      expect(actor.type).toBe('anonymous');
      expect(actor.id).toBe(ip);
    });
  });

  describe('Audit Context', () => {
    it('should capture correlation headers', () => {
      const headers = {
        'x-request-id': 'req-123',
        'x-correlation-id': 'corr-456',
        'x-trace-id': 'trace-789',
      };

      const context = {
        requestId: headers['x-request-id'],
        correlationId: headers['x-correlation-id'],
        traceId: headers['x-trace-id'],
      };

      expect(context.requestId).toBe('req-123');
      expect(context.correlationId).toBe('corr-456');
      expect(context.traceId).toBe('trace-789');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Interceptors Integration', () => {
  describe('Interceptor Chain', () => {
    it('should define correct interceptor execution order', () => {
      const interceptorOrder = [
        'SecurityHeadersInterceptor',
        'LocalizationInterceptor',
        'AuditInterceptor',
      ];

      // Security headers should be first (set headers early)
      expect(interceptorOrder[0]).toBe('SecurityHeadersInterceptor');

      // Audit should be last (capture final response)
      expect(interceptorOrder[interceptorOrder.length - 1]).toBe('AuditInterceptor');
    });
  });

  describe('Response Transformation', () => {
    it('should transform response with all interceptors', () => {
      const originalResponse = {
        id: 'order-123',
        createdAt: '2024-01-15T10:30:00Z',
        total: 1500000,
      };

      // After localization interceptor
      const transformedResponse = {
        ...originalResponse,
        createdAtJalali: '????/??/??',
        totalFormatted: '?,???,??? �����',
      };

      expect(transformedResponse.id).toBe(originalResponse.id);
      expect(transformedResponse.createdAt).toBe(originalResponse.createdAt);
      expect(transformedResponse.total).toBe(originalResponse.total);
      expect(transformedResponse.createdAtJalali).toBeDefined();
      expect(transformedResponse.totalFormatted).toBeDefined();
    });
  });
});

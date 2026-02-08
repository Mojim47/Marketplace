import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Response } from 'express';
import {
  SecurityHeadersInterceptor,
  applySecurityHeaders,
  SecurityHeadersConfig,
  __testing,
} from './security-headers.interceptor';

const {
  buildCSPHeader,
  buildPermissionsPolicyHeader,
  buildHSTSHeader,
  DEFAULT_CSP_DIRECTIVES,
  DEFAULT_PERMISSIONS_POLICY,
  DEFAULT_CONFIG,
} = __testing;

describe('Security Headers', () => {
  describe('Property 13: Security Headers Presence', () => {
    // Create mock response
    function createMockResponse(): Response & { headers: Map<string, string> } {
      const headers = new Map<string, string>();
      return {
        headers,
        setHeader: vi.fn((key: string, value: string) => {
          headers.set(key, value);
        }),
        removeHeader: vi.fn((key: string) => {
          headers.delete(key);
        }),
        getHeader: vi.fn((key: string) => headers.get(key)),
      } as unknown as Response & { headers: Map<string, string> };
    }

    it('should always include X-Content-Type-Options header', () => {
      fc.assert(
        fc.property(
          fc.record({
            enableCSP: fc.boolean(),
            enableHSTS: fc.boolean(),
            enablePermissionsPolicy: fc.boolean(),
          }),
          (config) => {
            const response = createMockResponse();
            applySecurityHeaders(response, config as SecurityHeadersConfig);
            
            expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always include X-Frame-Options header', () => {
      fc.assert(
        fc.property(
          fc.record({
            enableCSP: fc.boolean(),
            enableHSTS: fc.boolean(),
            enablePermissionsPolicy: fc.boolean(),
          }),
          (config) => {
            const response = createMockResponse();
            applySecurityHeaders(response, config as SecurityHeadersConfig);
            
            expect(response.headers.get('X-Frame-Options')).toBe('DENY');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should set X-XSS-Protection to 0 (disabled)', () => {
      fc.assert(
        fc.property(
          fc.record({
            enableCSP: fc.boolean(),
            enableHSTS: fc.boolean(),
            enablePermissionsPolicy: fc.boolean(),
          }),
          (config) => {
            const response = createMockResponse();
            applySecurityHeaders(response, config as SecurityHeadersConfig);
            
            // X-XSS-Protection should be 0 (disabled) per modern security guidance
            expect(response.headers.get('X-XSS-Protection')).toBe('0');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always include Referrer-Policy header', () => {
      fc.assert(
        fc.property(
          fc.record({
            enableCSP: fc.boolean(),
            enableHSTS: fc.boolean(),
            enablePermissionsPolicy: fc.boolean(),
          }),
          (config) => {
            const response = createMockResponse();
            applySecurityHeaders(response, config as SecurityHeadersConfig);
            
            expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include Cross-Origin-Opener-Policy header', () => {
      fc.assert(
        fc.property(
          fc.record({
            enableCSP: fc.boolean(),
            enableHSTS: fc.boolean(),
            enablePermissionsPolicy: fc.boolean(),
          }),
          (config) => {
            const response = createMockResponse();
            applySecurityHeaders(response, config as SecurityHeadersConfig);
            
            expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include Cross-Origin-Resource-Policy header', () => {
      fc.assert(
        fc.property(
          fc.record({
            enableCSP: fc.boolean(),
            enableHSTS: fc.boolean(),
            enablePermissionsPolicy: fc.boolean(),
          }),
          (config) => {
            const response = createMockResponse();
            applySecurityHeaders(response, config as SecurityHeadersConfig);
            
            expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include CSP header when enabled', () => {
      fc.assert(
        fc.property(
          fc.constant({ enableCSP: true, enableHSTS: false, enablePermissionsPolicy: false }),
          (config) => {
            const response = createMockResponse();
            applySecurityHeaders(response, config as SecurityHeadersConfig);
            
            const csp = response.headers.get('Content-Security-Policy');
            expect(csp).toBeDefined();
            expect(csp).toContain("default-src 'self'");
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not include CSP header when disabled', () => {
      const response = createMockResponse();
      applySecurityHeaders(response, { 
        enableCSP: false, 
        enableHSTS: false, 
        enablePermissionsPolicy: false 
      });
      
      expect(response.headers.get('Content-Security-Policy')).toBeUndefined();
    });

    it('should include HSTS header when enabled', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 86400, max: 63072000 }), // 1 day to 2 years
          fc.boolean(),
          fc.boolean(),
          (maxAge, includeSubDomains, preload) => {
            const response = createMockResponse();
            applySecurityHeaders(response, {
              enableCSP: false,
              enableHSTS: true,
              hstsMaxAge: maxAge,
              hstsIncludeSubDomains: includeSubDomains,
              hstsPreload: preload,
              enablePermissionsPolicy: false,
            });
            
            const hsts = response.headers.get('Strict-Transport-Security');
            expect(hsts).toBeDefined();
            expect(hsts).toContain(`max-age=${maxAge}`);
            
            if (includeSubDomains) {
              expect(hsts).toContain('includeSubDomains');
            }
            
            if (preload) {
              expect(hsts).toContain('preload');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include Permissions-Policy header when enabled', () => {
      const response = createMockResponse();
      applySecurityHeaders(response, {
        enableCSP: false,
        enableHSTS: false,
        enablePermissionsPolicy: true,
      });
      
      const permissionsPolicy = response.headers.get('Permissions-Policy');
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
    });

    it('should call removeHeader for X-Powered-By', () => {
      const response = createMockResponse();
      applySecurityHeaders(response, DEFAULT_CONFIG);
      
      expect(response.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    });

    it('should set cache control headers for sensitive responses', () => {
      const response = createMockResponse();
      applySecurityHeaders(response, DEFAULT_CONFIG);
      
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });
  });

  describe('CSP Header Building', () => {
    it('should build valid CSP header from directives', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("'self'", "'none'", 'https:', 'data:'), { minLength: 1, maxLength: 3 }),
          fc.array(fc.constantFrom("'self'", "'unsafe-inline'", "'unsafe-eval'"), { minLength: 1, maxLength: 2 }),
          (defaultSrc, scriptSrc) => {
            const directives = {
              ...DEFAULT_CSP_DIRECTIVES,
              'default-src': defaultSrc,
              'script-src': scriptSrc,
            };
            
            const csp = buildCSPHeader(directives);
            
            // Should contain the directives
            expect(csp).toContain('default-src');
            expect(csp).toContain('script-src');
            
            // Should be semicolon-separated
            expect(csp).toContain(';');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include upgrade-insecure-requests when enabled', () => {
      const directives = {
        ...DEFAULT_CSP_DIRECTIVES,
        'upgrade-insecure-requests': true,
      };
      
      const csp = buildCSPHeader(directives);
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('should include block-all-mixed-content when enabled', () => {
      const directives = {
        ...DEFAULT_CSP_DIRECTIVES,
        'block-all-mixed-content': true,
      };
      
      const csp = buildCSPHeader(directives);
      expect(csp).toContain('block-all-mixed-content');
    });

    it('should include report-uri when provided', () => {
      const reportUri = 'https://example.com/csp-report';
      const csp = buildCSPHeader(DEFAULT_CSP_DIRECTIVES, reportUri);
      
      expect(csp).toContain(`report-uri ${reportUri}`);
    });
  });

  describe('Permissions-Policy Header Building', () => {
    it('should build valid Permissions-Policy header', () => {
      const policy = buildPermissionsPolicyHeader(DEFAULT_PERMISSIONS_POLICY);
      
      // Should contain disabled features
      expect(policy).toContain('camera=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('geolocation=()');
      
      // Should contain enabled features
      expect(policy).toContain('fullscreen=(self)');
    });

    it('should format self correctly', () => {
      const directives = {
        ...DEFAULT_PERMISSIONS_POLICY,
        fullscreen: ['self'],
      };
      
      const policy = buildPermissionsPolicyHeader(directives);
      expect(policy).toContain('fullscreen=(self)');
    });

    it('should format URLs correctly', () => {
      const directives = {
        ...DEFAULT_PERMISSIONS_POLICY,
        fullscreen: ['self', 'https://example.com'],
      };
      
      const policy = buildPermissionsPolicyHeader(directives);
      expect(policy).toContain('fullscreen=(self "https://example.com")');
    });
  });

  describe('HSTS Header Building', () => {
    it('should build valid HSTS header with all options', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 63072000 }),
          fc.boolean(),
          fc.boolean(),
          (maxAge, includeSubDomains, preload) => {
            const config: SecurityHeadersConfig = {
              enableCSP: false,
              enableHSTS: true,
              hstsMaxAge: maxAge,
              hstsIncludeSubDomains: includeSubDomains,
              hstsPreload: preload,
              enablePermissionsPolicy: false,
            };
            
            const hsts = buildHSTSHeader(config);
            
            expect(hsts).toContain(`max-age=${maxAge}`);
            
            if (includeSubDomains) {
              expect(hsts).toContain('includeSubDomains');
            } else {
              expect(hsts).not.toContain('includeSubDomains');
            }
            
            if (preload) {
              expect(hsts).toContain('preload');
            } else {
              expect(hsts).not.toContain('preload');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should use default max-age when not specified', () => {
      const config: SecurityHeadersConfig = {
        enableCSP: false,
        enableHSTS: true,
        enablePermissionsPolicy: false,
      };
      
      const hsts = buildHSTSHeader(config);
      expect(hsts).toContain('max-age=31536000'); // 1 year default
    });
  });

  describe('SecurityHeadersInterceptor', () => {
    it('should apply headers through interceptor', () => {
      const interceptor = new SecurityHeadersInterceptor();
      const response = {
        setHeader: vi.fn(),
        removeHeader: vi.fn(),
        getHeader: vi.fn(),
      };
      
      const context = {
        switchToHttp: () => ({
          getResponse: () => response,
        }),
      };
      
      const next = {
        handle: () => ({
          pipe: vi.fn().mockReturnThis(),
        }),
      };
      
      interceptor.intercept(context as any, next as any);
      
      // Should have called setHeader multiple times
      expect(response.setHeader).toHaveBeenCalled();
      expect(response.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        enableCSP: false,
        enableHSTS: true,
        hstsMaxAge: 86400,
      };
      
      const interceptor = new SecurityHeadersInterceptor(customConfig);
      const response = {
        setHeader: vi.fn(),
        removeHeader: vi.fn(),
        getHeader: vi.fn(),
      };
      
      const context = {
        switchToHttp: () => ({
          getResponse: () => response,
        }),
      };
      
      const next = {
        handle: () => ({
          pipe: vi.fn().mockReturnThis(),
        }),
      };
      
      interceptor.intercept(context as any, next as any);
      
      // Should have set HSTS with custom max-age
      const hstsCall = (response.setHeader as any).mock.calls.find(
        (call: any[]) => call[0] === 'Strict-Transport-Security'
      );
      expect(hstsCall).toBeDefined();
      expect(hstsCall[1]).toContain('max-age=86400');
    });
  });
});


// CORS Tests
import {
  validateOrigin,
  parseCorsOrigins,
  validateCorsConfig,
  createOriginValidator,
  CorsConfig,
  __testing as corsTestUtils,
} from './cors.config';

describe('CORS Configuration', () => {
  describe('Property 14: CORS Origin Validation', () => {
    // Arbitrary for valid origins
    const validOriginArb = fc.oneof(
      fc.constant('https://example.com'),
      fc.constant('https://app.example.com'),
      fc.constant('https://api.example.com'),
      fc.constant('http://localhost:3000'),
      fc.constant('http://localhost:8080'),
    );

    // Arbitrary for malicious origins
    const maliciousOriginArb = fc.oneof(
      fc.constant('https://evil.com'),
      fc.constant('https://example.com.evil.com'),
      fc.constant('https://examplecom'),
      fc.constant('javascript:alert(1)'),
      fc.constant('data:text/html,<script>alert(1)</script>'),
      fc.constant('https://example.com@evil.com'),
      fc.constant('https://example.com%00.evil.com'),
      fc.constant('null'),
    );

    it('should allow exact match origins', () => {
      fc.assert(
        fc.property(validOriginArb, (origin) => {
          const allowedOrigins = [origin];
          const result = validateOrigin(origin, allowedOrigins, true);
          expect(result).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject origins not in whitelist', () => {
      fc.assert(
        fc.property(
          validOriginArb,
          maliciousOriginArb,
          (allowedOrigin, requestOrigin) => {
            const allowedOrigins = [allowedOrigin];
            const result = validateOrigin(requestOrigin, allowedOrigins, true);
            
            // Should reject if not in whitelist
            if (requestOrigin !== allowedOrigin) {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject null/undefined origins in strict mode', () => {
      fc.assert(
        fc.property(
          fc.array(validOriginArb, { minLength: 1, maxLength: 5 }),
          (allowedOrigins) => {
            expect(validateOrigin(undefined, allowedOrigins, true)).toBe(false);
            expect(validateOrigin('', allowedOrigins, true)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should support wildcard subdomain patterns', () => {
      const allowedOrigins = ['*.example.com'];
      
      // Should allow subdomains
      expect(validateOrigin('https://app.example.com', allowedOrigins, true)).toBe(true);
      expect(validateOrigin('https://api.example.com', allowedOrigins, true)).toBe(true);
      expect(validateOrigin('https://sub.app.example.com', allowedOrigins, true)).toBe(true);
      
      // Should reject non-subdomains
      expect(validateOrigin('https://example.com', allowedOrigins, true)).toBe(false);
      expect(validateOrigin('https://notexample.com', allowedOrigins, true)).toBe(false);
      expect(validateOrigin('https://example.com.evil.com', allowedOrigins, true)).toBe(false);
    });

    it('should prevent origin confusion attacks', () => {
      const allowedOrigins = ['https://example.com'];
      
      // These should all be rejected
      const confusionAttempts = [
        'https://example.com.evil.com',
        'https://evil.example.com',
        'https://examplecom',
        'https://example.com@evil.com',
        'https://example.com%00.evil.com',
        'https://example.com:evil.com',
      ];
      
      for (const attempt of confusionAttempts) {
        expect(validateOrigin(attempt, allowedOrigins, true)).toBe(false);
      }
    });

    it('should handle regex patterns safely', () => {
      const allowedOrigins = ['/^https:\\/\\/[a-z]+\\.example\\.com$/'];
      
      // Should match valid patterns
      expect(validateOrigin('https://app.example.com', allowedOrigins, true)).toBe(true);
      expect(validateOrigin('https://api.example.com', allowedOrigins, true)).toBe(true);
      
      // Should reject invalid patterns
      expect(validateOrigin('https://123.example.com', allowedOrigins, true)).toBe(false);
      expect(validateOrigin('http://app.example.com', allowedOrigins, true)).toBe(false);
    });

    it('should call callback with correct values', () => {
      fc.assert(
        fc.property(
          validOriginArb,
          fc.boolean(),
          (origin, shouldAllow) => {
            const allowedOrigins = shouldAllow ? [origin] : ['https://other.com'];
            const validator = createOriginValidator(allowedOrigins, true);
            
            let callbackCalled = false;
            let callbackError: Error | null = null;
            let callbackAllow: boolean | undefined;
            
            validator(origin, (err, allow) => {
              callbackCalled = true;
              callbackError = err;
              callbackAllow = allow;
            });
            
            expect(callbackCalled).toBe(true);
            
            if (shouldAllow) {
              expect(callbackError).toBeNull();
              expect(callbackAllow).toBe(true);
            } else {
              expect(callbackError).toBeInstanceOf(Error);
              expect(callbackAllow).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('CORS Configuration Parsing', () => {
    // Define validOriginArb locally for this describe block
    const validOriginArb = fc.oneof(
      fc.constant('https://example.com'),
      fc.constant('https://app.example.com'),
      fc.constant('https://api.example.com'),
      fc.constant('http://localhost:3000'),
      fc.constant('http://localhost:8080'),
    );

    it('should parse comma-separated origins', () => {
      fc.assert(
        fc.property(
          fc.array(validOriginArb, { minLength: 1, maxLength: 5 }),
          (origins) => {
            const envValue = origins.join(',');
            const parsed = parseCorsOrigins(envValue);
            
            expect(parsed).toHaveLength(origins.length);
            for (const origin of origins) {
              expect(parsed).toContain(origin);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle empty/undefined values', () => {
      expect(parseCorsOrigins(undefined)).toEqual([]);
      expect(parseCorsOrigins('')).toEqual([]);
      expect(parseCorsOrigins('   ')).toEqual([]);
    });

    it('should trim whitespace from origins', () => {
      const result = parseCorsOrigins('  https://a.com  ,  https://b.com  ');
      expect(result).toEqual(['https://a.com', 'https://b.com']);
    });
  });

  describe('CORS Configuration Validation', () => {
    it('should reject wildcard with credentials', () => {
      const config: CorsConfig = {
        ...corsTestUtils.DEFAULT_CORS_CONFIG,
        allowedOrigins: ['*'],
        credentials: true,
      };
      
      const errors = validateCorsConfig(config);
      expect(errors).toContain('Cannot use wildcard origin (*) with credentials enabled');
    });

    it('should validate origin URL formats', () => {
      const config: CorsConfig = {
        ...corsTestUtils.DEFAULT_CORS_CONFIG,
        allowedOrigins: ['not-a-url', 'https://valid.com'],
        credentials: false,
      };
      
      const errors = validateCorsConfig(config);
      expect(errors.some(e => e.includes('Invalid origin format'))).toBe(true);
    });

    it('should validate HTTP methods', () => {
      const config: CorsConfig = {
        ...corsTestUtils.DEFAULT_CORS_CONFIG,
        allowedOrigins: ['https://example.com'],
        methods: ['GET', 'INVALID_METHOD'],
      };
      
      const errors = validateCorsConfig(config);
      expect(errors.some(e => e.includes('Invalid HTTP method'))).toBe(true);
    });

    it('should accept valid configurations', () => {
      const config: CorsConfig = {
        allowedOrigins: ['https://example.com', '*.example.com'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Correlation-ID'],
        maxAge: 86400,
        strictOriginValidation: true,
      };
      
      const errors = validateCorsConfig(config);
      expect(errors).toHaveLength(0);
    });
  });
});

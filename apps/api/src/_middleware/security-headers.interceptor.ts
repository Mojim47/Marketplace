import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NestMiddleware,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response, NextFunction } from 'express';

/**
 * Security headers configuration
 * Based on OWASP recommendations and modern security best practices
 */
export interface SecurityHeadersConfig {
  /** Enable Content-Security-Policy header */
  enableCSP: boolean;
  /** Custom CSP directives */
  cspDirectives?: Partial<CSPDirectives>;
  /** Enable Strict-Transport-Security header */
  enableHSTS: boolean;
  /** HSTS max-age in seconds (default: 1 year) */
  hstsMaxAge?: number;
  /** Include subdomains in HSTS */
  hstsIncludeSubDomains?: boolean;
  /** Enable HSTS preload */
  hstsPreload?: boolean;
  /** Allowed frame ancestors for X-Frame-Options alternative */
  frameAncestors?: string[];
  /** Enable Permissions-Policy header */
  enablePermissionsPolicy: boolean;
  /** Custom permissions policy */
  permissionsPolicy?: Partial<PermissionsPolicyDirectives>;
  /** Report URI for CSP violations */
  reportUri?: string;
}

/**
 * Content-Security-Policy directives
 */
export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'media-src': string[];
  'object-src': string[];
  'frame-src': string[];
  'frame-ancestors': string[];
  'base-uri': string[];
  'form-action': string[];
  'upgrade-insecure-requests': boolean;
  'block-all-mixed-content': boolean;
  'report-uri': string[];
}

/**
 * Permissions-Policy directives
 */
export interface PermissionsPolicyDirectives {
  accelerometer: string[];
  'ambient-light-sensor': string[];
  autoplay: string[];
  battery: string[];
  camera: string[];
  'display-capture': string[];
  'document-domain': string[];
  'encrypted-media': string[];
  fullscreen: string[];
  geolocation: string[];
  gyroscope: string[];
  'layout-animations': string[];
  magnetometer: string[];
  microphone: string[];
  midi: string[];
  'navigation-override': string[];
  'payment': string[];
  'picture-in-picture': string[];
  'publickey-credentials-get': string[];
  'screen-wake-lock': string[];
  'sync-xhr': string[];
  usb: string[];
  'web-share': string[];
  'xr-spatial-tracking': string[];
}

/**
 * Default CSP directives for production
 */
const DEFAULT_CSP_DIRECTIVES: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"], // Required for some UI frameworks
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': ["'self'"],
  'media-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': true,
  'block-all-mixed-content': true,
  'report-uri': [],
};

/**
 * Default Permissions-Policy for production
 * Restrictive by default - only enable what's needed
 */
const DEFAULT_PERMISSIONS_POLICY: PermissionsPolicyDirectives = {
  accelerometer: [],
  'ambient-light-sensor': [],
  autoplay: [],
  battery: [],
  camera: [],
  'display-capture': [],
  'document-domain': [],
  'encrypted-media': [],
  fullscreen: ['self'],
  geolocation: [],
  gyroscope: [],
  'layout-animations': ['self'],
  magnetometer: [],
  microphone: [],
  midi: [],
  'navigation-override': [],
  payment: [], // Enable if using Payment Request API
  'picture-in-picture': [],
  'publickey-credentials-get': ['self'], // For WebAuthn
  'screen-wake-lock': [],
  'sync-xhr': [],
  usb: [],
  'web-share': ['self'],
  'xr-spatial-tracking': ['self'], // For AR/3D features
};

/**
 * Default security headers configuration
 */
const DEFAULT_CONFIG: SecurityHeadersConfig = {
  enableCSP: true,
  enableHSTS: true,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: false, // Enable only after testing
  enablePermissionsPolicy: true,
};

/**
 * Build CSP header value from directives
 */
function buildCSPHeader(
  directives: CSPDirectives,
  reportUri?: string,
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    if (key === 'upgrade-insecure-requests' && value === true) {
      parts.push('upgrade-insecure-requests');
    } else if (key === 'block-all-mixed-content' && value === true) {
      parts.push('block-all-mixed-content');
    } else if (Array.isArray(value) && value.length > 0) {
      parts.push(`${key} ${value.join(' ')}`);
    }
  }

  if (reportUri) {
    parts.push(`report-uri ${reportUri}`);
  }

  return parts.join('; ');
}

/**
 * Build Permissions-Policy header value
 */
function buildPermissionsPolicyHeader(
  directives: PermissionsPolicyDirectives,
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        parts.push(`${key}=()`);
      } else {
        const formattedValues = value.map(v => v === 'self' ? 'self' : `"${v}"`);
        parts.push(`${key}=(${formattedValues.join(' ')})`);
      }
    }
  }

  return parts.join(', ');
}

/**
 * Build HSTS header value
 */
function buildHSTSHeader(config: SecurityHeadersConfig): string {
  const maxAge =
    typeof config.hstsMaxAge === 'number' ? config.hstsMaxAge : 31536000;
  const parts = [`max-age=${maxAge}`];
  
  if (config.hstsIncludeSubDomains) {
    parts.push('includeSubDomains');
  }
  
  if (config.hstsPreload) {
    parts.push('preload');
  }
  
  return parts.join('; ');
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(
  response: Response,
  config: SecurityHeadersConfig = DEFAULT_CONFIG,
): void {
  // Remove X-Powered-By header (information disclosure)
  response.removeHeader('X-Powered-By');

  // X-Content-Type-Options - Prevent MIME type sniffing
  response.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options - Prevent clickjacking (legacy, use CSP frame-ancestors)
  response.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection - Disable (rely on CSP instead, can cause issues)
  // Modern browsers have deprecated this, and it can introduce vulnerabilities
  response.setHeader('X-XSS-Protection', '0');

  // Referrer-Policy - Control referrer information
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Cross-Origin-Opener-Policy - Isolate browsing context
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Cross-Origin-Resource-Policy - Prevent cross-origin reads
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Cross-Origin-Embedder-Policy - Require CORP for cross-origin resources
  // Note: May break some third-party integrations
  // response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  // Content-Security-Policy
  if (config.enableCSP) {
    const cspDirectives = {
      ...DEFAULT_CSP_DIRECTIVES,
      ...config.cspDirectives,
    };
    const cspHeader = buildCSPHeader(cspDirectives, config.reportUri);
    response.setHeader('Content-Security-Policy', cspHeader);
  }

  // Strict-Transport-Security (HSTS)
  if (config.enableHSTS) {
    response.setHeader('Strict-Transport-Security', buildHSTSHeader(config));
  }

  // Permissions-Policy
  if (config.enablePermissionsPolicy) {
    const permissionsPolicy = {
      ...DEFAULT_PERMISSIONS_POLICY,
      ...config.permissionsPolicy,
    };
    response.setHeader(
      'Permissions-Policy',
      buildPermissionsPolicyHeader(permissionsPolicy),
    );
  }

  // Cache-Control for sensitive responses
  // Individual endpoints can override this
  if (!response.getHeader('Cache-Control')) {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
  }
}

/**
 * Security Headers Interceptor for NestJS
 * 
 * Applies comprehensive security headers to all responses:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - X-XSS-Protection (disabled, rely on CSP)
 * - Referrer-Policy
 * - Permissions-Policy
 * - Cross-Origin-Opener-Policy
 * - Cross-Origin-Resource-Policy
 * - Removes X-Powered-By
 */
@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  private readonly config: SecurityHeadersConfig;

  constructor(config: Partial<SecurityHeadersConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    
    // Apply headers before response is sent
    applySecurityHeaders(response, this.config);
    
    return next.handle();
  }
}

/**
 * Security Headers Middleware for NestJS
 * Alternative to interceptor for earlier header application
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly config: SecurityHeadersConfig;

  constructor(config: Partial<SecurityHeadersConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    applySecurityHeaders(res, this.config);
    next();
  }
}

/**
 * Create security headers middleware with custom config
 */
export function createSecurityHeadersMiddleware(
  config: Partial<SecurityHeadersConfig> = {},
): (req: Request, res: Response, next: NextFunction) => void {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  return (req: Request, res: Response, next: NextFunction) => {
    applySecurityHeaders(res, mergedConfig);
    next();
  };
}

/**
 * Export for testing
 */
export const __testing = {
  buildCSPHeader,
  buildPermissionsPolicyHeader,
  buildHSTSHeader,
  DEFAULT_CSP_DIRECTIVES,
  DEFAULT_PERMISSIONS_POLICY,
  DEFAULT_CONFIG,
};

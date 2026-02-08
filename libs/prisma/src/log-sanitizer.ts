/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Log Sanitizer - Sensitive Data Protection for Logging
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Features:
 * - Automatic detection and masking of sensitive data patterns
 * - Support for nested objects and arrays
 * - Persian-aware patterns (کد ملی, شماره کارت, etc.)
 * - Configurable masking strategies
 *
 * Security Requirements:
 * - REQ 4.4: Prevent sensitive data in logs
 * - REQ 12.3: Sanitize audit log content
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Logger } from '@nestjs/common';

/**
 * Sensitive data patterns with their masking strategies
 */
export interface SensitivePattern {
  /** Pattern name for identification */
  name: string;
  /** Regex pattern to match sensitive data */
  pattern: RegExp;
  /** Masking function */
  mask: (value: string) => string;
}

/**
 * Default sensitive field names (case-insensitive)
 */
const SENSITIVE_FIELD_NAMES = new Set([
  // Authentication
  'password',
  'passwordhash',
  'password_hash',
  'secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'secretkey',
  'secret_key',
  'authorization',
  'auth',
  'bearer',
  'jwt',
  'jwttoken',
  'jwt_token',
  'sessiontoken',
  'session_token',
  'csrftoken',
  'csrf_token',
  'xsrftoken',
  'xsrf_token',

  // 2FA/MFA
  'totp',
  'totpsecret',
  'totp_secret',
  'mfasecret',
  'mfa_secret',
  'backupcode',
  'backup_code',
  'recovercode',
  'recovery_code',
  'otp',
  'otpcode',
  'otp_code',
  'verificationcode',
  'verification_code',

  // Financial
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'cvv2',
  'cvc2',
  'pin',
  'pincode',
  'pin_code',
  'accountnumber',
  'account_number',
  'iban',
  'bankaccount',
  'bank_account',
  'creditcard',
  'credit_card',
  'debitcard',
  'debit_card',

  // Personal Identifiable Information (PII)
  'ssn',
  'socialsecurity',
  'social_security',
  'nationalid',
  'national_id',
  'passport',
  'passportnumber',
  'passport_number',
  'driverslicense',
  'drivers_license',
  'taxid',
  'tax_id',

  // Persian-specific
  'کدملی',
  'کد_ملی',
  'شماره_کارت',
  'شماره_حساب',
  'رمز',
  'رمزعبور',
  'کلمه_عبور',
]);

/**
 * Regex patterns for detecting sensitive data in values
 */
const SENSITIVE_VALUE_PATTERNS: SensitivePattern[] = [
  // Iranian National ID (کد ملی) - 10 digits
  {
    name: 'iranian_national_id',
    pattern: /\b\d{10}\b/g,
    mask: (v) => v.slice(0, 3) + '****' + v.slice(-3),
  },

  // Iranian Bank Card Number - 16 digits
  {
    name: 'iranian_card_number',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    mask: (v) => {
      const digits = v.replace(/[-\s]/g, '');
      return digits.slice(0, 6) + '******' + digits.slice(-4);
    },
  },

  // IBAN (Iranian format: IR + 24 digits)
  {
    name: 'iban',
    pattern: /\bIR\d{24}\b/gi,
    mask: (v) => v.slice(0, 4) + '****' + v.slice(-4),
  },

  // Email addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    mask: (v) => {
      const parts = v.split('@');
      const local = parts[0] ?? '';
      const domain = parts[1] ?? '';
      const maskedLocal = local.length > 2 ? local[0] + '***' + local[local.length - 1] : '***';
      return `${maskedLocal}@${domain}`;
    },
  },

  // Iranian Mobile Numbers (09XXXXXXXXX)
  {
    name: 'iranian_mobile',
    pattern: /\b09\d{9}\b/g,
    mask: (v) => v.slice(0, 4) + '***' + v.slice(-3),
  },

  // JWT Tokens (header.payload.signature)
  {
    name: 'jwt_token',
    pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g,
    mask: () => '[JWT_REDACTED]',
  },

  // Bearer tokens
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[A-Za-z0-9_-]+/gi,
    mask: () => 'Bearer [REDACTED]',
  },

  // API Keys (common formats)
  {
    name: 'api_key',
    pattern: /\b(sk|pk|api|key)[-_][A-Za-z0-9]{20,}\b/gi,
    mask: (v) => v.slice(0, 8) + '...[REDACTED]',
  },

  // Note: UUIDs are NOT masked by default as they are often used as public identifiers
  // Only mask UUIDs in explicitly sensitive fields

  // Base64 encoded secrets (long strings)
  {
    name: 'base64_secret',
    pattern: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
    mask: (v) => v.slice(0, 10) + '...[REDACTED]...' + v.slice(-4),
  },

  // Password-like patterns in URLs
  {
    name: 'url_password',
    pattern: /:\/\/[^:]+:([^@]+)@/g,
    mask: (v) => v.replace(/:([^@]+)@/, ':***@'),
  },
];

/**
 * Log sanitizer configuration
 */
export interface LogSanitizerConfig {
  /** Additional field names to treat as sensitive */
  additionalSensitiveFields?: string[];
  /** Additional patterns to detect sensitive data */
  additionalPatterns?: SensitivePattern[];
  /** Maximum depth for nested object sanitization */
  maxDepth?: number;
  /** Replacement string for fully masked values */
  fullMaskReplacement?: string;
}

const DEFAULT_CONFIG: Required<LogSanitizerConfig> = {
  additionalSensitiveFields: [],
  additionalPatterns: [],
  maxDepth: 10,
  fullMaskReplacement: '[REDACTED]',
};

/**
 * Log Sanitizer class for removing sensitive data from logs
 */
export class LogSanitizer {
  private readonly sensitiveFields: Set<string>;
  private readonly patterns: SensitivePattern[];
  private readonly config: Required<LogSanitizerConfig>;
  private readonly logger = new Logger(LogSanitizer.name);

  constructor(config: LogSanitizerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Combine default and additional sensitive fields
    this.sensitiveFields = new Set([
      ...SENSITIVE_FIELD_NAMES,
      ...this.config.additionalSensitiveFields.map((f) => f.toLowerCase()),
    ]);

    // Combine default and additional patterns
    this.patterns = [...SENSITIVE_VALUE_PATTERNS, ...this.config.additionalPatterns];
  }

  /**
   * Check if a field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const normalized = fieldName.toLowerCase().replace(/[-_]/g, '');
    return (
      this.sensitiveFields.has(normalized) || this.sensitiveFields.has(fieldName.toLowerCase())
    );
  }

  /**
   * Sanitize a string value by applying all patterns
   */
  private sanitizeString(value: string): string {
    let sanitized = value;

    for (const pattern of this.patterns) {
      sanitized = sanitized.replace(pattern.pattern, (match) => {
        try {
          return pattern.mask(match);
        } catch {
          return this.config.fullMaskReplacement;
        }
      });
    }

    return sanitized;
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(obj: unknown, depth: number = 0): unknown {
    // Prevent infinite recursion
    if (depth > this.config.maxDepth) {
      return '[MAX_DEPTH_EXCEEDED]';
    }

    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle primitives
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, depth + 1));
    }

    // Handle Date objects
    if (obj instanceof Date) {
      return obj;
    }

    // Handle Error objects
    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: this.sanitizeString(obj.message),
        stack: obj.stack ? this.sanitizeString(obj.stack) : undefined,
      };
    }

    // Handle plain objects
    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        if (this.isSensitiveField(key)) {
          // Fully redact sensitive fields
          sanitized[key] = this.config.fullMaskReplacement;
        } else {
          // Recursively sanitize non-sensitive fields
          sanitized[key] = this.sanitizeObject(value, depth + 1);
        }
      }

      return sanitized;
    }

    // Return unknown types as-is
    return obj;
  }

  /**
   * Sanitize data for logging
   *
   * @param data - Data to sanitize (can be any type)
   * @returns Sanitized data safe for logging
   *
   * @example
   * ```typescript
   * const sanitizer = new LogSanitizer();
   *
   * const userData = {
   *   email: 'user@example.com',
   *   password: 'secret123',
   *   profile: {
   *     nationalId: '1234567890',
   *     phone: '09123456789',
   *   },
   * };
   *
   * const safe = sanitizer.sanitize(userData);
   * // Result:
   * // {
   * //   email: 'u***r@example.com',
   * //   password: '[REDACTED]',
   * //   profile: {
   * //     nationalId: '123****890',
   * //     phone: '0912***789',
   * //   },
   * // }
   * ```
   */
  sanitize<T>(data: T): T {
    try {
      return this.sanitizeObject(data) as T;
    } catch (error) {
      this.logger.error('خطا در پاکسازی داده‌های حساس', error);
      // Return a safe fallback
      return { sanitizationError: true } as T;
    }
  }

  /**
   * Sanitize a log message string
   */
  sanitizeMessage(message: string): string {
    return this.sanitizeString(message);
  }

  /**
   * Create a sanitized JSON string for logging
   */
  toSafeJson(data: unknown, space?: number): string {
    const sanitized = this.sanitize(data);
    return JSON.stringify(sanitized, null, space);
  }
}

/**
 * Default singleton instance
 */
let defaultSanitizer: LogSanitizer | null = null;

/**
 * Get or create the default log sanitizer instance
 */
export function getLogSanitizer(config?: LogSanitizerConfig): LogSanitizer {
  if (!defaultSanitizer || config) {
    defaultSanitizer = new LogSanitizer(config);
  }
  return defaultSanitizer;
}

/**
 * Convenience function to sanitize data using default sanitizer
 */
export function sanitizeForLog<T>(data: T): T {
  return getLogSanitizer().sanitize(data);
}

/**
 * Convenience function to sanitize a message string
 */
export function sanitizeMessage(message: string): string {
  return getLogSanitizer().sanitizeMessage(message);
}

/**
 * Decorator for sanitizing method arguments in logs
 *
 * @example
 * ```typescript
 * class UserService {
 *   @SanitizeArgs()
 *   async createUser(data: CreateUserDto) {
 *     this.logger.log('Creating user', data); // data is auto-sanitized
 *   }
 * }
 * ```
 */
export function SanitizeArgs() {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const sanitizedArgs = args.map((arg) => sanitizeForLog(arg));
      return originalMethod.apply(this, sanitizedArgs);
    };

    return descriptor;
  };
}

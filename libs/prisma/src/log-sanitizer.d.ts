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
/**
 * Log Sanitizer class for removing sensitive data from logs
 */
export declare class LogSanitizer {
  private readonly sensitiveFields;
  private readonly patterns;
  private readonly config;
  private readonly logger;
  constructor(config?: LogSanitizerConfig);
  /**
   * Check if a field name is sensitive
   */
  private isSensitiveField;
  /**
   * Sanitize a string value by applying all patterns
   */
  private sanitizeString;
  /**
   * Recursively sanitize an object
   */
  private sanitizeObject;
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
  sanitize<T>(data: T): T;
  /**
   * Sanitize a log message string
   */
  sanitizeMessage(message: string): string;
  /**
   * Create a sanitized JSON string for logging
   */
  toSafeJson(data: unknown, space?: number): string;
}
/**
 * Get or create the default log sanitizer instance
 */
export declare function getLogSanitizer(config?: LogSanitizerConfig): LogSanitizer;
/**
 * Convenience function to sanitize data using default sanitizer
 */
export declare function sanitizeForLog<T>(data: T): T;
/**
 * Convenience function to sanitize a message string
 */
export declare function sanitizeMessage(message: string): string;
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
export declare function SanitizeArgs(): (
  _target: unknown,
  _propertyKey: string,
  descriptor: PropertyDescriptor
) => PropertyDescriptor;
//# sourceMappingURL=log-sanitizer.d.ts.map

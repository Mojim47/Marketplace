/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Unified Validation Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enterprise validation with Zod schemas, NestJS integration, and security features.
 * Provides type-safe validation with Persian error messages and input sanitization.
 *
 * Features:
 * - Zod schema validation
 * - NestJS Pipe integration
 * - Persian error messages
 * - Custom validators for Iranian data
 * - Security validation (SQL injection, XSS, path traversal, command injection)
 * - Input sanitization with DOMPurify
 *
 * @module @nextgen/validation
 */

import { Injectable, PipeTransform, ArgumentMetadata, Logger } from '@nestjs/common';
import { z, ZodSchema, ZodError, ZodIssue } from 'zod';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { ValidationError as ValidationErrorClass } from '@nextgen/errors';

// ═══════════════════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationErrorDetail {
  field: string;
  message: string;
  messageFA: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationErrorDetail[];
}

export interface SecurityValidationResult {
  isValid: boolean;
  sanitizedValue?: unknown;
  violations: SecurityViolation[];
  riskScore: number;
}

export interface SecurityViolation {
  type: 'sql_injection' | 'xss' | 'path_traversal' | 'command_injection' | 'malformed_data' | 'suspicious_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  field: string;
  originalValue: unknown;
  description: string;
  blocked: boolean;
}

export interface SecurityConfig {
  enableSQLInjectionProtection: boolean;
  enableXSSProtection: boolean;
  enablePathTraversalProtection: boolean;
  enableCommandInjectionProtection: boolean;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectDepth: number;
  allowedFileExtensions: string[];
  blockedPatterns: RegExp[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Persian Error Messages
// ═══════════════════════════════════════════════════════════════════════════

const PERSIAN_ERRORS: Record<string, string> = {
  invalid_type: 'نوع داده نامعتبر است',
  invalid_literal: 'مقدار نامعتبر است',
  custom: 'خطای اعتبارسنجی',
  invalid_union: 'هیچ‌کدام از گزینه‌های معتبر نیست',
  invalid_union_discriminator: 'مقدار تشخیص‌دهنده نامعتبر است',
  invalid_enum_value: 'مقدار انتخابی نامعتبر است',
  unrecognized_keys: 'فیلدهای ناشناخته وجود دارد',
  invalid_arguments: 'آرگومان‌های نامعتبر',
  invalid_return_type: 'نوع بازگشتی نامعتبر',
  invalid_date: 'تاریخ نامعتبر است',
  invalid_string: 'رشته نامعتبر است',
  too_small: 'مقدار کوچک‌تر از حد مجاز است',
  too_big: 'مقدار بزرگ‌تر از حد مجاز است',
  invalid_intersection_types: 'نوع‌های متقاطع نامعتبر',
  not_multiple_of: 'مقدار مضربی از عدد مشخص شده نیست',
  not_finite: 'مقدار باید محدود باشد',
};

const PERSIAN_STRING_ERRORS: Record<string, string> = {
  email: 'آدرس ایمیل نامعتبر است',
  url: 'آدرس وب نامعتبر است',
  emoji: 'ایموجی نامعتبر است',
  uuid: 'شناسه UUID نامعتبر است',
  cuid: 'شناسه CUID نامعتبر است',
  cuid2: 'شناسه CUID2 نامعتبر است',
  ulid: 'شناسه ULID نامعتبر است',
  regex: 'الگوی متن نامعتبر است',
  includes: 'متن شامل مقدار مورد نظر نیست',
  startsWith: 'متن با مقدار مورد نظر شروع نمی‌شود',
  endsWith: 'متن با مقدار مورد نظر پایان نمی‌یابد',
  datetime: 'تاریخ و زمان نامعتبر است',
  ip: 'آدرس IP نامعتبر است',
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Validation Service
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private readonly domPurify: typeof DOMPurify;
  private readonly securityConfig: SecurityConfig;

  // Security patterns
  private readonly sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /('|(\\')|(;)|(--)|(\s)|(\/\*)|(\*\/))/gi,
    /(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(\b(WAITFOR|DELAY)\b)/gi,
  ];

  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi,
    /expression\s*\(/gi,
  ];

  private readonly pathTraversalPatterns = [
    /\.\.[\/\\]/g,
    /\.\.[\\\/]/g,
    /%2e%2e[\/\\]/gi,
    /%252e%252e[\/\\]/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
  ];

  private readonly commandInjectionPatterns = [
    /[;&|`$(){}[\]]/g,
    /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|wget|curl|nc|telnet|ssh|ftp)\b/gi,
    /(\||&&|;|`|\$\(|\${)/g,
  ];

  constructor() {
    // Setup DOM for server-side DOMPurify
    const window = new JSDOM('').window;
    this.domPurify = DOMPurify(window);

    this.securityConfig = {
      enableSQLInjectionProtection: true,
      enableXSSProtection: true,
      enablePathTraversalProtection: true,
      enableCommandInjectionProtection: true,
      maxStringLength: 10000,
      maxArrayLength: 1000,
      maxObjectDepth: 10,
      allowedFileExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.glb', '.usdz'],
      blockedPatterns: [
        /eval\s*\(/gi,
        /Function\s*\(/gi,
        /setTimeout\s*\(/gi,
        /setInterval\s*\(/gi,
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Core Validation Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate data against a Zod schema
   */
  validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          errors: this.formatErrors(error),
        };
      }
      throw error;
    }
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
    const result = this.validate(schema, data);
    if (!result.success) {
      throw ValidationErrorClass.schemaValidationFailed(
        result.errors?.map((e) => ({ field: e.field, message: e.message })) || []
      );
    }
    return result.data!;
  }

  /**
   * Safe parse without throwing
   */
  safeParse<T>(
    schema: ZodSchema<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; error: ZodError } {
    return schema.safeParse(data) as
      | { success: true; data: T }
      | { success: false; error: ZodError };
  }

  /**
   * Format Zod errors to ValidationErrorDetail array
   */
  formatErrors(error: ZodError): ValidationErrorDetail[] {
    return error.issues.map((issue) => this.formatIssue(issue));
  }

  /**
   * Format a single Zod issue
   */
  private formatIssue(issue: ZodIssue): ValidationErrorDetail {
    const field = issue.path.join('.');
    const code = issue.code;
    let messageFA = PERSIAN_ERRORS[code] ?? 'خطای اعتبارسنجی';

    // Handle string-specific errors
    if (code === 'invalid_string' && 'validation' in issue) {
      const validation = issue.validation as string;
      messageFA = PERSIAN_STRING_ERRORS[validation] ?? messageFA;
    }

    // Handle size errors
    if (code === 'too_small' || code === 'too_big') {
      const minimum = 'minimum' in issue ? issue.minimum : undefined;
      const maximum = 'maximum' in issue ? issue.maximum : undefined;
      if (minimum !== undefined) {
        messageFA = `مقدار باید حداقل ${minimum} باشد`;
      }
      if (maximum !== undefined) {
        messageFA = `مقدار باید حداکثر ${maximum} باشد`;
      }
    }

    return {
      field,
      message: issue.message,
      messageFA,
      code,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Security Validation Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Main security validation method - validates and sanitizes input
   */
  async validateAndSanitize(
    data: unknown,
    fieldName: string = 'input'
  ): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    let riskScore = 0;
    let sanitizedValue = data;

    try {
      // 1. SQL Injection detection
      if (this.securityConfig.enableSQLInjectionProtection) {
        const sqlViolations = this.detectSQLInjection(data, fieldName);
        violations.push(...sqlViolations);
      }

      // 2. XSS detection and sanitization
      if (this.securityConfig.enableXSSProtection) {
        const { violations: xssViolations, sanitized } = this.detectAndSanitizeXSS(data, fieldName);
        violations.push(...xssViolations);
        sanitizedValue = sanitized;
      }

      // 3. Path traversal detection
      if (this.securityConfig.enablePathTraversalProtection) {
        const pathViolations = this.detectPathTraversal(data, fieldName);
        violations.push(...pathViolations);
      }

      // 4. Command injection detection
      if (this.securityConfig.enableCommandInjectionProtection) {
        const cmdViolations = this.detectCommandInjection(data, fieldName);
        violations.push(...cmdViolations);
      }

      // Calculate risk score
      riskScore = violations.reduce((score, violation) => {
        const severityScore = { low: 1, medium: 3, high: 7, critical: 10 };
        return score + severityScore[violation.severity];
      }, 0);

      const isValid = violations.filter(v => v.blocked).length === 0;

      return {
        isValid,
        sanitizedValue,
        violations,
        riskScore,
      };
    } catch (error) {
      this.logger.error('Security validation error:', error);
      return {
        isValid: false,
        violations: [{
          type: 'malformed_data',
          severity: 'high',
          field: fieldName,
          originalValue: data,
          description: 'Security validation failed',
          blocked: true,
        }],
        riskScore: 10,
      };
    }
  }

  /**
   * Detect SQL injection patterns
   */
  private detectSQLInjection(data: unknown, fieldName: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (typeof data === 'string') {
      for (const pattern of this.sqlPatterns) {
        if (pattern.test(data)) {
          violations.push({
            type: 'sql_injection',
            severity: 'critical',
            field: fieldName,
            originalValue: data,
            description: 'Potential SQL injection detected',
            blocked: true,
          });
          break;
        }
      }
    }
    
    return violations;
  }

  /**
   * Detect and sanitize XSS
   */
  private detectAndSanitizeXSS(data: unknown, fieldName: string): { violations: SecurityViolation[], sanitized: unknown } {
    const violations: SecurityViolation[] = [];
    let sanitized: unknown = data;

    if (typeof data === 'string') {
      // Check for XSS patterns
      for (const pattern of this.xssPatterns) {
        if (pattern.test(data)) {
          violations.push({
            type: 'xss',
            severity: 'high',
            field: fieldName,
            originalValue: data,
            description: 'Potential XSS detected and sanitized',
            blocked: false, // Not blocked, just sanitized
          });
          break;
        }
      }

      // Sanitize with DOMPurify
      sanitized = this.domPurify.sanitize(data, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'script'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick'],
      });
    }

    return { violations, sanitized };
  }

  /**
   * Detect path traversal attempts
   */
  private detectPathTraversal(data: unknown, fieldName: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (typeof data === 'string') {
      for (const pattern of this.pathTraversalPatterns) {
        if (pattern.test(data)) {
          violations.push({
            type: 'path_traversal',
            severity: 'high',
            field: fieldName,
            originalValue: data,
            description: 'Path traversal attempt detected',
            blocked: true,
          });
          break;
        }
      }
    }
    
    return violations;
  }

  /**
   * Detect command injection attempts
   */
  private detectCommandInjection(data: unknown, fieldName: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (typeof data === 'string') {
      for (const pattern of this.commandInjectionPatterns) {
        if (pattern.test(data)) {
          violations.push({
            type: 'command_injection',
            severity: 'critical',
            field: fieldName,
            originalValue: data,
            description: 'Command injection attempt detected',
            blocked: true,
          });
          break;
        }
      }
    }
    
    return violations;
  }

  /**
   * Sanitize HTML content safely
   */
  sanitizeHtml(html: string): string {
    return this.domPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'script'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Pipe for NestJS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const validationService = new ValidationService();
    return validationService.validateOrThrow(this.schema, value);
  }
}
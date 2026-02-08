/**
 * Sanitization Interceptor
 * 
 * Automatically sanitizes all string inputs in request bodies
 * to prevent XSS attacks.
 * 
 * Requirements: 2.2 - XSS sanitization for all user inputs
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export interface SanitizeOptions {
  allowBasicFormatting?: boolean;
  maxLength?: number;
  trim?: boolean;
  normalizePersian?: boolean;
}

const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
  allowBasicFormatting: false,
  maxLength: 0,
  trim: true,
  normalizePersian: true,
};

/**
 * Fields that should NOT be sanitized (e.g., passwords)
 */
const EXCLUDED_FIELDS = new Set([
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
]);

@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  constructor(private readonly options: SanitizeOptions = DEFAULT_SANITIZE_OPTIONS) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    // Sanitize request body
    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizeWithExclusions(request.body);
    }

    // Sanitize query parameters
    if (request.query && typeof request.query === 'object') {
      request.query = this.sanitizeWithExclusions(request.query);
    }

    // Sanitize URL parameters
    if (request.params && typeof request.params === 'object') {
      request.params = this.sanitizeWithExclusions(request.params);
    }

    return next.handle();
  }

  /**
   * Sanitize object while excluding sensitive fields
   */
  private sanitizeWithExclusions<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip excluded fields
      if (EXCLUDED_FIELDS.has(key)) {
        result[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        result[key] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => {
          if (typeof item === 'string') {
            return this.sanitizeString(item);
          }
          if (typeof item === 'object' && item !== null) {
            return this.sanitizeWithExclusions(item as Record<string, unknown>);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeWithExclusions(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Sanitize a single string value
   */
  private sanitizeString(input: string): string {
    let result = input;
    
    // Basic XSS sanitization - escape HTML entities
    result = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    // Trim if enabled
    if (this.options.trim) {
      result = result.trim();
    }
    
    // Normalize Persian characters if enabled
    if (this.options.normalizePersian) {
      // Convert Arabic Yeh to Persian Yeh
      result = result.replace(/í/g, 'í');
      // Convert Arabic Kaf to Persian Kaf
      result = result.replace(/ß/g, '˜');
    }
    
    // Apply max length if set
    if (this.options.maxLength && this.options.maxLength > 0) {
      result = result.substring(0, this.options.maxLength);
    }
    
    return result;
  }
}

/**
 * Factory function to create interceptor with custom options
 */
export function createSanitizationInterceptor(options?: SanitizeOptions) {
  return new SanitizationInterceptor(options);
}

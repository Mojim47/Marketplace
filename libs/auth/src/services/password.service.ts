// ═══════════════════════════════════════════════════════════════════════════
// Password Service - Secure Password Hashing and Validation
// ═══════════════════════════════════════════════════════════════════════════
// Uses Argon2id (OWASP recommended) for password hashing
// Implements NIST SP 800-63B password guidelines
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { AuthConfig } from '../types';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very_strong';
  score: number;
}

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly config: AuthConfig['password'];

  // Common passwords list (top 100 - in production, use a larger list)
  private readonly commonPasswords = new Set([
    'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
    'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', '123123', '654321', 'superman',
    'qazwsx', 'michael', 'football', 'password1', 'password123', 'welcome',
    'jesus', 'ninja', 'mustang', 'password2', 'amanda', 'summer', 'love',
    'ashley1', 'nicole', 'chelsea', 'biteme', 'matthew', 'access', 'yankees',
    'dallas', 'austin', 'thunder', 'taylor', 'matrix', 'william', 'corvette',
  ]);

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<AuthConfig['password']>('auth.password', {
      min_length: 12,
      require_uppercase: true,
      require_lowercase: true,
      require_numbers: true,
      require_special: true,
      bcrypt_rounds: 12,
    });
  }

  /**
   * Hash password using Argon2id
   * Argon2id is the recommended algorithm by OWASP for password hashing
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
    });
  }

  /**
   * Verify password against hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      this.logger.error('Password verification failed', { error });
      return false;
    }
  }

  /**
   * Check if hash needs rehashing (algorithm upgrade)
   */
  async needsRehash(hash: string): Promise<boolean> {
    return argon2.needsRehash(hash, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Validate password against security policy
   * Implements NIST SP 800-63B guidelines
   */
  validate(password: string, userContext?: { email?: string; name?: string }): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length check (NIST recommends minimum 8, we use 12 for enterprise)
    if (password.length < this.config.min_length) {
      errors.push(`رمز عبور باید حداقل ${this.config.min_length} کاراکتر باشد`);
    } else {
      score += Math.min(password.length - this.config.min_length, 10);
    }

    // Maximum length (NIST recommends at least 64)
    if (password.length > 128) {
      errors.push('رمز عبور نباید بیشتر از 128 کاراکتر باشد');
    }

    // Uppercase check
    if (this.config.require_uppercase && !/[A-Z]/.test(password)) {
      errors.push('رمز عبور باید شامل حداقل یک حرف بزرگ باشد');
    } else if (/[A-Z]/.test(password)) {
      score += 5;
    }

    // Lowercase check
    if (this.config.require_lowercase && !/[a-z]/.test(password)) {
      errors.push('رمز عبور باید شامل حداقل یک حرف کوچک باشد');
    } else if (/[a-z]/.test(password)) {
      score += 5;
    }

    // Number check
    if (this.config.require_numbers && !/\d/.test(password)) {
      errors.push('رمز عبور باید شامل حداقل یک عدد باشد');
    } else if (/\d/.test(password)) {
      score += 5;
    }

    // Special character check
    if (this.config.require_special && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('رمز عبور باید شامل حداقل یک کاراکتر خاص باشد');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 10;
    }

    // Common password check
    if (this.commonPasswords.has(password.toLowerCase())) {
      errors.push('این رمز عبور بسیار رایج است و قابل استفاده نیست');
      score = 0;
    }

    // Sequential characters check
    if (this.hasSequentialChars(password)) {
      errors.push('رمز عبور نباید شامل کاراکترهای متوالی باشد (مثل abc یا 123)');
      score -= 10;
    }

    // Repeated characters check
    if (this.hasRepeatedChars(password)) {
      errors.push('رمز عبور نباید شامل کاراکترهای تکراری پشت سر هم باشد');
      score -= 5;
    }

    // User context check (email, name in password)
    if (userContext) {
      const lowerPassword = password.toLowerCase();
      if (userContext.email) {
        const emailParts = userContext.email.toLowerCase().split('@')[0];
        if (lowerPassword.includes(emailParts)) {
          errors.push('رمز عبور نباید شامل ایمیل شما باشد');
          score -= 15;
        }
      }
      if (userContext.name && lowerPassword.includes(userContext.name.toLowerCase())) {
        errors.push('رمز عبور نباید شامل نام شما باشد');
        score -= 10;
      }
    }

    // Entropy bonus
    const uniqueChars = new Set(password).size;
    score += Math.floor(uniqueChars / 3);

    // Normalize score
    score = Math.max(0, Math.min(100, score));

    // Determine strength
    let strength: PasswordValidationResult['strength'];
    if (score < 25) strength = 'weak';
    else if (score < 50) strength = 'fair';
    else if (score < 75) strength = 'strong';
    else strength = 'very_strong';

    return {
      valid: errors.length === 0,
      errors,
      strength,
      score,
    };
  }

  /**
   * Check for sequential characters (abc, 123, etc.)
   */
  private hasSequentialChars(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    const lower = password.toLowerCase();
    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - 3; i++) {
        const forward = seq.substring(i, i + 3);
        const backward = forward.split('').reverse().join('');
        if (lower.includes(forward) || lower.includes(backward)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check for repeated characters (aaa, 111, etc.)
   */
  private hasRepeatedChars(password: string): boolean {
    return /(.)\1{2,}/.test(password);
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + special;

    let password = '';
    
    // Ensure at least one of each required type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

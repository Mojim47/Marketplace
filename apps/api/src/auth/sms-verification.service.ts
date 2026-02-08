/**
 * SMS Verification Service for NextGen Marketplace
 * 
 * Integrates with KavehNegar SMS service for:
 * - Registration verification
 * - Password recovery
 * - Mobile verification
 * 
 * Features:
 * - OTP generation and validation
 * - Rate limiting for SMS sending
 * - Retry mechanism (up to 3 attempts)
 * - Code expiration (2 minutes)
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomInt } from 'crypto';

/**
 * SMS Verification Configuration
 */
export const SMS_CONFIG = {
  /** OTP code length */
  CODE_LENGTH: 4,
  
  /** Code expiration time in seconds */
  CODE_EXPIRY_SECONDS: 120, // 2 minutes
  
  /** Minimum time between SMS sends (seconds) */
  RESEND_COOLDOWN_SECONDS: 60, // 1 minute
  
  /** Maximum verification attempts */
  MAX_ATTEMPTS: 3,
  
  /** Maximum SMS sends per mobile per hour */
  MAX_SENDS_PER_HOUR: 5,
};

export type SMSPurpose = 'login' | 'register' | 'forgot_password' | 'verify_mobile';

export interface VerificationResult {
  success: boolean;
  message: string;
  expiresIn?: number;
  remainingAttempts?: number;
}

@Injectable()
export class SMSVerificationService {
  private readonly logger = new Logger(SMSVerificationService.name);
  
  // In-memory store for verification codes (in production, use Redis)
  private readonly verificationCodes: Map<string, {
    code: string;
    expiresAt: Date;
    attempts: number;
    purpose: SMSPurpose;
  }> = new Map();

  // Track SMS sends for rate limiting
  private readonly smsSendHistory: Map<string, Date[]> = new Map();

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate a random OTP code
   */
  private generateOTP(): string {
    const min = Math.pow(10, SMS_CONFIG.CODE_LENGTH - 1);
    const max = Math.pow(10, SMS_CONFIG.CODE_LENGTH) - 1;
    return randomInt(min, max).toString();
  }

  /**
   * Check if mobile can receive SMS (rate limiting)
   */
  private canSendSMS(mobile: string): { allowed: boolean; waitSeconds?: number } {
    const history = this.smsSendHistory.get(mobile) || [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Filter to last hour
    const recentSends = history.filter(date => date > oneHourAgo);
    this.smsSendHistory.set(mobile, recentSends);

    // Check hourly limit
    if (recentSends.length >= SMS_CONFIG.MAX_SENDS_PER_HOUR) {
      const oldestSend = recentSends[0];
      const waitSeconds = Math.ceil((oldestSend.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000);
      return { allowed: false, waitSeconds };
    }

    // Check cooldown
    if (recentSends.length > 0) {
      const lastSend = recentSends[recentSends.length - 1];
      const secondsSinceLastSend = (now.getTime() - lastSend.getTime()) / 1000;
      
      if (secondsSinceLastSend < SMS_CONFIG.RESEND_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(SMS_CONFIG.RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
        return { allowed: false, waitSeconds };
      }
    }

    return { allowed: true };
  }

  /**
   * Record SMS send for rate limiting
   */
  private recordSMSSend(mobile: string): void {
    const history = this.smsSendHistory.get(mobile) || [];
    history.push(new Date());
    this.smsSendHistory.set(mobile, history);
  }

  /**
   * Send verification code via SMS
   * Requirements: 5.1, 5.2, 5.3
   */
  async sendVerificationCode(
    mobile: string,
    purpose: SMSPurpose = 'verify_mobile',
  ): Promise<VerificationResult> {
    // Validate mobile format
    if (!/^09\d{9}$/.test(mobile)) {
      throw new BadRequestException('‘„«—Â „Ê»«Ì· ‰«„⁄ »— «” ');
    }

    // Check rate limiting
    const rateCheck = this.canSendSMS(mobile);
    if (!rateCheck.allowed) {
      return {
        success: false,
        message: `·ÿ›« ${rateCheck.waitSeconds} À«‰ÌÂ œÌê—  ·«‘ ò‰Ìœ`,
        expiresIn: rateCheck.waitSeconds,
      };
    }

    // Generate OTP
    const code = this.generateOTP();
    const expiresAt = new Date(Date.now() + SMS_CONFIG.CODE_EXPIRY_SECONDS * 1000);

    // Store verification code
    const key = `${mobile}:${purpose}`;
    this.verificationCodes.set(key, {
      code,
      expiresAt,
      attempts: 0,
      purpose,
    });

    // Record send for rate limiting
    this.recordSMSSend(mobile);

    // Try to send SMS via KavehNegar
    try {
      await this.sendSMSWithRetry(mobile, code, purpose);
      
      this.logger.log(`Verification code sent to ${mobile} for ${purpose}`);
      
      return {
        success: true,
        message: 'òœ  «ÌÌœ «—”«· ‘œ',
        expiresIn: SMS_CONFIG.CODE_EXPIRY_SECONDS,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${mobile}: ${error.message}`);
      
      // Remove the stored code since SMS failed
      this.verificationCodes.delete(key);
      
      return {
        success: false,
        message: 'Œÿ« œ— «—”«· ÅÌ«„ò. ·ÿ›« œÊ»«—Â  ·«‘ ò‰Ìœ',
      };
    }
  }

  /**
   * Send SMS with retry mechanism
   * Requirements: 5.4 - Retry up to 3 times
   */
  private async sendSMSWithRetry(
    mobile: string,
    code: string,
    purpose: SMSPurpose,
    attempt: number = 1,
  ): Promise<void> {
    const maxRetries = 3;
    
    try {
      // In production, use KavehNegar service
      // For now, log the code (in development) or use injected SMS service
      if (process.env.NODE_ENV === 'production' && process.env.KAVEHNEGAR_API_KEY) {
        // Dynamic import to avoid issues when API key is not set
        const axios = await import('axios');
        const apiKey = process.env.KAVEHNEGAR_API_KEY;
        const sender = process.env.KAVEHNEGAR_SENDER || '10004346';
        
        const message = this.getMessageTemplate(code, purpose);
        
        await axios.default.post(
          `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`,
          null,
          {
            params: {
              receptor: mobile,
              message,
              sender,
            },
            timeout: 10000,
          }
        );
      } else {
        // Development mode - log the code
        this.logger.warn(`[DEV MODE] SMS Code for ${mobile}: ${code} (purpose: ${purpose})`);
      }
    } catch (error) {
      if (attempt < maxRetries) {
        this.logger.warn(`SMS send attempt ${attempt} failed, retrying...`);
        // Exponential backoff: 1s, 2s, 4s
        await this.delay(1000 * Math.pow(2, attempt - 1));
        return this.sendSMSWithRetry(mobile, code, purpose, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Get SMS message template based on purpose
   */
  private getMessageTemplate(code: string, purpose: SMSPurpose): string {
    const templates: Record<SMSPurpose, string> = {
      login: `òœ Ê—Êœ ‘„« »Â ‰ò” ùÃ‰ „«—ò : ${code}\n«Ì‰ òœ  « 2 œﬁÌﬁÂ «⁄ »«— œ«—œ.`,
      register: `òœ  «ÌÌœ À» ù‰«„ œ— ‰ò” ùÃ‰ „«—ò : ${code}\n«Ì‰ òœ  « 2 œﬁÌﬁÂ «⁄ »«— œ«—œ.`,
      forgot_password: `òœ »«“Ì«»Ì —„“ ⁄»Ê—: ${code}\n«Ì‰ òœ  « 2 œﬁÌﬁÂ «⁄ »«— œ«—œ.`,
      verify_mobile: `òœ  «ÌÌœ „Ê»«Ì·: ${code}\n«Ì‰ òœ  « 2 œﬁÌﬁÂ «⁄ »«— œ«—œ.`,
    };
    return templates[purpose];
  }

  /**
   * Verify SMS code
   */
  async verifyCode(
    mobile: string,
    code: string,
    purpose: SMSPurpose = 'verify_mobile',
  ): Promise<VerificationResult> {
    const key = `${mobile}:${purpose}`;
    const stored = this.verificationCodes.get(key);

    if (!stored) {
      return {
        success: false,
        message: 'òœ  «ÌÌœ Ì«›  ‰‘œ. ·ÿ›« òœ ÃœÌœ œ—ŒÊ«”  ò‰Ìœ',
      };
    }

    // Check expiration
    if (new Date() > stored.expiresAt) {
      this.verificationCodes.delete(key);
      return {
        success: false,
        message: 'òœ  «ÌÌœ „‰ﬁ÷Ì ‘œÂ «” . ·ÿ›« òœ ÃœÌœ œ—ŒÊ«”  ò‰Ìœ',
      };
    }

    // Check attempts
    if (stored.attempts >= SMS_CONFIG.MAX_ATTEMPTS) {
      this.verificationCodes.delete(key);
      return {
        success: false,
        message: ' ⁄œ«œ  ·«‘ùÂ« »Ì‘ «“ Õœ „Ã«“ «” . ·ÿ›« òœ ÃœÌœ œ—ŒÊ«”  ò‰Ìœ',
      };
    }

    // Verify code
    if (stored.code !== code) {
      stored.attempts++;
      const remainingAttempts = SMS_CONFIG.MAX_ATTEMPTS - stored.attempts;
      
      return {
        success: false,
        message: `òœ  «ÌÌœ ‰«œ—”  «” . ${remainingAttempts}  ·«‘ »«ﬁÌù„«‰œÂ`,
        remainingAttempts,
      };
    }

    // Success - remove the code
    this.verificationCodes.delete(key);
    
    this.logger.log(`Verification code verified for ${mobile}`);
    
    return {
      success: true,
      message: 'òœ  «ÌÌœ ’ÕÌÕ «” ',
    };
  }

  /**
   * Send registration verification code
   * Requirements: 5.1
   */
  async sendRegistrationCode(mobile: string): Promise<VerificationResult> {
    // Check if mobile is already registered
    const existingUser = await this.prisma.user.findFirst({
      where: { mobile },
    });

    if (existingUser) {
      throw new ConflictException('«Ì‰ ‘„«—Â „Ê»«Ì· ﬁ»·« À»  ‘œÂ «” ');
    }

    return this.sendVerificationCode(mobile, 'register');
  }

  /**
   * Send password recovery code
   * Requirements: 5.2
   */
  async sendPasswordRecoveryCode(mobile: string): Promise<VerificationResult> {
    // Check if mobile exists
    const user = await this.prisma.user.findFirst({
      where: { mobile },
    });

    if (!user) {
      // Don't reveal if mobile exists or not for security
      return {
        success: true,
        message: '«ê— «Ì‰ ‘„«—Â œ— ”Ì” „ À»  ‘œÂ »«‘œ° òœ »«“Ì«»Ì «—”«· ŒÊ«Âœ ‘œ',
        expiresIn: SMS_CONFIG.CODE_EXPIRY_SECONDS,
      };
    }

    return this.sendVerificationCode(mobile, 'forgot_password');
  }

  /**
   * Send mobile verification code for existing user
   * Requirements: 5.3
   */
  async sendMobileVerificationCode(userId: string, mobile: string): Promise<VerificationResult> {
    // Check if mobile is already used by another user
    const existingUser = await this.prisma.user.findFirst({
      where: { 
        mobile,
        NOT: { id: userId },
      },
    });

    if (existingUser) {
      throw new ConflictException('«Ì‰ ‘„«—Â „Ê»«Ì·  Ê”ÿ ò«—»— œÌê—Ì «” ›«œÂ ‘œÂ «” ');
    }

    return this.sendVerificationCode(mobile, 'verify_mobile');
  }

  /**
   * Verify and update user mobile
   */
  async verifyAndUpdateMobile(userId: string, mobile: string, code: string): Promise<VerificationResult> {
    const result = await this.verifyCode(mobile, code, 'verify_mobile');
    
    if (!result.success) {
      return result;
    }

    // Update user mobile
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        mobile,
        mobileVerifiedAt: new Date(),
      },
    });

    return {
      success: true,
      message: '‘„«—Â „Ê»«Ì· »« „Ê›ﬁÌ   «ÌÌœ ‘œ',
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up expired codes (call periodically)
   */
  cleanupExpiredCodes(): void {
    const now = new Date();
    for (const [key, value] of this.verificationCodes.entries()) {
      if (now > value.expiresAt) {
        this.verificationCodes.delete(key);
      }
    }
  }
}

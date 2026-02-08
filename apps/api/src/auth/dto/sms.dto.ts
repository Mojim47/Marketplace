import { IsString, Matches, IsOptional, Length, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Purpose of SMS verification
 */
export enum SMSVerificationPurpose {
  REGISTER = 'register',
  LOGIN = 'login',
  FORGOT_PASSWORD = 'forgot_password',
  VERIFY_MOBILE = 'verify_mobile',
}

/**
 * DTO for sending verification code
 */
export class SendVerificationCodeDto {
  @ApiProperty({ example: '09123456789', description: '‘„«—Â „Ê»«Ì· «Ì—«‰Ì' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '‘„«—Â „Ê»«Ì· ‰«„⁄ »— «” . ›—„  ’ÕÌÕ: 09xxxxxxxxx' })
  mobile: string;

  @ApiPropertyOptional({ 
    enum: SMSVerificationPurpose, 
    default: SMSVerificationPurpose.VERIFY_MOBILE,
    description: 'Âœ› «—”«· òœ' 
  })
  @IsOptional()
  @IsEnum(SMSVerificationPurpose)
  purpose?: SMSVerificationPurpose;
}

/**
 * DTO for verifying SMS code
 */
export class VerifySMSCodeDto {
  @ApiProperty({ example: '09123456789', description: '‘„«—Â „Ê»«Ì· «Ì—«‰Ì' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '‘„«—Â „Ê»«Ì· ‰«„⁄ »— «” ' })
  mobile: string;

  @ApiProperty({ example: '1234', description: 'òœ  «ÌÌœ 4 —ﬁ„Ì' })
  @IsString()
  @Length(4, 4, { message: 'òœ  «ÌÌœ »«Ìœ 4 —ﬁ„ »«‘œ' })
  code: string;
}

/**
 * DTO for forgot password request
 */
export class ForgotPasswordDto {
  @ApiProperty({ example: '09123456789', description: '‘„«—Â „Ê»«Ì· À»  ‘œÂ' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '‘„«—Â „Ê»«Ì· ‰«„⁄ »— «” ' })
  mobile: string;
}

/**
 * DTO for reset password with SMS code
 */
export class ResetPasswordDto {
  @ApiProperty({ example: '09123456789', description: '‘„«—Â „Ê»«Ì·' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '‘„«—Â „Ê»«Ì· ‰«„⁄ »— «” ' })
  mobile: string;

  @ApiProperty({ example: '1234', description: 'òœ  «ÌÌœ œ—Ì«› Ì' })
  @IsString()
  @Length(4, 4, { message: 'òœ  «ÌÌœ »«Ìœ 4 —ﬁ„ »«‘œ' })
  code: string;

  @ApiProperty({ example: 'NewPassword@123', description: '—„“ ⁄»Ê— ÃœÌœ' })
  @IsString()
  @Length(8, 100, { message: '—„“ ⁄»Ê— »«Ìœ Õœ«ﬁ· 8 ò«—«ò — »«‘œ' })
  newPassword: string;
}

/**
 * Response DTO for SMS operations
 */
export class SMSResponseDto {
  @ApiProperty({ description: '¬Ì« ⁄„·Ì«  „Ê›ﬁ »Êœ' })
  success: boolean;

  @ApiProperty({ description: 'ÅÌ«„ ‰ ÌÃÂ' })
  message: string;

  @ApiPropertyOptional({ description: '“„«‰ «‰ﬁ÷«Ì òœ (À«‰ÌÂ)' })
  expiresIn?: number;
}

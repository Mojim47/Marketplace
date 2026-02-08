import { IsString, IsOptional, Length, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for enabling 2FA - returns QR code and backup codes
 */
export class Enable2FAResponseDto {
  @ApiProperty({ description: 'Base32 encoded secret for manual entry' })
  secret: string;

  @ApiProperty({ description: 'OTPAuth URL for QR code generation' })
  otpauthUrl: string;

  @ApiProperty({ description: 'Backup codes for account recovery', type: [String] })
  backupCodes: string[];
}

/**
 * DTO for verifying TOTP code to complete 2FA setup
 */
export class Verify2FADto {
  @ApiProperty({ example: '123456', description: 'òœ 6 —ﬁ„Ì «“ «Å·ÌòÌ‘‰ «Õ—«“ ÂÊÌ ' })
  @IsString()
  @Length(6, 6, { message: 'òœ »«Ìœ 6 —ﬁ„ »«‘œ' })
  code: string;
}

/**
 * DTO for disabling 2FA
 */
export class Disable2FADto {
  @ApiProperty({ example: 'password123', description: '—„“ ⁄»Ê— ›⁄·Ì »—«Ì  «ÌÌœ' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456', description: 'òœ 2FA (œ— ’Ê—  ›⁄«· »Êœ‰)' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

/**
 * DTO for verifying backup code
 */
export class VerifyBackupCodeDto {
  @ApiProperty({ example: 'ABCD1234', description: 'òœ Å‘ Ì»«‰ 8 ò«—«ò —Ì' })
  @IsString()
  @Length(8, 8, { message: 'òœ Å‘ Ì»«‰ »«Ìœ 8 ò«—«ò — »«‘œ' })
  backupCode: string;
}

/**
 * Response DTO for 2FA status
 */
export class TwoFactorStatusDto {
  @ApiProperty({ description: '¬Ì« 2FA ›⁄«· «” ' })
  enabled: boolean;

  @ApiProperty({ description: ' ⁄œ«œ òœÂ«Ì Å‘ Ì»«‰ »«ﬁÌù„«‰œÂ' })
  remainingBackupCodes: number;
}

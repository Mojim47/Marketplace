import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

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
  @ApiProperty({ example: '123456', description: '�� 6 ���� �� ǁ����� ����� ����' })
  @IsString()
  @Length(6, 6, { message: '�� ���� 6 ��� ����' })
  code: string;
}

/**
 * DTO for disabling 2FA
 */
export class Disable2FADto {
  @ApiProperty({ example: 'password123', description: '��� ���� ���� ���� �����' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456', description: '�� 2FA (�� ���� ���� ����)' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

/**
 * DTO for verifying backup code
 */
export class VerifyBackupCodeDto {
  @ApiProperty({ example: 'ABCD1234', description: '�� ������� 8 ���ǘ���' })
  @IsString()
  @Length(8, 8, { message: '�� ������� ���� 8 ���ǘ�� ����' })
  backupCode: string;
}

/**
 * Response DTO for 2FA status
 */
export class TwoFactorStatusDto {
  @ApiProperty({ description: '��� 2FA ���� ���' })
  enabled: boolean;

  @ApiProperty({ description: '����� ����� ������� ���������' })
  remainingBackupCodes: number;
}

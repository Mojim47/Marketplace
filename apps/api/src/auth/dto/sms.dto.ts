import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

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
  @ApiProperty({ example: '09123456789', description: '����� ������ ������' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '����� ������ ������� ���. ���� ����: 09xxxxxxxxx' })
  mobile: string;

  @ApiPropertyOptional({
    enum: SMSVerificationPurpose,
    default: SMSVerificationPurpose.VERIFY_MOBILE,
    description: '��� ����� ��',
  })
  @IsOptional()
  @IsEnum(SMSVerificationPurpose)
  purpose?: SMSVerificationPurpose;
}

/**
 * DTO for verifying SMS code
 */
export class VerifySMSCodeDto {
  @ApiProperty({ example: '09123456789', description: '����� ������ ������' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '����� ������ ������� ���' })
  mobile: string;

  @ApiProperty({ example: '1234', description: '�� ����� 4 ����' })
  @IsString()
  @Length(4, 4, { message: '�� ����� ���� 4 ��� ����' })
  code: string;
}

/**
 * DTO for forgot password request
 */
export class ForgotPasswordDto {
  @ApiProperty({ example: '09123456789', description: '����� ������ ��� ���' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '����� ������ ������� ���' })
  mobile: string;
}

/**
 * DTO for reset password with SMS code
 */
export class ResetPasswordDto {
  @ApiProperty({ example: '09123456789', description: '����� ������' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: '����� ������ ������� ���' })
  mobile: string;

  @ApiProperty({ example: '1234', description: '�� ����� �������' })
  @IsString()
  @Length(4, 4, { message: '�� ����� ���� 4 ��� ����' })
  code: string;

  @ApiProperty({ example: 'NewPassword@123', description: '��� ���� ����' })
  @IsString()
  @Length(8, 100, { message: '��� ���� ���� ����� 8 ���ǘ�� ����' })
  newPassword: string;
}

/**
 * Response DTO for SMS operations
 */
export class SMSResponseDto {
  @ApiProperty({ description: '��� ������ ���� ���' })
  success: boolean;

  @ApiProperty({ description: '���� �����' })
  message: string;

  @ApiPropertyOptional({ description: '���� ������ �� (�����)' })
  expiresIn?: number;
}

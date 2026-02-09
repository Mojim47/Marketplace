import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@nextgen.ir' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@2025!Secure' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456', description: '�� 2FA (�� ���� ���� ����)' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

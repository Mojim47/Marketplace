import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: '09123456789' })
  @IsOptional()
  @IsString()
  @Matches(/^09\d{9}$/)
  mobile?: string;

  @ApiPropertyOptional({ example: 'admin@nextgen.ir' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: 'Admin@2025!Secure' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456', description: '�� 2FA (�� ���� ���� ����)' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

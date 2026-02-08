import { IsEmail, IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@nextgen.ir' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@2025!Secure' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456', description: '˜Ï 2FA (ÏÑ ÕæÑÊ ÝÚÇá ÈæÏä)' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

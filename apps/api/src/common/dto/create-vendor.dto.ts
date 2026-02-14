import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

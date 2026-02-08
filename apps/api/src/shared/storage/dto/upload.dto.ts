/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Storage DTOs
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Data Transfer Objects for storage operations.
 * 
 * @module @nextgen/api/shared/storage
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FileType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  INVOICE = 'invoice',
  AVATAR = 'avatar',
}

export class UploadFileDto {
  @ApiPropertyOptional({ description: '‰«„ ›«Ì· ”›«—‘Ì' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ description: '¬Ì« ›«Ì· ⁄„Ê„Ì «” ø', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '„”Ì— –ŒÌ—Âù”«“Ì' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: '‰Ê⁄ ›«Ì· »—«Ì «⁄ »«—”‰ÃÌ', enum: FileType })
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;
}

export class GetSignedUrlDto {
  @ApiProperty({ description: 'ò·Ìœ ›«Ì· œ— storage' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: '„œ  «⁄ »«— URL »Â À«‰ÌÂ', default: 3600 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(604800) // Max 7 days
  expiresIn?: number;

  @ApiPropertyOptional({ description: '‰«„ bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

export class GetUploadUrlDto {
  @ApiProperty({ description: 'ò·Ìœ ›«Ì· »—«Ì ¬Å·Êœ' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: '„œ  «⁄ »«— URL »Â À«‰ÌÂ', default: 3600 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  expiresIn?: number;

  @ApiPropertyOptional({ description: '‰«„ bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

export class DeleteFileDto {
  @ApiProperty({ description: 'ò·Ìœ ›«Ì· »—«Ì Õ–›' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: '‰«„ bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

export class ListFilesDto {
  @ApiProperty({ description: 'ÅÌ‘Ê‰œ „”Ì— »—«Ì ·Ì”  ›«Ì·ùÂ«' })
  @IsString()
  prefix: string;

  @ApiPropertyOptional({ description: '‰«„ bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

// Response DTOs
export class UploadResultDto {
  @ApiProperty({ description: 'ò·Ìœ ›«Ì· œ— storage' })
  key: string;

  @ApiProperty({ description: 'URL ›«Ì·' })
  url: string;

  @ApiProperty({ description: '‰«„ bucket' })
  bucket: string;

  @ApiProperty({ description: 'ÕÃ„ ›«Ì· »Â »«Ì ' })
  size: number;

  @ApiProperty({ description: 'ETag ›«Ì·' })
  etag: string;
}

export class SignedUrlResultDto {
  @ApiProperty({ description: 'URL «„÷«‘œÂ' })
  url: string;

  @ApiProperty({ description: '“„«‰ «‰ﬁ÷«' })
  expiresAt: Date;
}

export class FileMetadataDto {
  @ApiProperty({ description: 'ò·Ìœ ›«Ì·' })
  key: string;

  @ApiProperty({ description: 'ÕÃ„ ›«Ì· »Â »«Ì ' })
  size: number;

  @ApiProperty({ description: ' «—ÌŒ ¬Œ—Ì‰  €ÌÌ—' })
  lastModified: Date;

  @ApiProperty({ description: '‰Ê⁄ „Õ Ê«' })
  contentType: string;

  @ApiProperty({ description: 'ETag ›«Ì·' })
  etag: string;
}

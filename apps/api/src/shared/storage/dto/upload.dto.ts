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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum FileType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  INVOICE = 'invoice',
  AVATAR = 'avatar',
}

export class UploadFileDto {
  @ApiPropertyOptional({ description: '��� ���� ������' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ description: '��� ���� ����� ��ʿ', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '���� ���������' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: '��� ���� ���� ����������', enum: FileType })
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;
}

export class GetSignedUrlDto {
  @ApiProperty({ description: '���� ���� �� storage' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: '��� ������ URL �� �����', default: 3600 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(604800) // Max 7 days
  expiresIn?: number;

  @ApiPropertyOptional({ description: '��� bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

export class GetUploadUrlDto {
  @ApiProperty({ description: '���� ���� ���� ���' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: '��� ������ URL �� �����', default: 3600 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  expiresIn?: number;

  @ApiPropertyOptional({ description: '��� bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

export class DeleteFileDto {
  @ApiProperty({ description: '���� ���� ���� ���' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: '��� bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

export class ListFilesDto {
  @ApiProperty({ description: '������ ���� ���� ���� ������' })
  @IsString()
  prefix: string;

  @ApiPropertyOptional({ description: '��� bucket' })
  @IsOptional()
  @IsString()
  bucket?: string;
}

// Response DTOs
export class UploadResultDto {
  @ApiProperty({ description: '���� ���� �� storage' })
  key: string;

  @ApiProperty({ description: 'URL ����' })
  url: string;

  @ApiProperty({ description: '��� bucket' })
  bucket: string;

  @ApiProperty({ description: '��� ���� �� ����' })
  size: number;

  @ApiProperty({ description: 'ETag ����' })
  etag: string;
}

export class SignedUrlResultDto {
  @ApiProperty({ description: 'URL �������' })
  url: string;

  @ApiProperty({ description: '���� �����' })
  expiresAt: Date;
}

export class FileMetadataDto {
  @ApiProperty({ description: '���� ����' })
  key: string;

  @ApiProperty({ description: '��� ���� �� ����' })
  size: number;

  @ApiProperty({ description: '����� ����� �����' })
  lastModified: Date;

  @ApiProperty({ description: '��� �����' })
  contentType: string;

  @ApiProperty({ description: 'ETag ����' })
  etag: string;
}

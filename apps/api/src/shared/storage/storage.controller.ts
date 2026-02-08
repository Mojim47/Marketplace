/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Storage Controller
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * REST API endpoints for file storage operations.
 * 
 * Features:
 * - File upload with validation
 * - Presigned URL generation
 * - File deletion
 * - File listing
 * 
 * @module @nextgen/api/shared/storage
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Inject,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

import { StorageService, UploadFile } from '@nextgen/storage';
import { STORAGE_TOKENS } from './tokens';
import {
  UploadFileDto,
  GetSignedUrlDto,
  GetUploadUrlDto,
  DeleteFileDto,
  ListFilesDto,
  UploadResultDto,
  SignedUrlResultDto,
  FileMetadataDto,
  FileType,
} from './dto';

// Maximum file sizes by type (in bytes)
const MAX_FILE_SIZES: Record<FileType, number> = {
  [FileType.IMAGE]: 10 * 1024 * 1024, // 10MB
  [FileType.DOCUMENT]: 50 * 1024 * 1024, // 50MB
  [FileType.INVOICE]: 20 * 1024 * 1024, // 20MB
  [FileType.AVATAR]: 5 * 1024 * 1024, // 5MB
};

// Allowed MIME types by file type
const ALLOWED_MIME_TYPES: Record<FileType, string[]> = {
  [FileType.IMAGE]: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  [FileType.DOCUMENT]: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  [FileType.INVOICE]: ['application/pdf'],
  [FileType.AVATAR]: ['image/jpeg', 'image/png', 'image/webp'],
};

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(
    @Inject(STORAGE_TOKENS.STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  /**
   * ¬Å·Êœ ›«Ì·
   * Requirements: 6.1, 6.3
   */
  @Post('upload')
  @ApiOperation({ summary: '¬Å·Êœ ›«Ì·' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        isPublic: {
          type: 'boolean',
          default: false,
        },
        path: {
          type: 'string',
        },
        fileType: {
          type: 'string',
          enum: Object.values(FileType),
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '›«Ì· »« „Ê›ﬁÌ  ¬Å·Êœ ‘œ', type: UploadResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ): Promise<UploadResultDto> {
    if (!file) {
      throw new BadRequestException('›«Ì·Ì «‰ Œ«» ‰‘œÂ «” ');
    }

    // Validate file type if specified
    if (dto.fileType) {
      const maxSize = MAX_FILE_SIZES[dto.fileType];
      const allowedTypes = ALLOWED_MIME_TYPES[dto.fileType];

      if (file.size > maxSize) {
        throw new BadRequestException(
          `ÕÃ„ ›«Ì· »Ì‘ «“ Õœ „Ã«“ «” . Õœ«òÀ— ${maxSize / 1024 / 1024}MB`,
        );
      }

      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `‰Ê⁄ ›«Ì· „Ã«“ ‰Ì” . «‰Ê«⁄ „Ã«“: ${allowedTypes.join(', ')}`,
        );
      }
    }

    const uploadFile: UploadFile = {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };

    const result = await this.storageService.upload(uploadFile, {
      path: dto.path,
      acl: dto.isPublic ? 'public-read' : 'private',
    });

    return result;
  }

  /**
   * ¬Å·Êœ ç‰œ ›«Ì·
   * Requirements: 6.1, 6.3
   */
  @Post('upload/multiple')
  @ApiOperation({ summary: '¬Å·Êœ ç‰œ ›«Ì·' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        isPublic: {
          type: 'boolean',
          default: false,
        },
        path: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '›«Ì·ùÂ« »« „Ê›ﬁÌ  ¬Å·Êœ ‘œ‰œ', type: [UploadResultDto] })
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadFileDto,
  ): Promise<UploadResultDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('›«Ì·Ì «‰ Œ«» ‰‘œÂ «” ');
    }

    const results: UploadResultDto[] = [];

    for (const file of files) {
      const uploadFile: UploadFile = {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };

      const result = await this.storageService.upload(uploadFile, {
        path: dto.path,
        acl: dto.isPublic ? 'public-read' : 'private',
      });

      results.push(result);
    }

    return results;
  }

  /**
   * œ—Ì«›  URL «„÷«‘œÂ »—«Ì œ«‰·Êœ
   * Requirements: 6.2
   */
  @Post('signed-url')
  @ApiOperation({ summary: 'œ—Ì«›  URL «„÷«‘œÂ »—«Ì œ«‰·Êœ' })
  @ApiResponse({ status: 200, description: 'URL «„÷«‘œÂ', type: SignedUrlResultDto })
  async getSignedUrl(@Body() dto: GetSignedUrlDto): Promise<SignedUrlResultDto> {
    const expiresIn = dto.expiresIn || 3600;
    const url = await this.storageService.getSignedUrl(dto.key, expiresIn, dto.bucket);

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  /**
   * œ—Ì«›  URL «„÷«‘œÂ »—«Ì ¬Å·Êœ „” ﬁÌ„
   * Requirements: 6.3
   */
  @Post('upload-url')
  @ApiOperation({ summary: 'œ—Ì«›  URL «„÷«‘œÂ »—«Ì ¬Å·Êœ „” ﬁÌ„' })
  @ApiResponse({ status: 200, description: 'URL ¬Å·Êœ', type: SignedUrlResultDto })
  async getUploadUrl(@Body() dto: GetUploadUrlDto): Promise<SignedUrlResultDto> {
    const expiresIn = dto.expiresIn || 3600;
    const url = await this.storageService.getUploadUrl(dto.key, expiresIn, dto.bucket);

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  /**
   * Õ–› ›«Ì·
   * Requirements: 6.4
   */
  @Delete('file')
  @ApiOperation({ summary: 'Õ–› ›«Ì·' })
  @ApiResponse({ status: 200, description: '›«Ì· »« „Ê›ﬁÌ  Õ–› ‘œ' })
  async deleteFile(@Body() dto: DeleteFileDto): Promise<{ success: boolean; message: string }> {
    await this.storageService.delete(dto.key, dto.bucket);
    return {
      success: true,
      message: '›«Ì· »« „Ê›ﬁÌ  Õ–› ‘œ',
    };
  }

  /**
   * œ—Ì«›  «ÿ·«⁄«  ›«Ì·
   * Requirements: 6.2
   */
  @Get('metadata/:key')
  @ApiOperation({ summary: 'œ—Ì«›  «ÿ·«⁄«  ›«Ì·' })
  @ApiResponse({ status: 200, description: '«ÿ·«⁄«  ›«Ì·', type: FileMetadataDto })
  async getFileMetadata(
    @Param('key') key: string,
    @Query('bucket') bucket?: string,
  ): Promise<FileMetadataDto> {
    return this.storageService.getMetadata(key, bucket);
  }

  /**
   * »——”Ì ÊÃÊœ ›«Ì·
   * Requirements: 6.2
   */
  @Get('exists/:key')
  @ApiOperation({ summary: '»——”Ì ÊÃÊœ ›«Ì·' })
  @ApiResponse({ status: 200, description: 'Ê÷⁄Ì  ÊÃÊœ ›«Ì·' })
  async checkFileExists(
    @Param('key') key: string,
    @Query('bucket') bucket?: string,
  ): Promise<{ exists: boolean }> {
    const exists = await this.storageService.exists(key, bucket);
    return { exists };
  }

  /**
   * ·Ì”  ›«Ì·ùÂ«
   * Requirements: 6.2
   */
  @Get('list')
  @ApiOperation({ summary: '·Ì”  ›«Ì·ùÂ«' })
  @ApiResponse({ status: 200, description: '·Ì”  ›«Ì·ùÂ«', type: [String] })
  async listFiles(@Query() dto: ListFilesDto): Promise<string[]> {
    return this.storageService.list(dto.prefix, dto.bucket);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage Service - High-Level Storage Operations
// ═══════════════════════════════════════════════════════════════════════════
// Provides convenient methods for common storage operations
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { StorageFactory } from '../factory/storage.factory';
import type {
  FileMetadata,
  IStorageProvider,
  ListOptions,
  ListResult,
  StorageHealthCheck,
  UploadOptions,
} from '../interfaces/storage.interface';

/**
 * File upload result with additional metadata
 */
export interface UploadResult extends FileMetadata {
  /** Generated unique filename */
  filename: string;
  /** Original filename */
  originalName: string;
  /** Public URL if available */
  publicUrl?: string;
}

/**
 * Options for file upload with auto-naming
 */
export interface FileUploadOptions extends UploadOptions {
  /** Preserve original filename */
  preserveFilename?: boolean;
  /** Custom filename (without extension) */
  customFilename?: string;
  /** Directory path within bucket */
  directory?: string;
  /** Generate thumbnail (for images) */
  generateThumbnail?: boolean;
}

/**
 * Storage service providing high-level file operations
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private provider!: IStorageProvider;

  constructor(private readonly factory: StorageFactory) {}

  async onModuleInit(): Promise<void> {
    // Initialize default provider from environment
    try {
      this.provider = this.factory.createFromEnv('STORAGE', 'default');
      await this.provider.ensureBucket();
      this.logger.log(
        `Storage initialized: ${this.provider.providerType} / ${this.provider.bucket}`
      );
    } catch (error) {
      this.logger.warn(`Storage initialization skipped: ${(error as Error).message}`);
    }
  }

  /**
   * Set the active storage provider
   * @param provider - Storage provider instance
   */
  setProvider(provider: IStorageProvider): void {
    this.provider = provider;
  }

  /**
   * Get the active storage provider
   * @returns Current storage provider
   */
  getProvider(): IStorageProvider {
    if (!this.provider) {
      throw new Error('Storage provider not initialized');
    }
    return this.provider;
  }

  /**
   * Upload a file with automatic naming and organization
   * @param data - File content
   * @param originalName - Original filename
   * @param options - Upload options
   * @returns Upload result with metadata
   */
  async uploadFile(
    data: Buffer | NodeJS.ReadableStream,
    originalName: string,
    options?: FileUploadOptions
  ): Promise<UploadResult> {
    const ext = path.extname(originalName).toLowerCase();
    const _baseName = path.basename(originalName, ext);

    // Generate filename
    let filename: string;
    if (options?.preserveFilename) {
      filename = this.sanitizeFilename(originalName);
    } else if (options?.customFilename) {
      filename = `${this.sanitizeFilename(options.customFilename)}${ext}`;
    } else {
      const hash = crypto.randomBytes(8).toString('hex');
      const timestamp = Date.now();
      filename = `${timestamp}-${hash}${ext}`;
    }

    // Build full key with directory
    const directory = options?.directory ? this.sanitizePath(options.directory) : '';
    const key = directory ? `${directory}/${filename}` : filename;

    // Detect content type if not provided
    const contentType = options?.contentType || this.detectContentType(ext);

    // Upload file
    const metadata = await this.provider.upload(key, data, {
      ...options,
      contentType,
    });

    return {
      ...metadata,
      filename,
      originalName,
      publicUrl: this.provider.getPublicUrl(key),
    };
  }

  /**
   * Upload multiple files
   * @param files - Array of file data with names
   * @param options - Upload options
   * @returns Array of upload results
   */
  async uploadFiles(
    files: Array<{ data: Buffer | NodeJS.ReadableStream; name: string }>,
    options?: FileUploadOptions
  ): Promise<UploadResult[]> {
    return Promise.all(files.map((file) => this.uploadFile(file.data, file.name, options)));
  }

  /**
   * Download a file by key
   * @param key - File key
   * @returns File buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    return this.provider.download(key);
  }

  /**
   * Get a readable stream for a file
   * @param key - File key
   * @returns Readable stream
   */
  async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
    return this.provider.getStream(key);
  }

  /**
   * Delete a file
   * @param key - File key
   */
  async deleteFile(key: string): Promise<void> {
    await this.provider.delete(key);
  }

  /**
   * Delete multiple files
   * @param keys - Array of file keys
   * @returns Array of keys that failed to delete
   */
  async deleteFiles(keys: string[]): Promise<string[]> {
    return this.provider.deleteMany(keys);
  }

  /**
   * Check if a file exists
   * @param key - File key
   * @returns True if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  /**
   * Get file metadata
   * @param key - File key
   * @returns File metadata
   */
  async getFileMetadata(key: string): Promise<FileMetadata> {
    return this.provider.getMetadata(key);
  }

  /**
   * List files in a directory
   * @param options - List options
   * @returns List result
   */
  async listFiles(options?: ListOptions): Promise<ListResult> {
    return this.provider.list(options);
  }

  /**
   * List all files in a directory (handles pagination)
   * @param prefix - Directory prefix
   * @returns All files in directory
   */
  async listAllFiles(prefix?: string): Promise<FileMetadata[]> {
    const allFiles: FileMetadata[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.provider.list({
        prefix,
        continuationToken,
        maxKeys: 1000,
      });

      allFiles.push(...result.files);
      continuationToken = result.nextContinuationToken;
    } while (continuationToken);

    return allFiles;
  }

  /**
   * Copy a file
   * @param sourceKey - Source file key
   * @param destinationKey - Destination file key
   * @returns Copied file metadata
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    return this.provider.copy(sourceKey, destinationKey);
  }

  /**
   * Move a file
   * @param sourceKey - Source file key
   * @param destinationKey - Destination file key
   * @returns Moved file metadata
   */
  async moveFile(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    return this.provider.move(sourceKey, destinationKey);
  }

  /**
   * Generate a signed URL for direct access
   * @param key - File key
   * @param expiresIn - Expiration time in seconds (default: 3600)
   * @param method - HTTP method (default: GET)
   * @returns Signed URL
   */
  async getSignedUrl(
    key: string,
    expiresIn = 3600,
    method: 'GET' | 'PUT' | 'DELETE' = 'GET'
  ): Promise<string> {
    return this.provider.getSignedUrl(key, { expiresIn, method });
  }

  /**
   * Generate a signed upload URL
   * @param key - Target file key
   * @param contentType - Expected content type
   * @param expiresIn - Expiration time in seconds (default: 3600)
   * @returns Signed upload URL
   */
  async getSignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    return this.provider.getSignedUrl(key, {
      expiresIn,
      method: 'PUT',
      contentType,
    });
  }

  /**
   * Get public URL for a file
   * @param key - File key
   * @returns Public URL
   */
  getPublicUrl(key: string): string {
    return this.provider.getPublicUrl(key);
  }

  /**
   * Check storage health
   * @returns Health check result
   */
  async healthCheck(): Promise<StorageHealthCheck> {
    return this.provider.healthCheck();
  }

  /**
   * Delete all files in a directory
   * @param prefix - Directory prefix
   * @returns Number of deleted files
   */
  async deleteDirectory(prefix: string): Promise<number> {
    const files = await this.listAllFiles(prefix);
    const keys = files.map((f) => f.key);

    if (keys.length === 0) {
      return 0;
    }

    const failed = await this.provider.deleteMany(keys);
    return keys.length - failed.length;
  }

  /**
   * Get total size of files in a directory
   * @param prefix - Directory prefix
   * @returns Total size in bytes
   */
  async getDirectorySize(prefix?: string): Promise<number> {
    const files = await this.listAllFiles(prefix);
    return files.reduce((total, file) => total + file.size, 0);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  private sanitizePath(pathStr: string): string {
    return pathStr
      .split('/')
      .map((segment) => this.sanitizeFilename(segment))
      .filter((segment) => segment && segment !== '.' && segment !== '..')
      .join('/');
  }

  private detectContentType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',

      // Documents
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Text
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.md': 'text/markdown',

      // Archives
      '.zip': 'application/zip',
      '.rar': 'application/vnd.rar',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',

      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',

      // Video
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',

      // 3D Models (for AR/3D integration)
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.usdz': 'model/vnd.usdz+zip',
      '.obj': 'model/obj',
      '.fbx': 'application/octet-stream',

      // Fonts
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.eot': 'application/vnd.ms-fontobject',
    };

    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
}

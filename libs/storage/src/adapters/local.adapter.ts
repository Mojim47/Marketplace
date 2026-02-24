// ═══════════════════════════════════════════════════════════════════════════
// Local File System Storage Adapter
// ═══════════════════════════════════════════════════════════════════════════
// Development & testing adapter using local file system
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as mime from 'mime-types';
import type {
  CopyOptions,
  DownloadOptions,
  FileMetadata,
  IStorageProvider,
  ListOptions,
  ListResult,
  LocalStorageConfig,
  MultipartUpload,
  SignedUrlOptions,
  StorageHealthCheck,
  UploadOptions,
  UploadedPart,
} from '../interfaces/storage.interface';
import { StorageProviderType } from '../interfaces/storage.interface';

/**
 * Local file system storage adapter
 * Implements IStorageProvider for local development and testing
 */
export class LocalStorageAdapter implements IStorageProvider {
  readonly providerType = StorageProviderType.LOCAL;
  readonly bucket: string;

  private readonly rootDir: string;
  private readonly baseUrl: string;
  private readonly basePath: string;
  private readonly multipartUploads: Map<
    string,
    { parts: Map<number, Buffer>; key: string; initiated: Date }
  > = new Map();

  constructor(config: LocalStorageConfig) {
    this.bucket = config.bucket;
    this.rootDir = path.resolve(config.rootDir);
    this.baseUrl = config.baseUrl || `file://${this.rootDir}`;
    this.basePath = config.basePath || '';
  }

  private getFullPath(key: string): string {
    const normalizedKey = this.basePath ? path.join(this.basePath, key) : key;
    return path.join(this.rootDir, this.bucket, normalizedKey);
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
  }

  private calculateEtag(data: Buffer): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private getContentType(key: string, override?: string): string {
    if (override) {
      return override;
    }
    return mime.lookup(key) || 'application/octet-stream';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  async upload(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<FileMetadata> {
    const fullPath = this.getFullPath(key);
    await this.ensureDir(fullPath);

    let buffer: Buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    await fs.promises.writeFile(fullPath, buffer);

    // Store metadata in a sidecar file
    const metadataPath = `${fullPath}.meta.json`;
    const metadata: Record<string, unknown> = {
      contentType: this.getContentType(key, options?.contentType),
      metadata: options?.metadata || {},
      cacheControl: options?.cacheControl,
      contentDisposition: options?.contentDisposition,
      uploadedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    const stats = await fs.promises.stat(fullPath);
    return {
      key,
      size: stats.size,
      contentType: metadata.contentType as string,
      lastModified: stats.mtime,
      etag: this.calculateEtag(buffer),
      metadata: options?.metadata,
      provider: this.providerType,
      bucket: this.bucket,
    };
  }

  async download(key: string, options?: DownloadOptions): Promise<Buffer> {
    const fullPath = this.getFullPath(key);

    if (!(await this.exists(key))) {
      throw new Error(`File not found: ${key}`);
    }

    const buffer = await fs.promises.readFile(fullPath);

    if (options?.rangeStart !== undefined || options?.rangeEnd !== undefined) {
      const start = options.rangeStart || 0;
      const end = options.rangeEnd !== undefined ? options.rangeEnd + 1 : buffer.length;
      return buffer.subarray(start, end);
    }

    return buffer;
  }

  async getStream(key: string, options?: DownloadOptions): Promise<NodeJS.ReadableStream> {
    const fullPath = this.getFullPath(key);

    if (!(await this.exists(key))) {
      throw new Error(`File not found: ${key}`);
    }

    const streamOptions: { start?: number; end?: number } = {};
    if (options?.rangeStart !== undefined) {
      streamOptions.start = options.rangeStart;
    }
    if (options?.rangeEnd !== undefined) {
      streamOptions.end = options.rangeEnd;
    }

    return fs.createReadStream(fullPath, streamOptions);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    const metadataPath = `${fullPath}.meta.json`;

    try {
      await fs.promises.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      await fs.promises.unlink(metadataPath);
    } catch {
      // Ignore metadata file not found
    }
  }

  async deleteMany(keys: string[]): Promise<string[]> {
    const failed: string[] = [];

    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.delete(key);
        } catch {
          failed.push(key);
        }
      })
    );

    return failed;
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const fullPath = this.getFullPath(key);

    if (!(await this.exists(key))) {
      throw new Error(`File not found: ${key}`);
    }

    const stats = await fs.promises.stat(fullPath);
    const buffer = await fs.promises.readFile(fullPath);

    let storedMetadata: Record<string, unknown> = {};
    const metadataPath = `${fullPath}.meta.json`;
    try {
      const metaContent = await fs.promises.readFile(metadataPath, 'utf-8');
      storedMetadata = JSON.parse(metaContent);
    } catch {
      // No metadata file
    }

    return {
      key,
      size: stats.size,
      contentType: (storedMetadata.contentType as string) || this.getContentType(key),
      lastModified: stats.mtime,
      etag: this.calculateEtag(buffer),
      metadata: storedMetadata.metadata as Record<string, string> | undefined,
      provider: this.providerType,
      bucket: this.bucket,
    };
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const bucketPath = path.join(this.rootDir, this.bucket, this.basePath);
    const prefix = options?.prefix || '';
    const delimiter = options?.delimiter;
    const maxKeys = options?.maxKeys || 1000;
    const startAfter = options?.startAfter || '';

    const files: FileMetadata[] = [];
    const prefixes: Set<string> = new Set();

    const walkDir = async (dir: string, relativePath = ''): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.endsWith('.meta.json')) {
            continue;
          }

          const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          const fullEntryPath = path.join(dir, entry.name);

          if (!entryRelativePath.startsWith(prefix)) {
            if (entry.isDirectory() && prefix.startsWith(entryRelativePath)) {
              await walkDir(fullEntryPath, entryRelativePath);
            }
            continue;
          }

          if (startAfter && entryRelativePath <= startAfter) {
            continue;
          }

          if (entry.isDirectory()) {
            if (delimiter) {
              const prefixPath = entryRelativePath + delimiter;
              prefixes.add(prefixPath);
            } else {
              await walkDir(fullEntryPath, entryRelativePath);
            }
          } else if (files.length < maxKeys) {
            const stats = await fs.promises.stat(fullEntryPath);
            const buffer = await fs.promises.readFile(fullEntryPath);

            files.push({
              key: entryRelativePath,
              size: stats.size,
              contentType: this.getContentType(entryRelativePath),
              lastModified: stats.mtime,
              etag: this.calculateEtag(buffer),
              provider: this.providerType,
              bucket: this.bucket,
            });
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    };

    await walkDir(bucketPath);

    // Sort files by key
    files.sort((a, b) => a.key.localeCompare(b.key));

    const isTruncated = files.length > maxKeys;
    const truncatedFiles = files.slice(0, maxKeys);

    return {
      files: truncatedFiles,
      prefixes: Array.from(prefixes).sort(),
      isTruncated,
      nextContinuationToken: isTruncated
        ? truncatedFiles[truncatedFiles.length - 1]?.key
        : undefined,
      keyCount: truncatedFiles.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Advanced Operations
  // ═══════════════════════════════════════════════════════════════════════

  async copy(
    sourceKey: string,
    destinationKey: string,
    options?: CopyOptions
  ): Promise<FileMetadata> {
    const sourceBucket = options?.sourceBucket || this.bucket;
    const sourceFullPath = path.join(this.rootDir, sourceBucket, this.basePath, sourceKey);
    const destFullPath = this.getFullPath(destinationKey);

    if (!fs.existsSync(sourceFullPath)) {
      throw new Error(`Source file not found: ${sourceKey}`);
    }

    await this.ensureDir(destFullPath);
    await fs.promises.copyFile(sourceFullPath, destFullPath);

    // Handle metadata
    const sourceMetaPath = `${sourceFullPath}.meta.json`;
    const destMetaPath = `${destFullPath}.meta.json`;

    if (options?.metadataDirective === 'REPLACE') {
      const metadata = {
        contentType: options.contentType || this.getContentType(destinationKey),
        metadata: options.metadata || {},
        uploadedAt: new Date().toISOString(),
      };
      await fs.promises.writeFile(destMetaPath, JSON.stringify(metadata, null, 2));
    } else {
      try {
        await fs.promises.copyFile(sourceMetaPath, destMetaPath);
      } catch {
        // No source metadata
      }
    }

    return this.getMetadata(destinationKey);
  }

  async move(
    sourceKey: string,
    destinationKey: string,
    options?: CopyOptions
  ): Promise<FileMetadata> {
    const metadata = await this.copy(sourceKey, destinationKey, options);
    await this.delete(sourceKey);
    return metadata;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    // Local storage doesn't support true signed URLs
    // Return a pseudo-signed URL with expiration info encoded
    const expiration = Date.now() + options.expiresIn * 1000;
    const signature = crypto
      .createHmac('sha256', 'local-secret')
      .update(`${key}:${expiration}`)
      .digest('hex');

    const url = new URL(this.getPublicUrl(key));
    url.searchParams.set('expires', expiration.toString());
    url.searchParams.set('signature', signature);

    return url.toString();
  }

  getPublicUrl(key: string): string {
    const normalizedKey = this.basePath ? path.join(this.basePath, key) : key;
    return `${this.baseUrl}/${this.bucket}/${normalizedKey}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Multipart Upload
  // ═══════════════════════════════════════════════════════════════════════

  async initiateMultipartUpload(key: string, _options?: UploadOptions): Promise<MultipartUpload> {
    const uploadId = crypto.randomUUID();

    this.multipartUploads.set(uploadId, {
      parts: new Map(),
      key,
      initiated: new Date(),
    });

    return {
      uploadId,
      key,
      bucket: this.bucket,
      initiated: new Date(),
    };
  }

  async uploadPart(
    uploadId: string,
    key: string,
    partNumber: number,
    data: Buffer
  ): Promise<UploadedPart> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload || upload.key !== key) {
      throw new Error(`Multipart upload not found: ${uploadId}`);
    }

    upload.parts.set(partNumber, data);

    return {
      partNumber,
      etag: this.calculateEtag(data),
      size: data.length,
    };
  }

  async completeMultipartUpload(
    uploadId: string,
    key: string,
    parts: UploadedPart[]
  ): Promise<FileMetadata> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload || upload.key !== key) {
      throw new Error(`Multipart upload not found: ${uploadId}`);
    }

    // Sort parts by part number and concatenate
    const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);
    const buffers: Buffer[] = [];

    for (const part of sortedParts) {
      const partData = upload.parts.get(part.partNumber);
      if (!partData) {
        throw new Error(`Part ${part.partNumber} not found`);
      }
      buffers.push(partData);
    }

    const finalBuffer = Buffer.concat(buffers);
    const metadata = await this.upload(key, finalBuffer);

    this.multipartUploads.delete(uploadId);

    return metadata;
  }

  async abortMultipartUpload(uploadId: string, key: string): Promise<void> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload || upload.key !== key) {
      throw new Error(`Multipart upload not found: ${uploadId}`);
    }

    this.multipartUploads.delete(uploadId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Health & Maintenance
  // ═══════════════════════════════════════════════════════════════════════

  async healthCheck(): Promise<StorageHealthCheck> {
    const startTime = Date.now();

    try {
      const bucketPath = path.join(this.rootDir, this.bucket);
      await fs.promises.access(bucketPath, fs.constants.R_OK | fs.constants.W_OK);

      return {
        healthy: true,
        provider: this.providerType,
        bucket: this.bucket,
        latencyMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.providerType,
        bucket: this.bucket,
        latencyMs: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  async ensureBucket(): Promise<void> {
    const bucketPath = path.join(this.rootDir, this.bucket);
    await fs.promises.mkdir(bucketPath, { recursive: true });
  }
}

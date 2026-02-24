// ═══════════════════════════════════════════════════════════════════════════
// MinIO Storage Adapter
// ═══════════════════════════════════════════════════════════════════════════
// Self-hosted S3-compatible object storage
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import type { Readable } from 'node:stream';
import * as Minio from 'minio';
import type {
  CopyOptions,
  DownloadOptions,
  FileMetadata,
  IStorageProvider,
  ListOptions,
  ListResult,
  MinioStorageConfig,
  MultipartUpload,
  SignedUrlOptions,
  StorageHealthCheck,
  UploadOptions,
  UploadedPart,
} from '../interfaces/storage.interface';
import { StorageProviderType } from '../interfaces/storage.interface';

/**
 * MinIO storage adapter
 * Implements IStorageProvider for MinIO object storage
 */
export class MinioStorageAdapter implements IStorageProvider {
  readonly providerType = StorageProviderType.MINIO;
  readonly bucket: string;

  private readonly client: Minio.Client;
  private readonly basePath: string;
  private readonly endPoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;

  constructor(config: MinioStorageConfig) {
    this.bucket = config.bucket;
    this.basePath = config.basePath || '';
    this.endPoint = config.endPoint;
    this.port = config.port;
    this.useSSL = config.useSSL;

    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });
  }

  private getFullKey(key: string): string {
    return this.basePath ? `${this.basePath}/${key}` : key;
  }

  private stripBasePath(key: string): string {
    if (this.basePath && key.startsWith(`${this.basePath}/`)) {
      return key.slice(this.basePath.length + 1);
    }
    return key;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  async upload(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<FileMetadata> {
    const fullKey = this.getFullKey(key);

    let buffer: Buffer;
    let size: number;

    if (Buffer.isBuffer(data)) {
      buffer = data;
      size = buffer.length;
    } else {
      buffer = await this.streamToBuffer(data as Readable);
      size = buffer.length;
    }

    const metaData: Record<string, string> = {
      'Content-Type': options?.contentType || 'application/octet-stream',
      ...(options?.metadata || {}),
    };

    if (options?.cacheControl) {
      metaData['Cache-Control'] = options.cacheControl;
    }
    if (options?.contentDisposition) {
      metaData['Content-Disposition'] = options.contentDisposition;
    }

    const result = await this.client.putObject(this.bucket, fullKey, buffer, size, metaData);

    return {
      key,
      size,
      contentType: options?.contentType || 'application/octet-stream',
      lastModified: new Date(),
      etag: result.etag,
      metadata: options?.metadata,
      provider: this.providerType,
      bucket: this.bucket,
    };
  }

  async download(key: string, options?: DownloadOptions): Promise<Buffer> {
    const fullKey = this.getFullKey(key);

    const stream = await this.client.getObject(this.bucket, fullKey);
    const buffer = await this.streamToBuffer(stream);

    if (options?.rangeStart !== undefined || options?.rangeEnd !== undefined) {
      const start = options.rangeStart || 0;
      const end = options.rangeEnd !== undefined ? options.rangeEnd + 1 : buffer.length;
      return buffer.subarray(start, end);
    }

    return buffer;
  }

  async getStream(key: string, options?: DownloadOptions): Promise<NodeJS.ReadableStream> {
    const fullKey = this.getFullKey(key);

    if (options?.rangeStart !== undefined || options?.rangeEnd !== undefined) {
      const offset = options.rangeStart || 0;
      const length = options.rangeEnd !== undefined ? options.rangeEnd - offset + 1 : 0; // 0 means read to end

      return this.client.getPartialObject(this.bucket, fullKey, offset, length || undefined);
    }

    return this.client.getObject(this.bucket, fullKey);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.client.removeObject(this.bucket, fullKey);
  }

  async deleteMany(keys: string[]): Promise<string[]> {
    if (keys.length === 0) {
      return [];
    }

    const fullKeys = keys.map((k) => this.getFullKey(k));
    const failed: string[] = [];

    try {
      await this.client.removeObjects(this.bucket, fullKeys);
    } catch (_error) {
      // MinIO doesn't provide detailed error info for batch deletes
      // Return all keys as potentially failed
      return keys;
    }

    return failed;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      await this.client.statObject(this.bucket, fullKey);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const fullKey = this.getFullKey(key);
    const stat = await this.client.statObject(this.bucket, fullKey);

    return {
      key,
      size: stat.size,
      contentType: stat.metaData?.['content-type'] || 'application/octet-stream',
      lastModified: stat.lastModified,
      etag: stat.etag,
      metadata: stat.metaData as Record<string, string>,
      provider: this.providerType,
      bucket: this.bucket,
    };
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const prefix = options?.prefix
      ? this.getFullKey(options.prefix)
      : this.basePath
        ? `${this.basePath}/`
        : '';

    const files: FileMetadata[] = [];
    const prefixes: Set<string> = new Set();
    let keyCount = 0;
    const maxKeys = options?.maxKeys || 1000;

    const stream = this.client.listObjectsV2(
      this.bucket,
      prefix,
      true, // recursive
      options?.startAfter ? this.getFullKey(options.startAfter) : undefined
    );

    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (keyCount >= maxKeys) {
          return;
        }

        if (obj.name) {
          const strippedKey = this.stripBasePath(obj.name);

          if (options?.delimiter) {
            const afterPrefix = strippedKey.slice((options.prefix || '').length);
            const delimiterIndex = afterPrefix.indexOf(options.delimiter);

            if (delimiterIndex !== -1) {
              const commonPrefix = strippedKey.slice(
                0,
                (options.prefix || '').length + delimiterIndex + 1
              );
              prefixes.add(commonPrefix);
              return;
            }
          }

          files.push({
            key: strippedKey,
            size: obj.size,
            contentType: 'application/octet-stream',
            lastModified: obj.lastModified,
            etag: obj.etag,
            provider: this.providerType,
            bucket: this.bucket,
          });
          keyCount++;
        }
      });

      stream.on('error', reject);

      stream.on('end', () => {
        resolve({
          files,
          prefixes: Array.from(prefixes).sort(),
          isTruncated: keyCount >= maxKeys,
          nextContinuationToken: keyCount >= maxKeys ? files[files.length - 1]?.key : undefined,
          keyCount,
        });
      });
    });
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
    const sourceFullKey = this.basePath ? `${this.basePath}/${sourceKey}` : sourceKey;
    const destFullKey = this.getFullKey(destinationKey);

    const conditions = new Minio.CopyConditions();

    await this.client.copyObject(
      this.bucket,
      destFullKey,
      `/${sourceBucket}/${sourceFullKey}`,
      conditions
    );

    // If replacing metadata, update it
    if (options?.metadataDirective === 'REPLACE' && (options.metadata || options.contentType)) {
      const data = await this.download(destinationKey);
      await this.upload(destinationKey, data, {
        contentType: options.contentType,
        metadata: options.metadata,
      });
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
    const fullKey = this.getFullKey(key);

    if (options.method === 'PUT') {
      return this.client.presignedPutObject(this.bucket, fullKey, options.expiresIn);
    }

    // GET is default
    const reqParams: Record<string, string> = {};
    if (options.responseContentDisposition) {
      reqParams['response-content-disposition'] = options.responseContentDisposition;
    }
    if (options.responseContentType) {
      reqParams['response-content-type'] = options.responseContentType;
    }

    return this.client.presignedGetObject(this.bucket, fullKey, options.expiresIn, reqParams);
  }

  getPublicUrl(key: string): string {
    const fullKey = this.getFullKey(key);
    const protocol = this.useSSL ? 'https' : 'http';
    const portPart =
      (this.useSSL && this.port === 443) || (!this.useSSL && this.port === 80)
        ? ''
        : `:${this.port}`;

    return `${protocol}://${this.endPoint}${portPart}/${this.bucket}/${fullKey}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Multipart Upload
  // ═══════════════════════════════════════════════════════════════════════

  private multipartUploads: Map<
    string,
    { parts: Map<number, { etag: string; size: number }>; key: string }
  > = new Map();

  async initiateMultipartUpload(key: string, _options?: UploadOptions): Promise<MultipartUpload> {
    // MinIO SDK doesn't expose multipart upload directly in the same way as S3
    // We'll simulate it by tracking parts and combining them at completion
    const uploadId = crypto.randomUUID();

    this.multipartUploads.set(uploadId, {
      parts: new Map(),
      key,
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

    // Store part temporarily
    const partKey = `${this.getFullKey(key)}.part.${partNumber}`;
    await this.client.putObject(this.bucket, partKey, data, data.length);

    const etag = crypto.createHash('md5').update(data).digest('hex');
    upload.parts.set(partNumber, { etag, size: data.length });

    return {
      partNumber,
      etag,
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

    // Combine all parts
    const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);
    const buffers: Buffer[] = [];

    for (const part of sortedParts) {
      const partKey = `${this.getFullKey(key)}.part.${part.partNumber}`;
      const partData = await this.client.getObject(this.bucket, partKey);
      buffers.push(await this.streamToBuffer(partData));

      // Clean up part
      await this.client.removeObject(this.bucket, partKey);
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

    // Clean up any uploaded parts
    for (const [partNumber] of upload.parts) {
      const partKey = `${this.getFullKey(key)}.part.${partNumber}`;
      try {
        await this.client.removeObject(this.bucket, partKey);
      } catch {
        // Ignore errors during cleanup
      }
    }

    this.multipartUploads.delete(uploadId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Health & Maintenance
  // ═══════════════════════════════════════════════════════════════════════

  async healthCheck(): Promise<StorageHealthCheck> {
    const startTime = Date.now();

    try {
      await this.client.bucketExists(this.bucket);

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
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }
}

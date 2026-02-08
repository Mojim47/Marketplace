// ═══════════════════════════════════════════════════════════════════════════
// AWS S3 Storage Adapter
// ═══════════════════════════════════════════════════════════════════════════
// Production-ready S3 adapter with full feature support
// ═══════════════════════════════════════════════════════════════════════════

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type {
  IStorageProvider,
  FileMetadata,
  UploadOptions,
  DownloadOptions,
  ListOptions,
  ListResult,
  SignedUrlOptions,
  CopyOptions,
  MultipartUpload,
  UploadedPart,
  StorageHealthCheck,
  S3StorageConfig,
} from '../interfaces/storage.interface';
import { StorageProviderType } from '../interfaces/storage.interface';

/**
 * AWS S3 storage adapter
 * Implements IStorageProvider for AWS S3 and S3-compatible services
 */
export class S3StorageAdapter implements IStorageProvider {
  readonly providerType = StorageProviderType.S3;
  readonly bucket: string;
  
  private readonly client: S3Client;
  private readonly region: string;
  private readonly basePath: string;
  private readonly endpoint?: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.basePath = config.basePath || '';
    this.endpoint = config.endpoint;

    this.client = new S3Client({
      region: config.region,
      ...(config.accessKeyId && config.secretAccessKey && {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
      ...(config.endpoint && {
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle ?? true,
      }),
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
    
    let body: Buffer;
    if (Buffer.isBuffer(data)) {
      body = data;
    } else {
      body = await this.streamToBuffer(data as Readable);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: body,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      CacheControl: options?.cacheControl,
      ContentDisposition: options?.contentDisposition,
      ACL: options?.acl,
      ServerSideEncryption: options?.encryption,
      SSEKMSKeyId: options?.kmsKeyId,
      StorageClass: options?.storageClass,
      Tagging: options?.tags
        ? Object.entries(options.tags)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&')
        : undefined,
    });

    const response = await this.client.send(command);

    return {
      key,
      size: body.length,
      contentType: options?.contentType || 'application/octet-stream',
      lastModified: new Date(),
      etag: response.ETag?.replace(/"/g, ''),
      metadata: options?.metadata,
      provider: this.providerType,
      bucket: this.bucket,
    };
  }

  async download(key: string, options?: DownloadOptions): Promise<Buffer> {
    const fullKey = this.getFullKey(key);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Range: options?.rangeStart !== undefined || options?.rangeEnd !== undefined
        ? `bytes=${options?.rangeStart || 0}-${options?.rangeEnd || ''}`
        : undefined,
      IfMatch: options?.ifMatch,
      IfNoneMatch: options?.ifNoneMatch,
      IfModifiedSince: options?.ifModifiedSince,
      IfUnmodifiedSince: options?.ifUnmodifiedSince,
    });

    const response = await this.client.send(command);
    
    if (!response.Body) {
      throw new Error(`Empty response body for key: ${key}`);
    }

    return this.streamToBuffer(response.Body as Readable);
  }

  async getStream(key: string, options?: DownloadOptions): Promise<NodeJS.ReadableStream> {
    const fullKey = this.getFullKey(key);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Range: options?.rangeStart !== undefined || options?.rangeEnd !== undefined
        ? `bytes=${options?.rangeStart || 0}-${options?.rangeEnd || ''}`
        : undefined,
      IfMatch: options?.ifMatch,
      IfNoneMatch: options?.ifNoneMatch,
      IfModifiedSince: options?.ifModifiedSince,
      IfUnmodifiedSince: options?.ifUnmodifiedSince,
    });

    const response = await this.client.send(command);
    
    if (!response.Body) {
      throw new Error(`Empty response body for key: ${key}`);
    }

    return response.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    await this.client.send(command);
  }

  async deleteMany(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];

    const fullKeys = keys.map(k => this.getFullKey(k));
    const failed: string[] = [];

    // S3 allows max 1000 objects per delete request
    const batches: string[][] = [];
    for (let i = 0; i < fullKeys.length; i += 1000) {
      batches.push(fullKeys.slice(i, i + 1000));
    }

    for (const batch of batches) {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: batch.map(Key => ({ Key })),
          Quiet: true,
        },
      });

      const response = await this.client.send(command);
      
      if (response.Errors) {
        for (const error of response.Errors) {
          if (error.Key) {
            failed.push(this.stripBasePath(error.Key));
          }
        }
      }
    }

    return failed;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const fullKey = this.getFullKey(key);

    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    const response = await this.client.send(command);

    return {
      key,
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      lastModified: response.LastModified || new Date(),
      etag: response.ETag?.replace(/"/g, ''),
      metadata: response.Metadata,
      provider: this.providerType,
      bucket: this.bucket,
    };
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const prefix = options?.prefix
      ? this.getFullKey(options.prefix)
      : this.basePath
        ? `${this.basePath}/`
        : undefined;

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: options?.delimiter,
      MaxKeys: options?.maxKeys || 1000,
      ContinuationToken: options?.continuationToken,
      StartAfter: options?.startAfter ? this.getFullKey(options.startAfter) : undefined,
    });

    const response = await this.client.send(command);

    const files: FileMetadata[] = (response.Contents || []).map(obj => ({
      key: this.stripBasePath(obj.Key || ''),
      size: obj.Size || 0,
      contentType: 'application/octet-stream', // S3 list doesn't return content type
      lastModified: obj.LastModified || new Date(),
      etag: obj.ETag?.replace(/"/g, ''),
      provider: this.providerType,
      bucket: this.bucket,
    }));

    const prefixes = (response.CommonPrefixes || [])
      .map(p => this.stripBasePath(p.Prefix || ''))
      .filter(p => p);

    return {
      files,
      prefixes,
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken,
      keyCount: response.KeyCount || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Advanced Operations
  // ═══════════════════════════════════════════════════════════════════════

  async copy(sourceKey: string, destinationKey: string, options?: CopyOptions): Promise<FileMetadata> {
    const sourceBucket = options?.sourceBucket || this.bucket;
    const sourceFullKey = this.basePath ? `${this.basePath}/${sourceKey}` : sourceKey;
    const destFullKey = this.getFullKey(destinationKey);

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      Key: destFullKey,
      CopySource: `${sourceBucket}/${sourceFullKey}`,
      MetadataDirective: options?.metadataDirective,
      Metadata: options?.metadata,
      ContentType: options?.contentType,
      ACL: options?.acl,
    });

    await this.client.send(command);

    return this.getMetadata(destinationKey);
  }

  async move(sourceKey: string, destinationKey: string, options?: CopyOptions): Promise<FileMetadata> {
    const metadata = await this.copy(sourceKey, destinationKey, options);
    await this.delete(sourceKey);
    return metadata;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const fullKey = this.getFullKey(key);

    let command;
    if (options.method === 'PUT') {
      command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        ContentType: options.contentType,
      });
    } else if (options.method === 'DELETE') {
      command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      });
    } else {
      command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        ResponseContentDisposition: options.responseContentDisposition,
        ResponseContentType: options.responseContentType,
      });
    }

    return getSignedUrl(this.client, command, { expiresIn: options.expiresIn });
  }

  getPublicUrl(key: string): string {
    const fullKey = this.getFullKey(key);
    
    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/${fullKey}`;
    }
    
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fullKey}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Multipart Upload
  // ═══════════════════════════════════════════════════════════════════════

  async initiateMultipartUpload(key: string, options?: UploadOptions): Promise<MultipartUpload> {
    const fullKey = this.getFullKey(key);

    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: fullKey,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      CacheControl: options?.cacheControl,
      ContentDisposition: options?.contentDisposition,
      ACL: options?.acl,
      ServerSideEncryption: options?.encryption,
      SSEKMSKeyId: options?.kmsKeyId,
      StorageClass: options?.storageClass,
    });

    const response = await this.client.send(command);

    return {
      uploadId: response.UploadId!,
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
    const fullKey = this.getFullKey(key);

    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: fullKey,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: data,
    });

    const response = await this.client.send(command);

    return {
      partNumber,
      etag: response.ETag!.replace(/"/g, ''),
      size: data.length,
    };
  }

  async completeMultipartUpload(
    uploadId: string,
    key: string,
    parts: UploadedPart[]
  ): Promise<FileMetadata> {
    const fullKey = this.getFullKey(key);

    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: fullKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(p => ({
            PartNumber: p.partNumber,
            ETag: `"${p.etag}"`,
          })),
      },
    });

    await this.client.send(command);

    return this.getMetadata(key);
  }

  async abortMultipartUpload(uploadId: string, key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: fullKey,
      UploadId: uploadId,
    });

    await this.client.send(command);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Health & Maintenance
  // ═══════════════════════════════════════════════════════════════════════

  async healthCheck(): Promise<StorageHealthCheck> {
    const startTime = Date.now();

    try {
      const command = new HeadBucketCommand({
        Bucket: this.bucket,
      });
      await this.client.send(command);

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
    try {
      const headCommand = new HeadBucketCommand({
        Bucket: this.bucket,
      });
      await this.client.send(headCommand);
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        const createCommand = new CreateBucketCommand({
          Bucket: this.bucket,
          ...(this.region !== 'us-east-1' && {
            CreateBucketConfiguration: {
              LocationConstraint: this.region as any,
            },
          }),
        });
        await this.client.send(createCommand);
      } else {
        throw error;
      }
    }
  }
}

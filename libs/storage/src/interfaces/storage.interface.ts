// ═══════════════════════════════════════════════════════════════════════════
// Storage Provider Interface - Vendor Agnostic File Storage
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Supports Local, S3, MinIO, Azure Blob, GCS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Storage provider types supported by the abstraction layer
 */
export enum StorageProviderType {
  LOCAL = 'local',
  S3 = 's3',
  MINIO = 'minio',
  AZURE_BLOB = 'azure-blob',
  GCS = 'gcs',
}

/**
 * File metadata returned from storage operations
 */
export interface FileMetadata {
  /** Unique file key/path in storage */
  key: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the file */
  contentType: string;
  /** Last modified timestamp */
  lastModified: Date;
  /** ETag for cache validation */
  etag?: string;
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Storage provider type */
  provider: StorageProviderType;
  /** Bucket/container name */
  bucket: string;
}

/**
 * Options for uploading files
 */
export interface UploadOptions {
  /** MIME type override */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Cache-Control header */
  cacheControl?: string;
  /** Content-Disposition header */
  contentDisposition?: string;
  /** ACL for the file (provider-specific) */
  acl?: 'private' | 'public-read' | 'public-read-write';
  /** Server-side encryption */
  encryption?: 'AES256' | 'aws:kms';
  /** KMS key ID for encryption */
  kmsKeyId?: string;
  /** Storage class (S3-specific) */
  storageClass?: 'STANDARD' | 'REDUCED_REDUNDANCY' | 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'DEEP_ARCHIVE';
  /** Tags for the file */
  tags?: Record<string, string>;
}

/**
 * Options for downloading files
 */
export interface DownloadOptions {
  /** Range start byte */
  rangeStart?: number;
  /** Range end byte */
  rangeEnd?: number;
  /** If-Match ETag condition */
  ifMatch?: string;
  /** If-None-Match ETag condition */
  ifNoneMatch?: string;
  /** If-Modified-Since condition */
  ifModifiedSince?: Date;
  /** If-Unmodified-Since condition */
  ifUnmodifiedSince?: Date;
}

/**
 * Options for listing files
 */
export interface ListOptions {
  /** Prefix filter */
  prefix?: string;
  /** Delimiter for hierarchical listing */
  delimiter?: string;
  /** Maximum number of results */
  maxKeys?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
  /** Start after this key */
  startAfter?: string;
}

/**
 * Result of listing files
 */
export interface ListResult {
  /** List of file metadata */
  files: FileMetadata[];
  /** Common prefixes (directories) when using delimiter */
  prefixes: string[];
  /** Whether there are more results */
  isTruncated: boolean;
  /** Token for next page */
  nextContinuationToken?: string;
  /** Number of keys returned */
  keyCount: number;
}

/**
 * Options for generating signed URLs
 */
export interface SignedUrlOptions {
  /** Expiration time in seconds */
  expiresIn: number;
  /** HTTP method for the signed URL */
  method?: 'GET' | 'PUT' | 'DELETE';
  /** Content-Type for PUT operations */
  contentType?: string;
  /** Response content-disposition */
  responseContentDisposition?: string;
  /** Response content-type */
  responseContentType?: string;
}

/**
 * Options for copying files
 */
export interface CopyOptions {
  /** Source bucket (defaults to current bucket) */
  sourceBucket?: string;
  /** Metadata directive */
  metadataDirective?: 'COPY' | 'REPLACE';
  /** New metadata if replacing */
  metadata?: Record<string, string>;
  /** New content type if replacing */
  contentType?: string;
  /** ACL for the destination */
  acl?: 'private' | 'public-read' | 'public-read-write';
}

/**
 * Multipart upload session
 */
export interface MultipartUpload {
  /** Upload ID */
  uploadId: string;
  /** File key */
  key: string;
  /** Bucket name */
  bucket: string;
  /** Initiated timestamp */
  initiated: Date;
}

/**
 * Uploaded part information
 */
export interface UploadedPart {
  /** Part number (1-10000) */
  partNumber: number;
  /** ETag of the uploaded part */
  etag: string;
  /** Size of the part in bytes */
  size: number;
}

/**
 * Storage health check result
 */
export interface StorageHealthCheck {
  /** Whether the storage is healthy */
  healthy: boolean;
  /** Provider type */
  provider: StorageProviderType;
  /** Bucket name */
  bucket: string;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Error message if unhealthy */
  error?: string;
  /** Timestamp of the check */
  timestamp: Date;
}

/**
 * Storage provider interface - All adapters must implement this
 */
export interface IStorageProvider {
  /** Provider type identifier */
  readonly providerType: StorageProviderType;
  
  /** Bucket/container name */
  readonly bucket: string;

  // ═══════════════════════════════════════════════════════════════════════
  // Basic Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Upload a file to storage
   * @param key - File path/key in storage
   * @param data - File content as Buffer or Stream
   * @param options - Upload options
   * @returns File metadata after upload
   */
  upload(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<FileMetadata>;

  /**
   * Download a file from storage
   * @param key - File path/key in storage
   * @param options - Download options
   * @returns File content as Buffer
   */
  download(key: string, options?: DownloadOptions): Promise<Buffer>;

  /**
   * Get a readable stream for a file
   * @param key - File path/key in storage
   * @param options - Download options
   * @returns Readable stream
   */
  getStream(key: string, options?: DownloadOptions): Promise<NodeJS.ReadableStream>;

  /**
   * Delete a file from storage
   * @param key - File path/key in storage
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple files from storage
   * @param keys - Array of file paths/keys
   * @returns Array of keys that failed to delete
   */
  deleteMany(keys: string[]): Promise<string[]>;

  /**
   * Check if a file exists
   * @param key - File path/key in storage
   * @returns True if file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file metadata without downloading
   * @param key - File path/key in storage
   * @returns File metadata
   */
  getMetadata(key: string): Promise<FileMetadata>;

  /**
   * List files in storage
   * @param options - List options
   * @returns List result with files and pagination info
   */
  list(options?: ListOptions): Promise<ListResult>;

  // ═══════════════════════════════════════════════════════════════════════
  // Advanced Operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Copy a file within or between buckets
   * @param sourceKey - Source file key
   * @param destinationKey - Destination file key
   * @param options - Copy options
   * @returns Metadata of the copied file
   */
  copy(sourceKey: string, destinationKey: string, options?: CopyOptions): Promise<FileMetadata>;

  /**
   * Move a file (copy + delete)
   * @param sourceKey - Source file key
   * @param destinationKey - Destination file key
   * @param options - Copy options
   * @returns Metadata of the moved file
   */
  move(sourceKey: string, destinationKey: string, options?: CopyOptions): Promise<FileMetadata>;

  /**
   * Generate a signed URL for direct access
   * @param key - File path/key in storage
   * @param options - Signed URL options
   * @returns Signed URL string
   */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;

  /**
   * Get the public URL for a file (if publicly accessible)
   * @param key - File path/key in storage
   * @returns Public URL string
   */
  getPublicUrl(key: string): string;

  // ═══════════════════════════════════════════════════════════════════════
  // Multipart Upload (for large files)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initiate a multipart upload
   * @param key - File path/key in storage
   * @param options - Upload options
   * @returns Multipart upload session
   */
  initiateMultipartUpload(key: string, options?: UploadOptions): Promise<MultipartUpload>;

  /**
   * Upload a part in a multipart upload
   * @param uploadId - Multipart upload ID
   * @param key - File path/key in storage
   * @param partNumber - Part number (1-10000)
   * @param data - Part data
   * @returns Uploaded part info
   */
  uploadPart(
    uploadId: string,
    key: string,
    partNumber: number,
    data: Buffer
  ): Promise<UploadedPart>;

  /**
   * Complete a multipart upload
   * @param uploadId - Multipart upload ID
   * @param key - File path/key in storage
   * @param parts - Array of uploaded parts
   * @returns Final file metadata
   */
  completeMultipartUpload(
    uploadId: string,
    key: string,
    parts: UploadedPart[]
  ): Promise<FileMetadata>;

  /**
   * Abort a multipart upload
   * @param uploadId - Multipart upload ID
   * @param key - File path/key in storage
   */
  abortMultipartUpload(uploadId: string, key: string): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════════
  // Health & Maintenance
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check storage health
   * @returns Health check result
   */
  healthCheck(): Promise<StorageHealthCheck>;

  /**
   * Ensure bucket exists, create if not
   */
  ensureBucket(): Promise<void>;
}

/**
 * Storage configuration base
 */
export interface StorageConfigBase {
  /** Provider type */
  provider: StorageProviderType;
  /** Bucket/container name */
  bucket: string;
  /** Base path prefix for all operations */
  basePath?: string;
}

/**
 * Local storage configuration
 */
export interface LocalStorageConfig extends StorageConfigBase {
  provider: StorageProviderType.LOCAL;
  /** Root directory for file storage */
  rootDir: string;
  /** Base URL for public access */
  baseUrl?: string;
}

/**
 * S3 storage configuration
 */
export interface S3StorageConfig extends StorageConfigBase {
  provider: StorageProviderType.S3;
  /** AWS region */
  region: string;
  /** Access key ID (optional if using IAM roles) */
  accessKeyId?: string;
  /** Secret access key (optional if using IAM roles) */
  secretAccessKey?: string;
  /** Custom endpoint (for S3-compatible services) */
  endpoint?: string;
  /** Force path style (required for some S3-compatible services) */
  forcePathStyle?: boolean;
}

/**
 * MinIO storage configuration
 */
export interface MinioStorageConfig extends StorageConfigBase {
  provider: StorageProviderType.MINIO;
  /** MinIO endpoint URL */
  endPoint: string;
  /** MinIO port */
  port: number;
  /** Use SSL */
  useSSL: boolean;
  /** Access key */
  accessKey: string;
  /** Secret key */
  secretKey: string;
  /** Region (optional) */
  region?: string;
}

/**
 * Union type for all storage configurations
 */
export type StorageConfig = LocalStorageConfig | S3StorageConfig | MinioStorageConfig;

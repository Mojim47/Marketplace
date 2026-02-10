// ═══════════════════════════════════════════════════════════════════════════
// @nextgen/storage - Vendor-Agnostic File Storage Abstraction
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Supports Local, S3, MinIO, Azure Blob, GCS
// ═══════════════════════════════════════════════════════════════════════════

// Interfaces
export { StorageProviderType } from './interfaces';

export type {
  UploadFile,
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
  StorageConfigBase,
  LocalStorageConfig,
  S3StorageConfig,
  MinioStorageConfig,
  StorageConfig,
} from './interfaces';

// Adapters
export { LocalStorageAdapter } from './adapters/local.adapter';
export { S3StorageAdapter } from './adapters/s3.adapter';
export { MinioStorageAdapter } from './adapters/minio.adapter';

// Factory
export { StorageFactory } from './factory';

// Services
export { StorageService } from './services';
export type { UploadResult, FileUploadOptions } from './services';

// Module
export { StorageModule } from './storage.module';
export type { StorageModuleOptions, StorageModuleAsyncOptions } from './storage.module';

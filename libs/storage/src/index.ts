// ═══════════════════════════════════════════════════════════════════════════
// @nextgen/storage - Vendor-Agnostic File Storage Abstraction
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Supports Local, S3, MinIO, Azure Blob, GCS
// ═══════════════════════════════════════════════════════════════════════════

// Adapters
export { LocalStorageAdapter } from './adapters/local.adapter';
export { MinioStorageAdapter } from './adapters/minio.adapter';
export { S3StorageAdapter } from './adapters/s3.adapter';
// Factory
export { StorageFactory } from './factory';
export type {
  CopyOptions,
  DownloadOptions,
  FileMetadata,
  IStorageProvider,
  ListOptions,
  ListResult,
  LocalStorageConfig,
  MinioStorageConfig,
  MultipartUpload,
  S3StorageConfig,
  SignedUrlOptions,
  StorageConfig,
  StorageConfigBase,
  StorageHealthCheck,
  UploadedPart,
  UploadFile,
  UploadOptions,
} from './interfaces';
// Interfaces
export { StorageProviderType } from './interfaces';
export type { FileUploadOptions, UploadResult } from './services';
// Services
export { StorageService } from './services';
export type { StorageModuleAsyncOptions, StorageModuleOptions } from './storage.module';
// Module
export { StorageModule } from './storage.module';

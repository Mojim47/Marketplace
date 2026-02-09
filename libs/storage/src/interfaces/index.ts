// ═══════════════════════════════════════════════════════════════════════════
// Storage Interfaces - Barrel Export
// ═══════════════════════════════════════════════════════════════════════════

export { StorageProviderType } from './storage.interface';

export type {
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
} from './storage.interface';

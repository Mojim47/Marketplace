// ═══════════════════════════════════════════════════════════════════════════
// Storage Interfaces - Barrel Export
// ═══════════════════════════════════════════════════════════════════════════

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
  UploadOptions,
} from './storage.interface';
export { StorageProviderType } from './storage.interface';

export interface UploadFile {
  buffer: Buffer;
  filename?: string;
  originalName?: string;
  mimeType?: string;
  mimetype?: string;
  size?: number;
  [key: string]: any;
}

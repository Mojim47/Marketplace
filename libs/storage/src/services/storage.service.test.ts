// ═══════════════════════════════════════════════════════════════════════════
// Storage Service Tests
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '../adapters/local.adapter';
import { StorageFactory } from '../factory/storage.factory';
import { StorageProviderType } from '../interfaces/storage.interface';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const testRootDir = path.join(process.cwd(), '.test-storage-service');
  const testBucket = 'service-test-bucket';
  let service: StorageService;
  let factory: StorageFactory;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    factory = new StorageFactory();
    service = new StorageService(factory);

    adapter = new LocalStorageAdapter({
      provider: StorageProviderType.LOCAL,
      bucket: testBucket,
      rootDir: testRootDir,
      baseUrl: 'http://localhost:3000/files',
    });

    await adapter.ensureBucket();
    service.setProvider(adapter);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testRootDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    factory.clear();
  });

  describe('setProvider / getProvider', () => {
    it('should set and get provider', () => {
      const provider = service.getProvider();
      expect(provider).toBe(adapter);
    });

    it('should throw error when provider not initialized', () => {
      const newService = new StorageService(factory);
      expect(() => newService.getProvider()).toThrow('Storage provider not initialized');
    });
  });

  describe('uploadFile', () => {
    it('should upload file with auto-generated name', async () => {
      const data = Buffer.from('Test content');
      const originalName = 'test-file.txt';

      const result = await service.uploadFile(data, originalName);

      expect(result.originalName).toBe(originalName);
      expect(result.filename).toMatch(/^\d+-[a-f0-9]+\.txt$/);
      expect(result.size).toBe(data.length);
      expect(result.publicUrl).toBeDefined();
    });

    it('should preserve original filename when requested', async () => {
      const data = Buffer.from('Test content');
      const originalName = 'My File.txt';

      const result = await service.uploadFile(data, originalName, {
        preserveFilename: true,
      });

      expect(result.filename).toBe('my_file.txt');
    });

    it('should use custom filename', async () => {
      const data = Buffer.from('Test content');
      const originalName = 'original.txt';

      const result = await service.uploadFile(data, originalName, {
        customFilename: 'custom-name',
      });

      expect(result.filename).toBe('custom-name.txt');
    });

    it('should upload to specified directory', async () => {
      const data = Buffer.from('Test content');
      const originalName = 'file.txt';

      const result = await service.uploadFile(data, originalName, {
        directory: 'uploads/2024',
      });

      expect(result.key).toMatch(/^uploads\/2024\//);
    });

    it('should detect content type from extension', async () => {
      const data = Buffer.from('{}');
      const originalName = 'data.json';

      const result = await service.uploadFile(data, originalName);

      expect(result.contentType).toBe('application/json');
    });

    it('should handle image files', async () => {
      const data = Buffer.from('fake image data');
      const originalName = 'photo.jpg';

      const result = await service.uploadFile(data, originalName);

      expect(result.contentType).toBe('image/jpeg');
    });

    it('should handle 3D model files', async () => {
      const data = Buffer.from('fake glb data');
      const originalName = 'model.glb';

      const result = await service.uploadFile(data, originalName);

      expect(result.contentType).toBe('model/gltf-binary');
    });
  });

  describe('uploadFiles', () => {
    it('should upload multiple files', async () => {
      const files = [
        { data: Buffer.from('File 1'), name: 'file1.txt' },
        { data: Buffer.from('File 2'), name: 'file2.txt' },
        { data: Buffer.from('File 3'), name: 'file3.txt' },
      ];

      const results = await service.uploadFiles(files);

      expect(results).toHaveLength(3);
      expect(results[0].originalName).toBe('file1.txt');
      expect(results[1].originalName).toBe('file2.txt');
      expect(results[2].originalName).toBe('file3.txt');
    });

    it('should apply options to all files', async () => {
      const files = [
        { data: Buffer.from('File 1'), name: 'file1.txt' },
        { data: Buffer.from('File 2'), name: 'file2.txt' },
      ];

      const results = await service.uploadFiles(files, {
        directory: 'batch-upload',
      });

      expect(results.every((r) => r.key.startsWith('batch-upload/'))).toBe(true);
    });
  });

  describe('downloadFile', () => {
    it('should download a file', async () => {
      const content = 'Download test';
      const { key } = await service.uploadFile(Buffer.from(content), 'download.txt');

      const result = await service.downloadFile(key);

      expect(result.toString()).toBe(content);
    });
  });

  describe('getFileStream', () => {
    it('should return a readable stream', async () => {
      const content = 'Stream test';
      const { key } = await service.uploadFile(Buffer.from(content), 'stream.txt');

      const stream = await service.getFileStream(key);
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      expect(Buffer.concat(chunks).toString()).toBe(content);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const { key } = await service.uploadFile(Buffer.from('Delete me'), 'delete.txt');

      await service.deleteFile(key);

      expect(await service.fileExists(key)).toBe(false);
    });
  });

  describe('deleteFiles', () => {
    it('should delete multiple files', async () => {
      const results = await service.uploadFiles([
        { data: Buffer.from('1'), name: 'del1.txt' },
        { data: Buffer.from('2'), name: 'del2.txt' },
      ]);
      const keys = results.map((r) => r.key);

      const failed = await service.deleteFiles(keys);

      expect(failed).toHaveLength(0);
      for (const key of keys) {
        expect(await service.fileExists(key)).toBe(false);
      }
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const { key } = await service.uploadFile(Buffer.from('exists'), 'exists.txt');

      expect(await service.fileExists(key)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await service.fileExists('non-existent.txt')).toBe(false);
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      const content = 'Metadata test';
      const { key } = await service.uploadFile(Buffer.from(content), 'meta.txt');

      const metadata = await service.getFileMetadata(key);

      expect(metadata.key).toBe(key);
      expect(metadata.size).toBe(content.length);
    });
  });

  describe('listFiles', () => {
    beforeEach(async () => {
      await service.uploadFile(Buffer.from('1'), 'list1.txt');
      await service.uploadFile(Buffer.from('2'), 'list2.txt');
      await service.uploadFile(Buffer.from('3'), 'dir/list3.txt', { directory: '' });
    });

    it('should list files', async () => {
      const result = await service.listFiles();

      expect(result.files.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by prefix', async () => {
      const result = await service.listFiles({ prefix: 'list' });

      expect(result.files.every((f) => f.key.startsWith('list'))).toBe(true);
    });
  });

  describe('listAllFiles', () => {
    it('should list all files with pagination', async () => {
      // Upload files
      for (let i = 0; i < 5; i++) {
        await service.uploadFile(Buffer.from(`${i}`), `all-${i}.txt`, { preserveFilename: true });
      }

      const files = await service.listAllFiles('all-');

      expect(files.length).toBe(5);
    });
  });

  describe('copyFile', () => {
    it('should copy a file', async () => {
      const { key: sourceKey } = await service.uploadFile(Buffer.from('Copy me'), 'source.txt');
      const destKey = 'destination.txt';

      const result = await service.copyFile(sourceKey, destKey);

      expect(result.key).toBe(destKey);
      expect(await service.fileExists(sourceKey)).toBe(true);
      expect(await service.fileExists(destKey)).toBe(true);
    });
  });

  describe('moveFile', () => {
    it('should move a file', async () => {
      const { key: sourceKey } = await service.uploadFile(
        Buffer.from('Move me'),
        'move-source.txt'
      );
      const destKey = 'move-dest.txt';

      const result = await service.moveFile(sourceKey, destKey);

      expect(result.key).toBe(destKey);
      expect(await service.fileExists(sourceKey)).toBe(false);
      expect(await service.fileExists(destKey)).toBe(true);
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL for download', async () => {
      const { key } = await service.uploadFile(Buffer.from('Signed'), 'signed.txt');

      const url = await service.getSignedUrl(key);

      expect(url).toContain(key);
      expect(url).toContain('expires=');
    });

    it('should generate signed URL with custom expiration', async () => {
      const { key } = await service.uploadFile(Buffer.from('Signed'), 'signed2.txt');

      const url = await service.getSignedUrl(key, 7200);

      expect(url).toBeDefined();
    });
  });

  describe('getSignedUploadUrl', () => {
    it('should generate signed upload URL', async () => {
      const url = await service.getSignedUploadUrl('upload-target.txt', 'text/plain');

      expect(url).toContain('upload-target.txt');
    });
  });

  describe('getPublicUrl', () => {
    it('should return public URL', () => {
      const url = service.getPublicUrl('public-file.txt');

      expect(url).toBe(`http://localhost:3000/files/${testBucket}/public-file.txt`);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.provider).toBe(StorageProviderType.LOCAL);
    });
  });

  describe('deleteDirectory', () => {
    it('should delete all files in directory', async () => {
      await service.uploadFile(Buffer.from('1'), 'file1.txt', { directory: 'delete-dir' });
      await service.uploadFile(Buffer.from('2'), 'file2.txt', { directory: 'delete-dir' });
      await service.uploadFile(Buffer.from('3'), 'file3.txt', { directory: 'delete-dir' });

      const deleted = await service.deleteDirectory('delete-dir/');

      expect(deleted).toBe(3);
    });

    it('should return 0 for empty directory', async () => {
      const deleted = await service.deleteDirectory('empty-dir/');

      expect(deleted).toBe(0);
    });
  });

  describe('getDirectorySize', () => {
    it('should calculate total directory size', async () => {
      const content1 = 'Content 1';
      const content2 = 'Content 2';
      await service.uploadFile(Buffer.from(content1), 'size1.txt', { directory: 'size-dir' });
      await service.uploadFile(Buffer.from(content2), 'size2.txt', { directory: 'size-dir' });

      const size = await service.getDirectorySize('size-dir/');

      expect(size).toBe(content1.length + content2.length);
    });
  });

  describe('content type detection', () => {
    const testCases = [
      { ext: '.jpg', expected: 'image/jpeg' },
      { ext: '.png', expected: 'image/png' },
      { ext: '.gif', expected: 'image/gif' },
      { ext: '.webp', expected: 'image/webp' },
      { ext: '.svg', expected: 'image/svg+xml' },
      { ext: '.pdf', expected: 'application/pdf' },
      { ext: '.doc', expected: 'application/msword' },
      {
        ext: '.xlsx',
        expected: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      { ext: '.mp3', expected: 'audio/mpeg' },
      { ext: '.mp4', expected: 'video/mp4' },
      { ext: '.glb', expected: 'model/gltf-binary' },
      { ext: '.gltf', expected: 'model/gltf+json' },
      { ext: '.usdz', expected: 'model/vnd.usdz+zip' },
      { ext: '.woff2', expected: 'font/woff2' },
      { ext: '.unknown', expected: 'application/octet-stream' },
    ];

    for (const { ext, expected } of testCases) {
      it(`should detect ${ext} as ${expected}`, async () => {
        const result = await service.uploadFile(Buffer.from('test'), `file${ext}`);
        expect(result.contentType).toBe(expected);
      });
    }
  });

  describe('filename sanitization', () => {
    it('should sanitize special characters', async () => {
      const result = await service.uploadFile(Buffer.from('test'), 'My File (1) [test].txt', {
        preserveFilename: true,
      });

      // Special chars replaced with _, consecutive _ collapsed
      expect(result.filename).toBe('my_file_1_test_.txt');
    });

    it('should handle unicode characters', async () => {
      const result = await service.uploadFile(Buffer.from('test'), 'فایل تست.txt', {
        preserveFilename: true,
      });

      expect(result.filename).not.toContain('فایل');
    });
  });
});

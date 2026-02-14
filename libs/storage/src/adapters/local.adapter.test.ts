// ═══════════════════════════════════════════════════════════════════════════
// Local Storage Adapter Tests
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageProviderType } from '../interfaces/storage.interface';
import { LocalStorageAdapter } from './local.adapter';

describe('LocalStorageAdapter', () => {
  const testRootDir = path.join(process.cwd(), '.test-storage');
  const testBucket = 'test-bucket';
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    adapter = new LocalStorageAdapter({
      provider: StorageProviderType.LOCAL,
      bucket: testBucket,
      rootDir: testRootDir,
      baseUrl: 'http://localhost:3000/files',
    });
    await adapter.ensureBucket();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testRootDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create adapter with correct provider type', () => {
      expect(adapter.providerType).toBe(StorageProviderType.LOCAL);
    });

    it('should set bucket name correctly', () => {
      expect(adapter.bucket).toBe(testBucket);
    });
  });

  describe('upload', () => {
    it('should upload a buffer successfully', async () => {
      const data = Buffer.from('Hello, World!');
      const key = 'test-file.txt';

      const result = await adapter.upload(key, data);

      expect(result.key).toBe(key);
      expect(result.size).toBe(data.length);
      expect(result.provider).toBe(StorageProviderType.LOCAL);
      expect(result.bucket).toBe(testBucket);
    });

    it('should upload with custom content type', async () => {
      const data = Buffer.from('{"test": true}');
      const key = 'data.json';

      const result = await adapter.upload(key, data, {
        contentType: 'application/json',
      });

      expect(result.contentType).toBe('application/json');
    });

    it('should upload with custom metadata', async () => {
      const data = Buffer.from('test');
      const key = 'meta-file.txt';
      const metadata = { author: 'test', version: '1.0' };

      const result = await adapter.upload(key, data, { metadata });

      expect(result.metadata).toEqual(metadata);
    });

    it('should create nested directories', async () => {
      const data = Buffer.from('nested content');
      const key = 'path/to/nested/file.txt';

      const result = await adapter.upload(key, data);

      expect(result.key).toBe(key);
      expect(await adapter.exists(key)).toBe(true);
    });

    it('should upload from readable stream', async () => {
      const { Readable } = await import('node:stream');
      const data = 'Stream content';
      const stream = Readable.from([data]);
      const key = 'stream-file.txt';

      const result = await adapter.upload(key, stream);

      expect(result.size).toBe(data.length);
    });
  });

  describe('download', () => {
    it('should download a file successfully', async () => {
      const content = 'Download test content';
      const key = 'download-test.txt';
      await adapter.upload(key, Buffer.from(content));

      const result = await adapter.download(key);

      expect(result.toString()).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      await expect(adapter.download('non-existent.txt')).rejects.toThrow('File not found');
    });

    it('should support range downloads', async () => {
      const content = 'Hello, World!';
      const key = 'range-test.txt';
      await adapter.upload(key, Buffer.from(content));

      const result = await adapter.download(key, { rangeStart: 0, rangeEnd: 4 });

      expect(result.toString()).toBe('Hello');
    });
  });

  describe('getStream', () => {
    it('should return a readable stream', async () => {
      const content = 'Stream test content';
      const key = 'stream-test.txt';
      await adapter.upload(key, Buffer.from(content));

      const stream = await adapter.getStream(key);
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      expect(Buffer.concat(chunks).toString()).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      await expect(adapter.getStream('non-existent.txt')).rejects.toThrow('File not found');
    });
  });

  describe('delete', () => {
    it('should delete a file successfully', async () => {
      const key = 'delete-test.txt';
      await adapter.upload(key, Buffer.from('delete me'));

      await adapter.delete(key);

      expect(await adapter.exists(key)).toBe(false);
    });

    it('should not throw for non-existent file', async () => {
      await expect(adapter.delete('non-existent.txt')).resolves.not.toThrow();
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple files', async () => {
      const keys = ['file1.txt', 'file2.txt', 'file3.txt'];
      for (const key of keys) {
        await adapter.upload(key, Buffer.from(key));
      }

      const failed = await adapter.deleteMany(keys);

      expect(failed).toHaveLength(0);
      for (const key of keys) {
        expect(await adapter.exists(key)).toBe(false);
      }
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const key = 'exists-test.txt';
      await adapter.upload(key, Buffer.from('exists'));

      expect(await adapter.exists(key)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await adapter.exists('non-existent.txt')).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('should return file metadata', async () => {
      const content = 'Metadata test';
      const key = 'metadata-test.txt';
      await adapter.upload(key, Buffer.from(content), {
        contentType: 'text/plain',
        metadata: { custom: 'value' },
      });

      const metadata = await adapter.getMetadata(key);

      expect(metadata.key).toBe(key);
      expect(metadata.size).toBe(content.length);
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.metadata).toEqual({ custom: 'value' });
      expect(metadata.lastModified).toBeInstanceOf(Date);
      expect(metadata.etag).toBeDefined();
    });

    it('should throw error for non-existent file', async () => {
      await expect(adapter.getMetadata('non-existent.txt')).rejects.toThrow('File not found');
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await adapter.upload('file1.txt', Buffer.from('1'));
      await adapter.upload('file2.txt', Buffer.from('2'));
      await adapter.upload('dir/file3.txt', Buffer.from('3'));
      await adapter.upload('dir/file4.txt', Buffer.from('4'));
    });

    it('should list all files', async () => {
      const result = await adapter.list();

      expect(result.files.length).toBeGreaterThanOrEqual(4);
      expect(result.keyCount).toBeGreaterThanOrEqual(4);
    });

    it('should filter by prefix', async () => {
      const result = await adapter.list({ prefix: 'dir/' });

      expect(result.files.every((f) => f.key.startsWith('dir/'))).toBe(true);
    });

    it('should respect maxKeys', async () => {
      const result = await adapter.list({ maxKeys: 2 });

      expect(result.files.length).toBeLessThanOrEqual(2);
    });
  });

  describe('copy', () => {
    it('should copy a file', async () => {
      const sourceKey = 'source.txt';
      const destKey = 'destination.txt';
      const content = 'Copy me';
      await adapter.upload(sourceKey, Buffer.from(content));

      const result = await adapter.copy(sourceKey, destKey);

      expect(result.key).toBe(destKey);
      expect(await adapter.exists(sourceKey)).toBe(true);
      expect(await adapter.exists(destKey)).toBe(true);
      expect((await adapter.download(destKey)).toString()).toBe(content);
    });

    it('should throw error for non-existent source', async () => {
      await expect(adapter.copy('non-existent.txt', 'dest.txt')).rejects.toThrow();
    });
  });

  describe('move', () => {
    it('should move a file', async () => {
      const sourceKey = 'move-source.txt';
      const destKey = 'move-dest.txt';
      const content = 'Move me';
      await adapter.upload(sourceKey, Buffer.from(content));

      const result = await adapter.move(sourceKey, destKey);

      expect(result.key).toBe(destKey);
      expect(await adapter.exists(sourceKey)).toBe(false);
      expect(await adapter.exists(destKey)).toBe(true);
    });
  });

  describe('getSignedUrl', () => {
    it('should generate a signed URL', async () => {
      const key = 'signed-url-test.txt';
      await adapter.upload(key, Buffer.from('signed'));

      const url = await adapter.getSignedUrl(key, { expiresIn: 3600 });

      expect(url).toContain(key);
      expect(url).toContain('expires=');
      expect(url).toContain('signature=');
    });
  });

  describe('getPublicUrl', () => {
    it('should return public URL', () => {
      const key = 'public-file.txt';

      const url = adapter.getPublicUrl(key);

      expect(url).toBe(`http://localhost:3000/files/${testBucket}/${key}`);
    });
  });

  describe('multipart upload', () => {
    it('should complete multipart upload', async () => {
      const key = 'multipart-test.txt';
      const part1 = Buffer.from('Part 1 ');
      const part2 = Buffer.from('Part 2 ');
      const part3 = Buffer.from('Part 3');

      const upload = await adapter.initiateMultipartUpload(key);
      const uploadedParts = [
        await adapter.uploadPart(upload.uploadId, key, 1, part1),
        await adapter.uploadPart(upload.uploadId, key, 2, part2),
        await adapter.uploadPart(upload.uploadId, key, 3, part3),
      ];

      const result = await adapter.completeMultipartUpload(upload.uploadId, key, uploadedParts);

      expect(result.key).toBe(key);
      expect((await adapter.download(key)).toString()).toBe('Part 1 Part 2 Part 3');
    });

    it('should abort multipart upload', async () => {
      const key = 'abort-test.txt';
      const upload = await adapter.initiateMultipartUpload(key);
      await adapter.uploadPart(upload.uploadId, key, 1, Buffer.from('Part 1'));

      await adapter.abortMultipartUpload(upload.uploadId, key);

      expect(await adapter.exists(key)).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.provider).toBe(StorageProviderType.LOCAL);
      expect(result.bucket).toBe(testBucket);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('ensureBucket', () => {
    it('should create bucket directory if not exists', async () => {
      const newAdapter = new LocalStorageAdapter({
        provider: StorageProviderType.LOCAL,
        bucket: 'new-bucket',
        rootDir: testRootDir,
      });

      await newAdapter.ensureBucket();

      const bucketPath = path.join(testRootDir, 'new-bucket');
      const stats = await fs.promises.stat(bucketPath);
      expect(stats.isDirectory()).toBe(true);
    });
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Backup Encryption Property Tests
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Property-based tests for backup encryption and checksum verification.
 *
 * Feature: production-readiness-audit
 * Property 25: Backup Encryption Integrity
 * Property 26: Backup Checksum Verification
 *
 * @module tests/integration/backup-encryption
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// Encryption Configuration (matches backup-db.sh)
// ═══════════════════════════════════════════════════════════════════════════

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for AES-CBC
const SALT_LENGTH = 8; // OpenSSL default salt length

// ═══════════════════════════════════════════════════════════════════════════
// Encryption/Decryption Functions (TypeScript implementation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derives a key from password using PBKDF2 (matches OpenSSL behavior)
 */
function deriveKeyAndIV(password: Buffer, salt: Buffer): { key: Buffer; iv: Buffer } {
  // OpenSSL uses MD5-based key derivation by default, but with -pbkdf2 it uses SHA-256
  const keyIv = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH + IV_LENGTH,
    'sha256'
  );
  return {
    key: keyIv.subarray(0, KEY_LENGTH),
    iv: keyIv.subarray(KEY_LENGTH, KEY_LENGTH + IV_LENGTH),
  };
}

/**
 * Encrypts data using AES-256-CBC with PBKDF2 key derivation
 * Compatible with OpenSSL enc -aes-256-cbc -salt -pbkdf2
 */
function encryptData(data: Buffer, password: Buffer): Buffer {
  // Generate random salt
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Derive key and IV from password and salt
  const { key, iv } = deriveKeyAndIV(password, salt);

  // Create cipher and encrypt
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  // OpenSSL format: "Salted__" + salt + encrypted_data
  const header = Buffer.from('Salted__');
  return Buffer.concat([header, salt, encrypted]);
}

/**
 * Decrypts data encrypted with AES-256-CBC and PBKDF2
 * Compatible with OpenSSL enc -d -aes-256-cbc -salt -pbkdf2
 */
function decryptData(encryptedData: Buffer, password: Buffer): Buffer {
  // Check for OpenSSL "Salted__" header
  const header = encryptedData.subarray(0, 8).toString();
  if (header !== 'Salted__') {
    throw new Error('Invalid encrypted data format: missing Salted__ header');
  }

  // Extract salt and ciphertext
  const salt = encryptedData.subarray(8, 8 + SALT_LENGTH);
  const ciphertext = encryptedData.subarray(8 + SALT_LENGTH);

  // Derive key and IV from password and salt
  const { key, iv } = deriveKeyAndIV(password, salt);

  // Create decipher and decrypt
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Generates SHA-256 checksum of data
 */
function generateChecksum(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verifies SHA-256 checksum of data
 */
function verifyChecksum(data: Buffer, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(data);
  return actualChecksum === expectedChecksum;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
});

afterAll(() => {
  // Clean up temp directory
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Backup Encryption Property Tests', () => {
  /**
   * Feature: production-readiness-audit
   * Property 25: Backup Encryption Integrity
   * Validates: Requirements 9.2
   *
   * *For any* backup file, the file should be encrypted with AES-256 and
   * decrypting with the correct key should produce valid data.
   */
  describe('Property 25: Backup Encryption Integrity', () => {
    it('should encrypt and decrypt data correctly (round-trip)', () => {
      fc.assert(
        fc.property(
          // Generate random data of various sizes (simulating backup content)
          fc.uint8Array({ minLength: 1, maxLength: 10000 }),
          // Generate random encryption key
          fc.uint8Array({ minLength: 16, maxLength: 64 }),
          (data, keyBytes) => {
            const dataBuffer = Buffer.from(data);
            const keyBuffer = Buffer.from(keyBytes);

            // Encrypt the data
            const encrypted = encryptData(dataBuffer, keyBuffer);

            // Verify encrypted data is different from original
            expect(encrypted.equals(dataBuffer)).toBe(false);

            // Verify encrypted data has OpenSSL header
            expect(encrypted.subarray(0, 8).toString()).toBe('Salted__');

            // Decrypt the data
            const decrypted = decryptData(encrypted, keyBuffer);

            // Verify decrypted data matches original
            expect(decrypted.equals(dataBuffer)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail decryption with wrong key', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 100, maxLength: 1000 }),
          fc.uint8Array({ minLength: 16, maxLength: 64 }),
          fc.uint8Array({ minLength: 16, maxLength: 64 }),
          (data, correctKey, wrongKey) => {
            // Skip if keys happen to be the same
            if (Buffer.from(correctKey).equals(Buffer.from(wrongKey))) {
              return true;
            }

            const dataBuffer = Buffer.from(data);
            const correctKeyBuffer = Buffer.from(correctKey);
            const wrongKeyBuffer = Buffer.from(wrongKey);

            // Encrypt with correct key
            const encrypted = encryptData(dataBuffer, correctKeyBuffer);

            // Attempt to decrypt with wrong key should fail or produce different data
            try {
              const decrypted = decryptData(encrypted, wrongKeyBuffer);
              // If decryption succeeds, data should be different
              return !decrypted.equals(dataBuffer);
            } catch {
              // Decryption failure is expected with wrong key
              return true;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different ciphertext for same data with different salts', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 100, maxLength: 1000 }),
          fc.uint8Array({ minLength: 16, maxLength: 64 }),
          (data, keyBytes) => {
            const dataBuffer = Buffer.from(data);
            const keyBuffer = Buffer.from(keyBytes);

            // Encrypt the same data twice
            const encrypted1 = encryptData(dataBuffer, keyBuffer);
            const encrypted2 = encryptData(dataBuffer, keyBuffer);

            // Due to random salt, ciphertexts should be different
            expect(encrypted1.equals(encrypted2)).toBe(false);

            // But both should decrypt to the same original data
            const decrypted1 = decryptData(encrypted1, keyBuffer);
            const decrypted2 = decryptData(encrypted2, keyBuffer);

            expect(decrypted1.equals(dataBuffer)).toBe(true);
            expect(decrypted2.equals(dataBuffer)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle SQL-like backup content correctly', () => {
      fc.assert(
        fc.property(
          // Generate SQL-like content
          fc.array(
            fc.record({
              tableName: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')), {
                minLength: 3,
                maxLength: 20,
              }),
              columns: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
                minLength: 1,
                maxLength: 10,
              }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.uint8Array({ minLength: 16, maxLength: 64 }),
          (tables, keyBytes) => {
            // Generate SQL-like content
            const sqlContent = tables
              .map(
                (t) =>
                  `CREATE TABLE ${t.tableName} (${t.columns.join(', ')});\n` +
                  `INSERT INTO ${t.tableName} VALUES (${t.columns.map(() => "'test'").join(', ')});`
              )
              .join('\n\n');

            const dataBuffer = Buffer.from(sqlContent, 'utf-8');
            const keyBuffer = Buffer.from(keyBytes);

            // Encrypt and decrypt
            const encrypted = encryptData(dataBuffer, keyBuffer);
            const decrypted = decryptData(encrypted, keyBuffer);

            // Verify content integrity
            expect(decrypted.toString('utf-8')).toBe(sqlContent);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: production-readiness-audit
   * Property 26: Backup Checksum Verification
   * Validates: Requirements 9.3
   *
   * *For any* backup file, the stored checksum should match the computed
   * checksum of the file contents.
   */
  describe('Property 26: Backup Checksum Verification', () => {
    it('should generate consistent checksums for same data', () => {
      fc.assert(
        fc.property(fc.uint8Array({ minLength: 1, maxLength: 10000 }), (data) => {
          const dataBuffer = Buffer.from(data);

          // Generate checksum multiple times
          const checksum1 = generateChecksum(dataBuffer);
          const checksum2 = generateChecksum(dataBuffer);
          const checksum3 = generateChecksum(dataBuffer);

          // All checksums should be identical
          expect(checksum1).toBe(checksum2);
          expect(checksum2).toBe(checksum3);

          // Checksum should be 64 hex characters (256 bits)
          expect(checksum1).toMatch(/^[a-f0-9]{64}$/);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce different checksums for different data', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          (data1, data2) => {
            const buffer1 = Buffer.from(data1);
            const buffer2 = Buffer.from(data2);

            // Skip if data happens to be the same
            if (buffer1.equals(buffer2)) {
              return true;
            }

            const checksum1 = generateChecksum(buffer1);
            const checksum2 = generateChecksum(buffer2);

            // Different data should produce different checksums
            return checksum1 !== checksum2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify checksums correctly', () => {
      fc.assert(
        fc.property(fc.uint8Array({ minLength: 1, maxLength: 10000 }), (data) => {
          const dataBuffer = Buffer.from(data);

          // Generate checksum
          const checksum = generateChecksum(dataBuffer);

          // Verification should pass with correct checksum
          expect(verifyChecksum(dataBuffer, checksum)).toBe(true);

          // Verification should fail with wrong checksum
          const wrongChecksum = checksum.replace(/[0-9a-f]/, (c) =>
            c === 'f' ? '0' : String.fromCharCode(c.charCodeAt(0) + 1)
          );
          expect(verifyChecksum(dataBuffer, wrongChecksum)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should detect data corruption via checksum', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 10, maxLength: 1000 }),
          fc.integer({ min: 0, max: 999 }),
          (data, corruptIndex) => {
            const dataBuffer = Buffer.from(data);
            const actualIndex = corruptIndex % dataBuffer.length;

            // Generate checksum of original data
            const originalChecksum = generateChecksum(dataBuffer);

            // Corrupt one byte
            const corruptedBuffer = Buffer.from(dataBuffer);
            corruptedBuffer[actualIndex] = (corruptedBuffer[actualIndex] + 1) % 256;

            // Checksum should not match corrupted data
            expect(verifyChecksum(corruptedBuffer, originalChecksum)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should work correctly with encrypted backup files', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 100, maxLength: 5000 }),
          fc.uint8Array({ minLength: 16, maxLength: 64 }),
          (data, keyBytes) => {
            const dataBuffer = Buffer.from(data);
            const keyBuffer = Buffer.from(keyBytes);

            // Encrypt the data
            const encrypted = encryptData(dataBuffer, keyBuffer);

            // Generate checksum of encrypted data
            const checksum = generateChecksum(encrypted);

            // Verify checksum
            expect(verifyChecksum(encrypted, checksum)).toBe(true);

            // Decrypt and verify original data
            const decrypted = decryptData(encrypted, keyBuffer);
            expect(decrypted.equals(dataBuffer)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Backup File Operations Property Tests', () => {
  it('should handle file-based encryption round-trip', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 100, maxLength: 5000 }),
        fc.uint8Array({ minLength: 16, maxLength: 64 }),
        fc.hexaString({ minLength: 8, maxLength: 16 }),
        (data, keyBytes, fileId) => {
          const dataBuffer = Buffer.from(data);
          const keyBuffer = Buffer.from(keyBytes);

          // Create file paths
          const originalFile = path.join(tempDir, `original_${fileId}.sql`);
          const encryptedFile = path.join(tempDir, `encrypted_${fileId}.sql.enc`);
          const checksumFile = path.join(tempDir, `encrypted_${fileId}.sql.enc.sha256`);
          const decryptedFile = path.join(tempDir, `decrypted_${fileId}.sql`);

          try {
            // Write original data
            fs.writeFileSync(originalFile, dataBuffer);

            // Encrypt
            const encrypted = encryptData(dataBuffer, keyBuffer);
            fs.writeFileSync(encryptedFile, encrypted);

            // Generate and save checksum
            const checksum = generateChecksum(encrypted);
            fs.writeFileSync(checksumFile, checksum);

            // Read encrypted file and verify checksum
            const readEncrypted = fs.readFileSync(encryptedFile);
            const readChecksum = fs.readFileSync(checksumFile, 'utf-8');
            expect(verifyChecksum(readEncrypted, readChecksum)).toBe(true);

            // Decrypt
            const decrypted = decryptData(readEncrypted, keyBuffer);
            fs.writeFileSync(decryptedFile, decrypted);

            // Verify decrypted matches original
            const readDecrypted = fs.readFileSync(decryptedFile);
            expect(readDecrypted.equals(dataBuffer)).toBe(true);

            return true;
          } finally {
            // Cleanup
            [originalFile, encryptedFile, checksumFile, decryptedFile].forEach((f) => {
              if (fs.existsSync(f)) {
                fs.unlinkSync(f);
              }
            });
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

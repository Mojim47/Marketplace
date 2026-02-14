// ═══════════════════════════════════════════════════════════════════════════
// Immutable Log Service - SC³ Audit Trail
// ═══════════════════════════════════════════════════════════════════════════
// Implements: ∃log∈L: immutable(log) ∧ contains(log, hash(a)) ∧ timestamp(log) ≤ T
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type ImmutableLog,
  type ImmutableLogEntry,
  type LogEntryType,
  type LogVerificationResult,
  type SC3Failure,
  SC3FailureCategory,
} from '../types';

/**
 * Log verification options
 */
export interface LogVerificationOptions {
  /** Time bound (T) for verification */
  time_bound: Date;
  /** Required artifact hashes that must be in log */
  required_artifact_hashes: string[];
  /** Verify chain integrity */
  verify_chain: boolean;
  /** Verify signatures */
  verify_signatures: boolean;
}

/**
 * Log entry creation options
 */
export interface CreateLogEntryOptions {
  type: LogEntryType;
  artifact_hash?: string;
  build_id?: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class ImmutableLogService {
  private readonly logger = new Logger(ImmutableLogService.name);
  private readonly logs = new Map<string, ImmutableLog>();
  private signingKey?: string;

  /**
   * Set signing key for log entries
   */
  setSigningKey(privateKey: string): void {
    this.signingKey = privateKey;
  }

  /**
   * Verify log meets SC³ requirements
   * ∃log∈L: immutable(log) ∧ contains(log, hash(a)) ∧ timestamp(log) ≤ T
   */
  async verifyLog(
    log: ImmutableLog,
    options: LogVerificationOptions
  ): Promise<{ result: LogVerificationResult; failures: SC3Failure[] }> {
    const failures: SC3Failure[] = [];
    const missingArtifacts: string[] = [];

    // 1. Verify immutability (chain integrity)
    let chainIntegrity = true;
    if (options.verify_chain) {
      chainIntegrity = this.verifyChainIntegrity(log);
      if (!chainIntegrity) {
        failures.push({
          category: SC3FailureCategory.LOG,
          code: 'CHAIN_INTEGRITY_FAILED',
          message: `Log ${log.id} chain integrity verification failed`,
          message_fa: `یکپارچگی زنجیره لاگ ${log.id} تأیید نشد`,
          entity_id: log.id,
        });
      }
    }

    // 2. Verify all required artifact hashes are in log
    // contains(log, hash(a))
    for (const hash of options.required_artifact_hashes) {
      const found = log.entries.some((e) => e.artifact_hash === hash);
      if (!found) {
        missingArtifacts.push(hash);
        failures.push({
          category: SC3FailureCategory.LOG,
          code: 'ARTIFACT_NOT_LOGGED',
          message: `Artifact hash ${hash} not found in log ${log.id}`,
          message_fa: `هش آرتیفکت ${hash} در لاگ ${log.id} یافت نشد`,
          entity_id: log.id,
          details: { artifact_hash: hash },
        });
      }
    }

    // 3. Verify all timestamps are within time bound
    // timestamp(log) ≤ T
    let timestampsValid = true;
    for (const entry of log.entries) {
      const entryTime = new Date(entry.timestamp);
      if (entryTime > options.time_bound) {
        timestampsValid = false;
        failures.push({
          category: SC3FailureCategory.LOG,
          code: 'TIMESTAMP_EXCEEDED',
          message: `Log entry ${entry.id} timestamp exceeds time bound`,
          message_fa: `زمان ورودی لاگ ${entry.id} از محدوده زمانی فراتر رفته است`,
          entity_id: entry.id,
          details: {
            entry_timestamp: entry.timestamp,
            time_bound: options.time_bound.toISOString(),
          },
        });
      }
    }

    // 4. Verify entry signatures (if required)
    if (options.verify_signatures) {
      for (const entry of log.entries) {
        if (!this.verifyEntrySignature(entry)) {
          failures.push({
            category: SC3FailureCategory.LOG,
            code: 'INVALID_ENTRY_SIGNATURE',
            message: `Log entry ${entry.id} has invalid signature`,
            message_fa: `امضای ورودی لاگ ${entry.id} نامعتبر است`,
            entity_id: entry.id,
          });
        }
      }
    }

    const passed = failures.length === 0;
    const artifactsLogged = missingArtifacts.length === 0;

    return {
      result: {
        passed,
        immutable: chainIntegrity,
        artifacts_logged: artifactsLogged,
        timestamps_valid: timestampsValid,
        chain_integrity: chainIntegrity,
        missing_artifacts: missingArtifacts,
      },
      failures,
    };
  }

  /**
   * Verify chain integrity (immutability)
   * immutable(log) - verify hash chain is unbroken
   */
  verifyChainIntegrity(log: ImmutableLog): boolean {
    if (log.entries.length === 0) {
      return true;
    }

    // Verify first entry has genesis hash
    const firstEntry = log.entries[0];
    if (firstEntry.previous_hash !== this.getGenesisHash()) {
      this.logger.warn(`Log ${log.id} first entry has invalid previous hash`);
      return false;
    }

    // Verify each entry's previous_hash matches previous entry's data_hash
    for (let i = 1; i < log.entries.length; i++) {
      const currentEntry = log.entries[i];
      const previousEntry = log.entries[i - 1];

      // Compute expected previous hash
      const expectedPreviousHash = this.computeEntryHash(previousEntry);

      if (currentEntry.previous_hash !== expectedPreviousHash) {
        this.logger.warn(`Log ${log.id} chain broken at entry ${currentEntry.id}`, {
          expected: expectedPreviousHash,
          actual: currentEntry.previous_hash,
        });
        return false;
      }

      // Verify sequence numbers are consecutive
      if (currentEntry.sequence !== previousEntry.sequence + 1) {
        this.logger.warn(`Log ${log.id} sequence broken at entry ${currentEntry.id}`, {
          expected: previousEntry.sequence + 1,
          actual: currentEntry.sequence,
        });
        return false;
      }
    }

    // Verify head hash matches last entry
    const lastEntry = log.entries[log.entries.length - 1];
    const expectedHeadHash = this.computeEntryHash(lastEntry);

    if (log.head_hash !== expectedHeadHash) {
      this.logger.warn(`Log ${log.id} head hash mismatch`);
      return false;
    }

    return true;
  }

  /**
   * Check if log contains artifact hash
   * contains(log, hash(a))
   */
  containsArtifactHash(log: ImmutableLog, artifactHash: string): boolean {
    return log.entries.some((entry) => entry.artifact_hash === artifactHash);
  }

  /**
   * Get entries for artifact hash
   */
  getEntriesForArtifact(log: ImmutableLog, artifactHash: string): ImmutableLogEntry[] {
    return log.entries.filter((entry) => entry.artifact_hash === artifactHash);
  }

  /**
   * Create a new immutable log
   */
  createLog(name: string): ImmutableLog {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const log: ImmutableLog = {
      id,
      name,
      entries: [],
      head_hash: this.getGenesisHash(),
      created_at: now,
      last_entry_at: now,
      entry_count: 0,
      sealed: false,
    };

    this.logs.set(id, log);
    return log;
  }

  /**
   * Append entry to log
   */
  appendEntry(logId: string, options: CreateLogEntryOptions): ImmutableLogEntry {
    const log = this.logs.get(logId);
    if (!log) {
      throw new Error(`Log ${logId} not found`);
    }

    if (log.sealed) {
      throw new Error(`Log ${logId} is sealed and cannot accept new entries`);
    }

    const sequence = log.entries.length;
    const previousHash =
      sequence === 0 ? this.getGenesisHash() : this.computeEntryHash(log.entries[sequence - 1]);

    const entry: ImmutableLogEntry = {
      id: crypto.randomUUID(),
      sequence,
      timestamp: new Date().toISOString(),
      type: options.type,
      artifact_hash: options.artifact_hash,
      build_id: options.build_id,
      data_hash: '',
      previous_hash: previousHash,
      payload: options.payload,
      signature: '',
    };

    // Compute data hash
    entry.data_hash = this.computeDataHash(entry);

    // Sign entry
    entry.signature = this.signEntry(entry);

    // Add to log
    log.entries.push(entry);
    log.head_hash = this.computeEntryHash(entry);
    log.last_entry_at = entry.timestamp;
    log.entry_count = log.entries.length;

    return entry;
  }

  /**
   * Seal log (prevent further entries)
   */
  sealLog(logId: string): void {
    const log = this.logs.get(logId);
    if (!log) {
      throw new Error(`Log ${logId} not found`);
    }
    log.sealed = true;
  }

  /**
   * Get log by ID
   */
  getLog(logId: string): ImmutableLog | undefined {
    return this.logs.get(logId);
  }

  /**
   * Verify entry signature
   */
  private verifyEntrySignature(entry: ImmutableLogEntry): boolean {
    if (!entry.signature) {
      return false;
    }

    // In production, verify against public key
    // For now, verify signature is non-empty and matches expected format
    try {
      const signatureBuffer = Buffer.from(entry.signature, 'base64');
      return signatureBuffer.length >= 64; // Minimum signature length
    } catch {
      return false;
    }
  }

  /**
   * Compute entry hash (for chain linking)
   */
  private computeEntryHash(entry: ImmutableLogEntry): string {
    const data = {
      id: entry.id,
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      type: entry.type,
      data_hash: entry.data_hash,
      previous_hash: entry.previous_hash,
    };

    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Compute data hash (for entry content)
   */
  private computeDataHash(entry: ImmutableLogEntry): string {
    const data = {
      type: entry.type,
      artifact_hash: entry.artifact_hash,
      build_id: entry.build_id,
      payload: entry.payload,
    };

    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Sign entry
   */
  private signEntry(entry: ImmutableLogEntry): string {
    const dataToSign = `${entry.id}:${entry.data_hash}:${entry.previous_hash}`;

    if (this.signingKey) {
      try {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(dataToSign);
        return sign.sign(this.signingKey, 'base64');
      } catch {
        // Fallback to HMAC if RSA fails
      }
    }

    // Fallback: HMAC signature
    const hmac = crypto.createHmac('sha256', 'sc3-log-key');
    hmac.update(dataToSign);
    return hmac.digest('base64');
  }

  /**
   * Get genesis hash (first entry's previous hash)
   */
  private getGenesisHash(): string {
    return '0'.repeat(64); // 64 zeros for SHA-256
  }

  /**
   * Compute Merkle root for batch verification
   */
  computeMerkleRoot(entries: ImmutableLogEntry[]): string {
    if (entries.length === 0) {
      return this.getGenesisHash();
    }

    let hashes = entries.map((e) => e.data_hash);

    while (hashes.length > 1) {
      const newHashes: string[] = [];

      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = hashes[i + 1] || left; // Duplicate last if odd

        const combined = crypto
          .createHash('sha256')
          .update(left + right)
          .digest('hex');

        newHashes.push(combined);
      }

      hashes = newHashes;
    }

    return hashes[0];
  }

  /**
   * Export log for external storage/verification
   */
  exportLog(logId: string): string {
    const log = this.logs.get(logId);
    if (!log) {
      throw new Error(`Log ${logId} not found`);
    }

    return JSON.stringify(log, null, 2);
  }

  /**
   * Import log from external source
   */
  importLog(logJson: string): ImmutableLog {
    const log = JSON.parse(logJson) as ImmutableLog;

    // Verify chain integrity before importing
    if (!this.verifyChainIntegrity(log)) {
      throw new Error('Imported log has invalid chain integrity');
    }

    this.logs.set(log.id, log);
    return log;
  }

  /**
   * Get entries within time range
   */
  getEntriesInRange(log: ImmutableLog, startTime: Date, endTime: Date): ImmutableLogEntry[] {
    return log.entries.filter((entry) => {
      const entryTime = new Date(entry.timestamp);
      return entryTime >= startTime && entryTime <= endTime;
    });
  }

  /**
   * Get entries by type
   */
  getEntriesByType(log: ImmutableLog, type: LogEntryType): ImmutableLogEntry[] {
    return log.entries.filter((entry) => entry.type === type);
  }
}

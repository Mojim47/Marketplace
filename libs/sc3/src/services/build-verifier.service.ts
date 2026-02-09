// ═══════════════════════════════════════════════════════════════════════════
// Build Verifier Service - SC³ Build Verification
// ═══════════════════════════════════════════════════════════════════════════
// Implements: hash(b) = hash_canonical(b, T) ∧ slsa_level(b) ≥ 3
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type Build,
  type BuildEnvironment,
  type BuildStatus,
  type BuildVerificationResult,
  type ProvenanceAttestation,
  type SC3Failure,
  SC3FailureCategory,
  type SLSALevel,
} from '../types';

/**
 * Build verification options
 */
export interface BuildVerificationOptions {
  /** Time bound for verification */
  time_bound: Date;
  /** Minimum SLSA level required */
  min_slsa_level: SLSALevel;
  /** Trusted builder IDs */
  trusted_builders: string[];
  /** Require hermetic builds */
  require_hermetic: boolean;
  /** Verify provenance signatures */
  verify_provenance: boolean;
}

/**
 * Canonical hash computation options
 */
export interface CanonicalHashOptions {
  /** Include environment in hash */
  include_environment: boolean;
  /** Include timestamp in hash */
  include_timestamp: boolean;
  /** Hash algorithm */
  algorithm: 'sha256' | 'sha384' | 'sha512';
}

@Injectable()
export class BuildVerifierService {
  private readonly logger = new Logger(BuildVerifierService.name);

  /**
   * Verify all builds meet SC³ requirements
   * ∀b∈Builds: hash(b) = hash_canonical(b, T) ∧ slsa_level(b) ≥ 3
   */
  async verifyBuilds(
    builds: Build[],
    options: BuildVerificationOptions
  ): Promise<{ result: BuildVerificationResult; failures: SC3Failure[] }> {
    const failures: SC3Failure[] = [];
    const failedBuilds: string[] = [];
    let canonicalHashValid = 0;
    let slsaCompliant = 0;

    for (const build of builds) {
      const buildFailures = await this.verifyBuild(build, options);

      if (buildFailures.length === 0) {
        canonicalHashValid++;
        if (build.slsa_level >= options.min_slsa_level) {
          slsaCompliant++;
        }
      } else {
        failedBuilds.push(build.id);
        failures.push(...buildFailures);
      }
    }

    const passed =
      failedBuilds.length === 0 &&
      canonicalHashValid === builds.length &&
      slsaCompliant === builds.length;

    return {
      result: {
        passed,
        total_builds: builds.length,
        canonical_hash_valid: canonicalHashValid,
        slsa_compliant: slsaCompliant,
        failed_builds: failedBuilds,
      },
      failures,
    };
  }

  /**
   * Verify a single build
   */
  async verifyBuild(build: Build, options: BuildVerificationOptions): Promise<SC3Failure[]> {
    const failures: SC3Failure[] = [];

    // 1. Verify canonical hash
    const canonicalHash = this.computeCanonicalHash(build, options.time_bound);
    if (build.canonical_hash && build.canonical_hash !== canonicalHash) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'CANONICAL_HASH_MISMATCH',
        message: `Build ${build.id} canonical hash mismatch`,
        message_fa: `هش کانونیکال بیلد ${build.id} مطابقت ندارد`,
        entity_id: build.id,
        details: {
          expected: build.canonical_hash,
          computed: canonicalHash,
        },
      });
    }

    // 2. Verify SLSA level
    if (build.slsa_level < options.min_slsa_level) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'SLSA_LEVEL_INSUFFICIENT',
        message: `Build ${build.id} SLSA level ${build.slsa_level} < required ${options.min_slsa_level}`,
        message_fa: `سطح SLSA بیلد ${build.id} کمتر از حد مجاز است`,
        entity_id: build.id,
        details: {
          actual_level: build.slsa_level,
          required_level: options.min_slsa_level,
        },
      });
    }

    // 3. Verify trusted builder
    if (!options.trusted_builders.includes(build.builder_id)) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'UNTRUSTED_BUILDER',
        message: `Build ${build.id} uses untrusted builder: ${build.builder_id}`,
        message_fa: `بیلد ${build.id} از بیلدر غیرمجاز استفاده کرده است`,
        entity_id: build.id,
        details: {
          builder_id: build.builder_id,
          trusted_builders: options.trusted_builders,
        },
      });
    }

    // 4. Verify hermetic build (if required)
    if (options.require_hermetic && !build.environment.hermetic) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'NON_HERMETIC_BUILD',
        message: `Build ${build.id} is not hermetic`,
        message_fa: `بیلد ${build.id} هرمتیک نیست`,
        entity_id: build.id,
      });
    }

    // 5. Verify build timestamp within time bound
    const buildTime = new Date(build.timestamp);
    if (buildTime > options.time_bound) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'BUILD_TIMESTAMP_EXCEEDED',
        message: `Build ${build.id} timestamp exceeds time bound`,
        message_fa: `زمان بیلد ${build.id} از محدوده زمانی فراتر رفته است`,
        entity_id: build.id,
        details: {
          build_timestamp: build.timestamp,
          time_bound: options.time_bound.toISOString(),
        },
      });
    }

    // 6. Verify provenance (if required)
    if (options.verify_provenance && build.provenance) {
      const provenanceFailures = this.verifyProvenance(build.id, build.provenance);
      failures.push(...provenanceFailures);
    }

    // 7. Verify build status
    if (build.status !== 'VERIFIED') {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'BUILD_NOT_VERIFIED',
        message: `Build ${build.id} status is ${build.status}, expected VERIFIED`,
        message_fa: `وضعیت بیلد ${build.id} تأیید نشده است`,
        entity_id: build.id,
        details: { status: build.status },
      });
    }

    return failures;
  }

  /**
   * Compute canonical hash for reproducibility verification
   * hash_canonical(b, T) - deterministic hash computation
   */
  computeCanonicalHash(
    build: Build,
    timeBound: Date,
    options: CanonicalHashOptions = {
      include_environment: true,
      include_timestamp: false,
      algorithm: 'sha256',
    }
  ): string {
    const hasher = crypto.createHash(options.algorithm);

    // Canonical ordering of build properties
    const canonicalData: Record<string, unknown> = {
      source_repo: build.source_repo,
      commit_sha: build.commit_sha,
      config_hash: build.config_hash,
      builder_id: build.builder_id,
    };

    if (options.include_environment) {
      canonicalData.environment = this.canonicalizeEnvironment(build.environment);
    }

    if (options.include_timestamp) {
      // Normalize timestamp to time bound for reproducibility
      canonicalData.time_bound = timeBound.toISOString();
    }

    // Sort keys for deterministic serialization
    const sortedData = this.sortObjectKeys(canonicalData);
    const serialized = JSON.stringify(sortedData);

    hasher.update(serialized, 'utf8');
    return hasher.digest('hex');
  }

  /**
   * Verify build hash integrity
   */
  verifyBuildHash(build: Build): boolean {
    const computedHash = this.computeBuildHash(build);
    return computedHash === build.hash;
  }

  /**
   * Compute build output hash
   */
  computeBuildHash(build: Build): string {
    const hasher = crypto.createHash('sha256');

    // Hash build outputs deterministically
    const buildData = {
      id: build.id,
      source_repo: build.source_repo,
      commit_sha: build.commit_sha,
      config_hash: build.config_hash,
      environment: this.canonicalizeEnvironment(build.environment),
    };

    hasher.update(JSON.stringify(this.sortObjectKeys(buildData)), 'utf8');
    return hasher.digest('hex');
  }

  /**
   * Verify SLSA Level 3 requirements
   * @see https://slsa.dev/spec/v1.0/levels#build-l3
   */
  verifySLSALevel3(build: Build): { compliant: boolean; missing: string[] } {
    const missing: string[] = [];

    // L3 Requirement 1: Hardened build platform
    if (!build.environment.hermetic) {
      missing.push('Hermetic build environment required');
    }

    // L3 Requirement 2: Non-falsifiable provenance
    if (!build.provenance) {
      missing.push('Provenance attestation required');
    } else {
      if (!build.provenance.signature) {
        missing.push('Provenance signature required');
      }
      if (!build.provenance.builder.id) {
        missing.push('Builder identity required');
      }
    }

    // L3 Requirement 3: Isolated build
    if (!build.environment.container_digest) {
      missing.push('Containerized build environment recommended');
    }

    // L3 Requirement 4: Parameterless build (no user-defined parameters)
    if (
      build.provenance?.metadata?.parameters &&
      Object.keys(build.provenance.metadata.parameters).length > 0
    ) {
      // Parameters are allowed but must be recorded
      this.logger.log('Build has parameters recorded in provenance');
    }

    return {
      compliant: missing.length === 0,
      missing,
    };
  }

  /**
   * Verify provenance attestation
   */
  private verifyProvenance(buildId: string, provenance: ProvenanceAttestation): SC3Failure[] {
    const failures: SC3Failure[] = [];

    // Verify provenance version
    if (!provenance.version || !provenance.version.startsWith('1.')) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'INVALID_PROVENANCE_VERSION',
        message: `Build ${buildId} has invalid provenance version`,
        message_fa: `نسخه provenance بیلد ${buildId} نامعتبر است`,
        entity_id: buildId,
        details: { version: provenance.version },
      });
    }

    // Verify builder identity
    if (!provenance.builder?.id) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'MISSING_BUILDER_IDENTITY',
        message: `Build ${buildId} provenance missing builder identity`,
        message_fa: `هویت بیلدر در provenance بیلد ${buildId} موجود نیست`,
        entity_id: buildId,
      });
    }

    // Verify materials (inputs)
    if (!provenance.materials || provenance.materials.length === 0) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'MISSING_PROVENANCE_MATERIALS',
        message: `Build ${buildId} provenance missing materials`,
        message_fa: `مواد ورودی در provenance بیلد ${buildId} موجود نیست`,
        entity_id: buildId,
      });
    }

    // Verify subjects (outputs)
    if (!provenance.subject || provenance.subject.length === 0) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'MISSING_PROVENANCE_SUBJECTS',
        message: `Build ${buildId} provenance missing subjects`,
        message_fa: `خروجی‌ها در provenance بیلد ${buildId} موجود نیست`,
        entity_id: buildId,
      });
    }

    // Verify signature (for SLSA L3)
    if (!provenance.signature) {
      failures.push({
        category: SC3FailureCategory.BUILD,
        code: 'MISSING_PROVENANCE_SIGNATURE',
        message: `Build ${buildId} provenance not signed`,
        message_fa: `provenance بیلد ${buildId} امضا نشده است`,
        entity_id: buildId,
      });
    }

    return failures;
  }

  /**
   * Canonicalize environment for deterministic hashing
   */
  private canonicalizeEnvironment(env: BuildEnvironment): Record<string, unknown> {
    return {
      arch: env.arch,
      compiler_version: env.compiler_version,
      container_digest: env.container_digest || null,
      env_hash: env.env_hash,
      hermetic: env.hermetic,
      os: env.os,
    };
  }

  /**
   * Sort object keys recursively for deterministic serialization
   */
  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        typeof item === 'object' && item !== null
          ? this.sortObjectKeys(item as Record<string, unknown>)
          : item
      ) as unknown as Record<string, unknown>;
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      const value = obj[key];
      sorted[key] =
        typeof value === 'object' && value !== null
          ? this.sortObjectKeys(value as Record<string, unknown>)
          : value;
    }

    return sorted;
  }

  /**
   * Create a new build record
   */
  createBuild(params: {
    source_repo: string;
    commit_sha: string;
    config_hash: string;
    builder_id: string;
    environment: BuildEnvironment;
    slsa_level: SLSALevel;
  }): Build {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const build: Build = {
      id,
      timestamp,
      hash: '',
      slsa_level: params.slsa_level,
      source_repo: params.source_repo,
      commit_sha: params.commit_sha,
      config_hash: params.config_hash,
      builder_id: params.builder_id,
      environment: params.environment,
      status: 'PENDING' as BuildStatus,
    };

    // Compute hash
    build.hash = this.computeBuildHash(build);
    build.canonical_hash = this.computeCanonicalHash(build, new Date());

    return build;
  }
}

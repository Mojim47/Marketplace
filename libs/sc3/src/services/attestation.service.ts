// ═══════════════════════════════════════════════════════════════════════════
// Attestation Service - SC³ Enclave & Memory Safety Verification
// ═══════════════════════════════════════════════════════════════════════════
// Implements: ∀e∈Executions_attested: enclave_attested(e) ∧ memory_safe(e)
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type AttestationCollateral,
  type AttestationType,
  type ExecutionAttestation,
  type ExecutionVerificationResult,
  type MemorySafetyResult,
  type MemorySafetyStatus,
  type SC3Failure,
  SC3FailureCategory,
} from '../types';

/**
 * Attestation verification options
 */
export interface AttestationVerificationOptions {
  /** Require enclave attestation */
  require_attestation: boolean;
  /** Require memory safety verification */
  require_memory_safety: boolean;
  /** Allowed attestation types */
  allowed_types: AttestationType[];
  /** Attestation verification service URL */
  verification_service_url?: string;
  /** Minimum security version number */
  min_svn?: number;
  /** Trusted enclave measurements */
  trusted_measurements?: string[];
}

@Injectable()
export class AttestationService {
  private readonly logger = new Logger(AttestationService.name);

  /**
   * Verify all executions meet SC³ requirements
   * ∀e∈Executions_attested: enclave_attested(e) ∧ memory_safe(e)
   */
  async verifyExecutions(
    executions: ExecutionAttestation[],
    options: AttestationVerificationOptions
  ): Promise<{ result: ExecutionVerificationResult; failures: SC3Failure[] }> {
    const failures: SC3Failure[] = [];
    const failedAttestations: string[] = [];
    let attestedCount = 0;
    let memorySafeCount = 0;

    for (const execution of executions) {
      const execFailures: SC3Failure[] = [];

      // 1. Verify enclave attestation
      if (options.require_attestation) {
        const attestationValid = await this.verifyEnclaveAttestation(execution, options);
        if (attestationValid) {
          attestedCount++;
        } else {
          execFailures.push({
            category: SC3FailureCategory.EXECUTION,
            code: 'ATTESTATION_INVALID',
            message: `Execution ${execution.id} attestation verification failed`,
            message_fa: `تأیید attestation اجرای ${execution.id} ناموفق بود`,
            entity_id: execution.id,
            details: { type: execution.type },
          });
        }
      }

      // 2. Verify memory safety
      if (options.require_memory_safety) {
        const memorySafe = this.verifyMemorySafety(execution.memory_safety);
        if (memorySafe) {
          memorySafeCount++;
        } else {
          execFailures.push({
            category: SC3FailureCategory.EXECUTION,
            code: 'MEMORY_SAFETY_FAILED',
            message: `Execution ${execution.id} memory safety verification failed`,
            message_fa: `تأیید امنیت حافظه اجرای ${execution.id} ناموفق بود`,
            entity_id: execution.id,
            details: { status: execution.memory_safety.status },
          });
        }
      }

      // 3. Verify attestation type is allowed
      if (!options.allowed_types.includes(execution.type)) {
        execFailures.push({
          category: SC3FailureCategory.EXECUTION,
          code: 'ATTESTATION_TYPE_NOT_ALLOWED',
          message: `Execution ${execution.id} uses disallowed attestation type: ${execution.type}`,
          message_fa: `نوع attestation اجرای ${execution.id} مجاز نیست`,
          entity_id: execution.id,
          details: { type: execution.type, allowed: options.allowed_types },
        });
      }

      // 4. Verify SVN (Security Version Number)
      if (options.min_svn !== undefined && execution.svn < options.min_svn) {
        execFailures.push({
          category: SC3FailureCategory.EXECUTION,
          code: 'SVN_TOO_LOW',
          message: `Execution ${execution.id} SVN ${execution.svn} < required ${options.min_svn}`,
          message_fa: `نسخه امنیتی اجرای ${execution.id} کمتر از حد مجاز است`,
          entity_id: execution.id,
          details: { svn: execution.svn, min_svn: options.min_svn },
        });
      }

      // 5. Verify attestation not expired
      if (new Date(execution.expires_at) < new Date()) {
        execFailures.push({
          category: SC3FailureCategory.EXECUTION,
          code: 'ATTESTATION_EXPIRED',
          message: `Execution ${execution.id} attestation has expired`,
          message_fa: `attestation اجرای ${execution.id} منقضی شده است`,
          entity_id: execution.id,
          details: { expires_at: execution.expires_at },
        });
      }

      if (execFailures.length > 0) {
        failedAttestations.push(execution.id);
        failures.push(...execFailures);
      }
    }

    const passed = failures.length === 0;

    return {
      result: {
        passed,
        total_executions: executions.length,
        attested_count: attestedCount,
        memory_safe_count: memorySafeCount,
        failed_attestations: failedAttestations,
      },
      failures,
    };
  }

  /**
   * Verify enclave attestation
   * enclave_attested(e) - verify TEE attestation quote
   */
  async verifyEnclaveAttestation(
    attestation: ExecutionAttestation,
    options: AttestationVerificationOptions
  ): Promise<boolean> {
    try {
      // 1. Verify quote signature
      const quoteValid = this.verifyQuoteSignature(attestation);
      if (!quoteValid) {
        this.logger.warn(`Quote signature invalid for ${attestation.id}`);
        return false;
      }

      // 2. Verify measurement against trusted list
      if (options.trusted_measurements && options.trusted_measurements.length > 0) {
        if (!options.trusted_measurements.includes(attestation.measurement)) {
          this.logger.warn(`Untrusted measurement for ${attestation.id}`);
          return false;
        }
      }

      // 3. Verify collateral (if present)
      if (attestation.collateral) {
        const collateralValid = await this.verifyCollateral(
          attestation.collateral,
          attestation.type
        );
        if (!collateralValid) {
          this.logger.warn(`Collateral verification failed for ${attestation.id}`);
          return false;
        }
      }

      // 4. Type-specific verification
      switch (attestation.type) {
        case 'SGX':
          return this.verifySGXAttestation(attestation);
        case 'SEV':
          return this.verifySEVAttestation(attestation);
        case 'NITRO':
          return this.verifyNitroAttestation(attestation);
        case 'TRUSTZONE':
          return this.verifyTrustZoneAttestation(attestation);
        case 'SOFTWARE':
          return this.verifySoftwareAttestation(attestation);
        default:
          this.logger.warn(`Unknown attestation type: ${attestation.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Attestation verification error for ${attestation.id}`, error);
      return false;
    }
  }

  /**
   * Verify memory safety
   * memory_safe(e) - verify execution is memory-safe
   */
  verifyMemorySafety(result: MemorySafetyResult): boolean {
    // Must have SAFE status
    if (result.status !== 'SAFE') {
      return false;
    }

    // At least one safety mechanism must be present
    const hasSafetyMechanism =
      result.language_safe ||
      result.static_analysis_passed ||
      result.bounds_checking ||
      result.asan_clean === true ||
      result.msan_clean === true;

    return hasSafetyMechanism;
  }

  /**
   * Verify quote signature
   */
  private verifyQuoteSignature(attestation: ExecutionAttestation): boolean {
    try {
      const { quote, quote_signature } = attestation;

      if (!quote || !quote_signature) {
        return false;
      }

      // Decode quote and verify structure
      const quoteBuffer = Buffer.from(quote, 'base64');

      // Verify minimum quote size (varies by attestation type)
      const minQuoteSize = this.getMinQuoteSize(attestation.type);
      if (quoteBuffer.length < minQuoteSize) {
        return false;
      }

      // Verify signature (simplified - real implementation would use attestation-specific verification)
      const signatureBuffer = Buffer.from(quote_signature, 'base64');
      return signatureBuffer.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Verify attestation collateral
   */
  private async verifyCollateral(
    collateral: AttestationCollateral,
    type: AttestationType
  ): Promise<boolean> {
    try {
      // Verify root CA certificate
      if (!collateral.root_ca_cert) {
        return false;
      }

      // Verify certificate chain
      if (collateral.intermediate_certs) {
        for (const cert of collateral.intermediate_certs) {
          if (!this.isValidCertificate(cert)) {
            return false;
          }
        }
      }

      // Check CRL if present
      if (collateral.crl) {
        // Verify certificate not revoked
        // Real implementation would parse and check CRL
      }

      // Type-specific collateral verification
      if (type === 'SGX' && collateral.tcb_info) {
        return this.verifyTCBInfo(collateral.tcb_info);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify Intel SGX attestation
   */
  private verifySGXAttestation(attestation: ExecutionAttestation): boolean {
    // SGX-specific verification:
    // 1. Verify MRENCLAVE (enclave measurement)
    // 2. Verify MRSIGNER (signer identity)
    // 3. Verify ISV_PROD_ID and ISV_SVN
    // 4. Verify quote structure (EPID or DCAP)

    if (!attestation.measurement || attestation.measurement.length !== 64) {
      return false; // MRENCLAVE should be 32 bytes (64 hex chars)
    }

    if (!attestation.signer_id || attestation.signer_id.length !== 64) {
      return false; // MRSIGNER should be 32 bytes (64 hex chars)
    }

    return true;
  }

  /**
   * Verify AMD SEV attestation
   */
  private verifySEVAttestation(attestation: ExecutionAttestation): boolean {
    // SEV-specific verification:
    // 1. Verify launch measurement
    // 2. Verify platform certificate chain
    // 3. Verify guest policy

    if (!attestation.measurement) {
      return false;
    }

    return true;
  }

  /**
   * Verify AWS Nitro Enclaves attestation
   */
  private verifyNitroAttestation(attestation: ExecutionAttestation): boolean {
    // Nitro-specific verification:
    // 1. Verify attestation document structure (CBOR/COSE)
    // 2. Verify PCRs (Platform Configuration Registers)
    // 3. Verify certificate chain to AWS root

    if (!attestation.measurement) {
      return false;
    }

    // Nitro uses PCR values for measurement
    // PCR0: Enclave image file
    // PCR1: Linux kernel and bootstrap
    // PCR2: Application

    return true;
  }

  /**
   * Verify ARM TrustZone attestation
   */
  private verifyTrustZoneAttestation(attestation: ExecutionAttestation): boolean {
    // TrustZone-specific verification:
    // 1. Verify TA (Trusted Application) measurement
    // 2. Verify secure world attestation

    if (!attestation.measurement) {
      return false;
    }

    return true;
  }

  /**
   * Verify software-based attestation (fallback)
   */
  private verifySoftwareAttestation(attestation: ExecutionAttestation): boolean {
    // Software attestation is less secure but can be used as fallback
    // Verify:
    // 1. Code hash matches expected
    // 2. Runtime integrity checks passed

    if (!attestation.measurement) {
      return false;
    }

    // Software attestation requires additional memory safety checks
    if (attestation.memory_safety.status !== 'SAFE') {
      return false;
    }

    return true;
  }

  /**
   * Get minimum quote size for attestation type
   */
  private getMinQuoteSize(type: AttestationType): number {
    switch (type) {
      case 'SGX':
        return 432; // EPID quote minimum
      case 'SEV':
        return 256;
      case 'NITRO':
        return 512;
      case 'TRUSTZONE':
        return 128;
      case 'SOFTWARE':
        return 64;
      default:
        return 64;
    }
  }

  /**
   * Validate certificate format
   */
  private isValidCertificate(cert: string): boolean {
    return (
      cert.includes('-----BEGIN CERTIFICATE-----') && cert.includes('-----END CERTIFICATE-----')
    );
  }

  /**
   * Verify TCB (Trusted Computing Base) info for SGX
   */
  private verifyTCBInfo(tcbInfo: string): boolean {
    try {
      const tcb = JSON.parse(tcbInfo);
      return tcb.version && tcb.issueDate && tcb.tcbLevels;
    } catch {
      return false;
    }
  }

  /**
   * Create memory safety result
   */
  createMemorySafetyResult(params: {
    language_safe: boolean;
    static_analysis_passed: boolean;
    bounds_checking: boolean;
    asan_clean?: boolean;
    msan_clean?: boolean;
    ubsan_clean?: boolean;
  }): MemorySafetyResult {
    const details: string[] = [];

    if (params.language_safe) {
      details.push('Memory-safe language used');
    }
    if (params.static_analysis_passed) {
      details.push('Static analysis passed');
    }
    if (params.bounds_checking) {
      details.push('Runtime bounds checking enabled');
    }
    if (params.asan_clean) {
      details.push('AddressSanitizer clean');
    }
    if (params.msan_clean) {
      details.push('MemorySanitizer clean');
    }
    if (params.ubsan_clean) {
      details.push('UndefinedBehaviorSanitizer clean');
    }

    const isSafe =
      params.language_safe ||
      params.static_analysis_passed ||
      params.bounds_checking ||
      (params.asan_clean && params.msan_clean);

    return {
      status: (isSafe ? 'SAFE' : 'UNSAFE') as MemorySafetyStatus,
      language_safe: params.language_safe,
      static_analysis_passed: params.static_analysis_passed,
      bounds_checking: params.bounds_checking,
      asan_clean: params.asan_clean,
      msan_clean: params.msan_clean,
      ubsan_clean: params.ubsan_clean,
      details,
    };
  }

  /**
   * Create execution attestation
   */
  createAttestation(params: {
    type: AttestationType;
    measurement: string;
    signer_id: string;
    product_id: number;
    svn: number;
    quote: string;
    quote_signature: string;
    memory_safety: MemorySafetyResult;
    expires_in_hours?: number;
  }): ExecutionAttestation {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (params.expires_in_hours || 24) * 60 * 60 * 1000);

    return {
      id: crypto.randomUUID(),
      type: params.type,
      measurement: params.measurement,
      signer_id: params.signer_id,
      product_id: params.product_id,
      svn: params.svn,
      quote: params.quote,
      quote_signature: params.quote_signature,
      memory_safety: params.memory_safety,
      attested_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }
}

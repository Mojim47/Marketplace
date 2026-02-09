// ═══════════════════════════════════════════════════════════════════════════
// Provenance Service - SC³ Artifact Provenance Verification
// ═══════════════════════════════════════════════════════════════════════════
// Implements: ∀a∈Artifacts: provenance_verified(a)
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type Artifact,
  type ArtifactSignature,
  type ArtifactType,
  type ArtifactVerificationResult,
  type ProvenanceAttestation,
  type ProvenanceMaterial,
  type ProvenanceStatus,
  type SC3Failure,
  SC3FailureCategory,
  type TrustedKey,
} from '../types';

/**
 * Provenance verification options
 */
export interface ProvenanceVerificationOptions {
  /** Trusted builder IDs */
  trusted_builders: string[];
  /** Trusted signing keys */
  trusted_keys: TrustedKey[];
  /** Require provenance signature */
  require_signature: boolean;
  /** Require reproducible builds */
  require_reproducible: boolean;
  /** Verify material digests */
  verify_materials: boolean;
}

@Injectable()
export class ProvenanceService {
  private readonly logger = new Logger(ProvenanceService.name);

  /**
   * Verify all artifacts have valid provenance
   * ∀a∈Artifacts: provenance_verified(a)
   */
  async verifyArtifacts(
    artifacts: Artifact[],
    options: ProvenanceVerificationOptions
  ): Promise<{ result: ArtifactVerificationResult; failures: SC3Failure[] }> {
    const failures: SC3Failure[] = [];
    const failedArtifacts: string[] = [];
    let provenanceValid = 0;

    for (const artifact of artifacts) {
      const artifactFailures = await this.verifyArtifact(artifact, options);

      if (artifactFailures.length === 0) {
        provenanceValid++;
      } else {
        failedArtifacts.push(artifact.id);
        failures.push(...artifactFailures);
      }
    }

    const passed = failures.length === 0;

    return {
      result: {
        passed,
        total_artifacts: artifacts.length,
        provenance_valid: provenanceValid,
        failed_artifacts: failedArtifacts,
      },
      failures,
    };
  }

  /**
   * Verify a single artifact's provenance
   * provenance_verified(a) - verify artifact has valid provenance chain
   */
  async verifyArtifact(
    artifact: Artifact,
    options: ProvenanceVerificationOptions
  ): Promise<SC3Failure[]> {
    const failures: SC3Failure[] = [];

    // 1. Verify provenance exists
    if (!artifact.provenance) {
      failures.push({
        category: SC3FailureCategory.ARTIFACT,
        code: 'MISSING_PROVENANCE',
        message: `Artifact ${artifact.id} has no provenance attestation`,
        message_fa: `آرتیفکت ${artifact.id} فاقد provenance است`,
        entity_id: artifact.id,
      });
      return failures;
    }

    // 2. Verify builder is trusted
    if (!options.trusted_builders.includes(artifact.provenance.builder.id)) {
      failures.push({
        category: SC3FailureCategory.ARTIFACT,
        code: 'UNTRUSTED_BUILDER',
        message: `Artifact ${artifact.id} built by untrusted builder: ${artifact.provenance.builder.id}`,
        message_fa: `آرتیفکت ${artifact.id} توسط بیلدر غیرمجاز ساخته شده است`,
        entity_id: artifact.id,
        details: { builder_id: artifact.provenance.builder.id },
      });
    }

    // 3. Verify provenance signature
    if (options.require_signature) {
      if (!artifact.provenance.signature) {
        failures.push({
          category: SC3FailureCategory.ARTIFACT,
          code: 'MISSING_PROVENANCE_SIGNATURE',
          message: `Artifact ${artifact.id} provenance is not signed`,
          message_fa: `provenance آرتیفکت ${artifact.id} امضا نشده است`,
          entity_id: artifact.id,
        });
      } else {
        const signatureValid = await this.verifyProvenanceSignature(
          artifact.provenance,
          options.trusted_keys
        );
        if (!signatureValid) {
          failures.push({
            category: SC3FailureCategory.ARTIFACT,
            code: 'INVALID_PROVENANCE_SIGNATURE',
            message: `Artifact ${artifact.id} provenance signature is invalid`,
            message_fa: `امضای provenance آرتیفکت ${artifact.id} نامعتبر است`,
            entity_id: artifact.id,
          });
        }
      }
    }

    // 4. Verify artifact hash matches provenance subject
    const hashMatch = this.verifyArtifactHashInProvenance(artifact);
    if (!hashMatch) {
      failures.push({
        category: SC3FailureCategory.ARTIFACT,
        code: 'HASH_MISMATCH',
        message: `Artifact ${artifact.id} hash does not match provenance subject`,
        message_fa: `هش آرتیفکت ${artifact.id} با provenance مطابقت ندارد`,
        entity_id: artifact.id,
        details: { artifact_hash: artifact.hash },
      });
    }

    // 5. Verify reproducible build (if required)
    if (options.require_reproducible && !artifact.provenance.metadata.reproducible) {
      failures.push({
        category: SC3FailureCategory.ARTIFACT,
        code: 'NOT_REPRODUCIBLE',
        message: `Artifact ${artifact.id} build is not reproducible`,
        message_fa: `بیلد آرتیفکت ${artifact.id} قابل بازتولید نیست`,
        entity_id: artifact.id,
      });
    }

    // 6. Verify materials (if required)
    if (options.verify_materials) {
      const materialsValid = this.verifyMaterials(artifact.provenance.materials);
      if (!materialsValid) {
        failures.push({
          category: SC3FailureCategory.ARTIFACT,
          code: 'INVALID_MATERIALS',
          message: `Artifact ${artifact.id} has invalid or missing materials`,
          message_fa: `مواد ورودی آرتیفکت ${artifact.id} نامعتبر است`,
          entity_id: artifact.id,
        });
      }
    }

    // 7. Verify artifact signatures
    for (const sig of artifact.signatures) {
      if (!sig.verified) {
        const sigValid = await this.verifyArtifactSignature(artifact, sig, options.trusted_keys);
        if (!sigValid) {
          failures.push({
            category: SC3FailureCategory.ARTIFACT,
            code: 'INVALID_ARTIFACT_SIGNATURE',
            message: `Artifact ${artifact.id} signature from ${sig.signer} is invalid`,
            message_fa: `امضای آرتیفکت ${artifact.id} از ${sig.signer} نامعتبر است`,
            entity_id: artifact.id,
            details: { signer: sig.signer, key_id: sig.key_id },
          });
        }
      }
    }

    return failures;
  }

  /**
   * Verify provenance signature
   */
  async verifyProvenanceSignature(
    provenance: ProvenanceAttestation,
    trustedKeys: TrustedKey[]
  ): Promise<boolean> {
    if (!provenance.signature) {
      return false;
    }

    try {
      // Create canonical provenance data for verification
      const canonicalData = this.canonicalizeProvenance(provenance);

      // Try each trusted key
      for (const key of trustedKeys) {
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
          continue; // Skip expired keys
        }

        try {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(canonicalData);

          if (verifier.verify(key.public_key, provenance.signature, 'base64')) {
            return true;
          }
        } catch {
          // Try next key
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Provenance signature verification failed', error);
      return false;
    }
  }

  /**
   * Verify artifact hash matches provenance subject
   */
  verifyArtifactHashInProvenance(artifact: Artifact): boolean {
    if (!artifact.provenance?.subject) {
      return false;
    }

    for (const subject of artifact.provenance.subject) {
      // Check if artifact name matches
      if (subject.name === artifact.name || subject.name === artifact.id) {
        // Check if hash matches
        const sha256 = subject.digest.sha256;
        const sha512 = subject.digest.sha512;

        if (sha256 && sha256 === artifact.hash) {
          return true;
        }
        if (sha512 && artifact.hash_sha512 && sha512 === artifact.hash_sha512) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Verify materials have valid digests
   */
  verifyMaterials(materials: ProvenanceMaterial[]): boolean {
    if (!materials || materials.length === 0) {
      return false;
    }

    for (const material of materials) {
      if (!material.uri || !material.digest) {
        return false;
      }

      // Must have at least one digest algorithm
      const hasDigest = material.digest.sha256 || material.digest.sha512 || material.digest.sha1;
      if (!hasDigest) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verify artifact signature
   */
  async verifyArtifactSignature(
    artifact: Artifact,
    signature: ArtifactSignature,
    trustedKeys: TrustedKey[]
  ): Promise<boolean> {
    const trustedKey = trustedKeys.find((k) => k.id === signature.key_id);
    if (!trustedKey) {
      return false;
    }

    if (trustedKey.expires_at && new Date(trustedKey.expires_at) < new Date()) {
      return false;
    }

    try {
      const verifier = crypto.createVerify(signature.algorithm);
      verifier.update(artifact.hash);

      return verifier.verify(trustedKey.public_key, signature.signature, 'base64');
    } catch {
      return false;
    }
  }

  /**
   * Canonicalize provenance for signature verification
   */
  private canonicalizeProvenance(provenance: ProvenanceAttestation): string {
    const canonical = {
      _type: 'https://in-toto.io/Statement/v1',
      predicateType: provenance.build_type,
      subject: provenance.subject.map((s) => ({
        name: s.name,
        digest: this.sortObject(s.digest),
      })),
      predicate: {
        builder: { id: provenance.builder.id },
        buildType: provenance.build_type,
        invocation: {
          configSource: {},
          parameters: provenance.metadata.parameters || {},
        },
        metadata: {
          buildInvocationId: provenance.metadata.invocation_id,
          buildStartedOn: provenance.metadata.build_started_on,
          buildFinishedOn: provenance.metadata.build_finished_on,
          reproducible: provenance.metadata.reproducible,
        },
        materials: provenance.materials.map((m) => ({
          uri: m.uri,
          digest: this.sortObject(m.digest),
        })),
      },
    };

    return JSON.stringify(canonical);
  }

  /**
   * Sort object keys for deterministic serialization
   */
  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = obj[key];
    }
    return sorted;
  }

  /**
   * Create provenance attestation
   */
  createProvenance(params: {
    build_type: string;
    builder_id: string;
    materials: Array<{ uri: string; sha256: string }>;
    subjects: Array<{ name: string; sha256: string; sha512?: string }>;
    invocation_id: string;
    build_started_on: Date;
    build_finished_on: Date;
    reproducible: boolean;
    parameters?: Record<string, unknown>;
  }): ProvenanceAttestation {
    return {
      version: '1.0',
      build_type: params.build_type,
      builder: {
        id: params.builder_id,
      },
      metadata: {
        invocation_id: params.invocation_id,
        build_started_on: params.build_started_on.toISOString(),
        build_finished_on: params.build_finished_on.toISOString(),
        reproducible: params.reproducible,
        parameters: params.parameters,
      },
      materials: params.materials.map((m) => ({
        uri: m.uri,
        digest: { sha256: m.sha256 },
      })),
      subject: params.subjects.map((s) => ({
        name: s.name,
        digest: {
          sha256: s.sha256,
          ...(s.sha512 && { sha512: s.sha512 }),
        },
      })),
    };
  }

  /**
   * Create artifact record
   */
  createArtifact(params: {
    name: string;
    type: ArtifactType;
    hash: string;
    hash_sha512?: string;
    size: number;
    build_id: string;
    provenance: ProvenanceAttestation;
  }): Artifact {
    return {
      id: crypto.randomUUID(),
      name: params.name,
      type: params.type,
      hash: params.hash,
      hash_sha512: params.hash_sha512,
      size: params.size,
      created_at: new Date().toISOString(),
      provenance: params.provenance,
      signatures: [],
      build_id: params.build_id,
    };
  }

  /**
   * Sign artifact
   */
  signArtifact(
    artifact: Artifact,
    privateKey: string,
    keyId: string,
    signer: string,
    algorithm = 'RSA-SHA256'
  ): ArtifactSignature {
    const sign = crypto.createSign(algorithm);
    sign.update(artifact.hash);
    const signature = sign.sign(privateKey, 'base64');

    const artifactSignature: ArtifactSignature = {
      algorithm,
      signature,
      signer,
      key_id: keyId,
      signed_at: new Date().toISOString(),
      verified: true,
    };

    artifact.signatures.push(artifactSignature);
    return artifactSignature;
  }

  /**
   * Compute artifact hash
   */
  computeArtifactHash(data: Buffer, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Get provenance status for artifact
   */
  getProvenanceStatus(artifact: Artifact): ProvenanceStatus {
    if (!artifact.provenance) {
      return 'MISSING' as ProvenanceStatus;
    }

    if (!artifact.provenance.signature) {
      return 'UNVERIFIED' as ProvenanceStatus;
    }

    // Check if artifact hash is in provenance
    const hashMatch = this.verifyArtifactHashInProvenance(artifact);
    if (!hashMatch) {
      return 'INVALID' as ProvenanceStatus;
    }

    return 'VERIFIED' as ProvenanceStatus;
  }
}

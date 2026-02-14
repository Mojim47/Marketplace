// ═══════════════════════════════════════════════════════════════════════════
// SC³ Library - Supply Chain Security & Compliance
// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-grade supply chain security implementing SLSA Level 3
// ═══════════════════════════════════════════════════════════════════════════

// Module
export { SC3Module, SC3_CONFIG } from './sc3.module';
export type { SC3ModuleOptions, SC3ModuleAsyncOptions } from './sc3.module';

// Types - Enums
export {
  SLSALevel,
  CVESeverity,
  BuildStatus,
  AttestationType,
  MemorySafetyStatus,
  ProvenanceStatus,
  ArtifactType,
  LogEntryType,
  SC3FailureCategory,
} from './types';

// Types - Interfaces
export type {
  Build,
  BuildEnvironment,
  Dependency,
  DependencySignature,
  CVE,
  ExecutionAttestation,
  AttestationCollateral,
  MemorySafetyResult,
  Artifact,
  ArtifactSignature,
  ProvenanceAttestation,
  BuilderIdentity,
  ProvenanceMetadata,
  ProvenanceMaterial,
  ProvenanceSubject,
  ImmutableLogEntry,
  ImmutableLog,
  SC3VerificationResult,
  BuildVerificationResult,
  DependencyVerificationResult,
  CVEViolation,
  ExecutionVerificationResult,
  ArtifactVerificationResult,
  LogVerificationResult,
  SC3Failure,
  SC3Config,
  TrustedKey,
} from './types';

// Services
export { SC3Service, DEFAULT_SC3_CONFIG } from './services/sc3.service';
export type { SC3VerificationInput } from './services/sc3.service';

export { BuildVerifierService } from './services/build-verifier.service';
export type {
  BuildVerificationOptions,
  CanonicalHashOptions,
} from './services/build-verifier.service';

export { DependencyScannerService } from './services/dependency-scanner.service';
export type { DependencyScanOptions, CVEFetchResult } from './services/dependency-scanner.service';

export { AttestationService } from './services/attestation.service';
export type { AttestationVerificationOptions } from './services/attestation.service';

export { ProvenanceService } from './services/provenance.service';
export type { ProvenanceVerificationOptions } from './services/provenance.service';

export { ImmutableLogService } from './services/immutable-log.service';
export type {
  LogVerificationOptions,
  CreateLogEntryOptions,
} from './services/immutable-log.service';

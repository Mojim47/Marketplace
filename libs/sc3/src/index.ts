// ═══════════════════════════════════════════════════════════════════════════
// SC³ Library - Supply Chain Security & Compliance
// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-grade supply chain security implementing SLSA Level 3
// ═══════════════════════════════════════════════════════════════════════════

export type { SC3ModuleAsyncOptions, SC3ModuleOptions } from './sc3.module';
// Module
export { SC3_CONFIG, SC3Module } from './sc3.module';
export type { AttestationVerificationOptions } from './services/attestation.service';
export { AttestationService } from './services/attestation.service';
export type {
  BuildVerificationOptions,
  CanonicalHashOptions,
} from './services/build-verifier.service';
export { BuildVerifierService } from './services/build-verifier.service';
export type { CVEFetchResult, DependencyScanOptions } from './services/dependency-scanner.service';
export { DependencyScannerService } from './services/dependency-scanner.service';
export type {
  CreateLogEntryOptions,
  LogVerificationOptions,
} from './services/immutable-log.service';
export { ImmutableLogService } from './services/immutable-log.service';
export type { ProvenanceVerificationOptions } from './services/provenance.service';
export { ProvenanceService } from './services/provenance.service';
export type { SC3VerificationInput } from './services/sc3.service';
// Services
export { DEFAULT_SC3_CONFIG, SC3Service } from './services/sc3.service';
// Types - Interfaces
export type {
  Artifact,
  ArtifactSignature,
  ArtifactVerificationResult,
  AttestationCollateral,
  Build,
  BuildEnvironment,
  BuilderIdentity,
  BuildVerificationResult,
  CVE,
  CVEViolation,
  Dependency,
  DependencySignature,
  DependencyVerificationResult,
  ExecutionAttestation,
  ExecutionVerificationResult,
  ImmutableLog,
  ImmutableLogEntry,
  LogVerificationResult,
  MemorySafetyResult,
  ProvenanceAttestation,
  ProvenanceMaterial,
  ProvenanceMetadata,
  ProvenanceSubject,
  SC3Config,
  SC3Failure,
  SC3VerificationResult,
  TrustedKey,
} from './types';
// Types - Enums
export {
  ArtifactType,
  AttestationType,
  BuildStatus,
  CVESeverity,
  LogEntryType,
  MemorySafetyStatus,
  ProvenanceStatus,
  SC3FailureCategory,
  SLSALevel,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// SC³ Types - Supply Chain Security & Compliance
// ═══════════════════════════════════════════════════════════════════════════
// Type definitions for SLSA Level 3 compliant build verification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SLSA (Supply-chain Levels for Software Artifacts) compliance levels
 * @see https://slsa.dev/spec/v1.0/levels
 */
export enum SLSALevel {
  /** No guarantees */
  LEVEL_0 = 0,
  /** Documentation of build process */
  LEVEL_1 = 1,
  /** Tamper resistance of build service */
  LEVEL_2 = 2,
  /** Hardened builds with non-falsifiable provenance */
  LEVEL_3 = 3,
  /** Two-party review + hermetic builds (future) */
  LEVEL_4 = 4,
}

/**
 * CVE severity levels per CVSS v3.1
 * @see https://nvd.nist.gov/vuln-metrics/cvss
 */
export enum CVESeverity {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Build verification status
 */
export enum BuildStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  TAMPERED = 'TAMPERED',
}

/**
 * Attestation type for enclave verification
 */
export enum AttestationType {
  /** Intel SGX attestation */
  SGX = 'SGX',
  /** AMD SEV attestation */
  SEV = 'SEV',
  /** ARM TrustZone attestation */
  TRUSTZONE = 'TRUSTZONE',
  /** AWS Nitro Enclaves attestation */
  NITRO = 'NITRO',
  /** Software-based attestation (fallback) */
  SOFTWARE = 'SOFTWARE',
}

/**
 * Memory safety verification result
 */
export enum MemorySafetyStatus {
  SAFE = 'SAFE',
  UNSAFE = 'UNSAFE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Provenance verification status
 */
export enum ProvenanceStatus {
  VERIFIED = 'VERIFIED',
  UNVERIFIED = 'UNVERIFIED',
  INVALID = 'INVALID',
  MISSING = 'MISSING',
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build artifact with cryptographic verification
 */
export interface Build {
  /** Unique build identifier */
  id: string;
  /** Build timestamp (ISO 8601) */
  timestamp: string;
  /** SHA-256 hash of build output */
  hash: string;
  /** Canonical hash for reproducibility verification */
  canonical_hash?: string;
  /** SLSA compliance level */
  slsa_level: SLSALevel;
  /** Build source repository */
  source_repo: string;
  /** Git commit SHA */
  commit_sha: string;
  /** Build configuration hash */
  config_hash: string;
  /** Builder identity (e.g., GitHub Actions, Jenkins) */
  builder_id: string;
  /** Build environment details */
  environment: BuildEnvironment;
  /** Build provenance attestation */
  provenance?: ProvenanceAttestation;
  /** Build status */
  status: BuildStatus;
}

/**
 * Build environment specification
 */
export interface BuildEnvironment {
  /** Operating system */
  os: string;
  /** Architecture (x86_64, arm64, etc.) */
  arch: string;
  /** Compiler/runtime version */
  compiler_version: string;
  /** Environment variables hash (for reproducibility) */
  env_hash: string;
  /** Container image digest (if containerized) */
  container_digest?: string;
  /** Hermetic build flag */
  hermetic: boolean;
}

/**
 * Software dependency with security metadata
 */
export interface Dependency {
  /** Package name */
  name: string;
  /** Package version (semver) */
  version: string;
  /** Package registry (npm, pypi, maven, etc.) */
  registry: string;
  /** SHA-256 hash of package */
  hash: string;
  /** Digital signature */
  signature?: DependencySignature;
  /** Known CVEs */
  cves: CVE[];
  /** License identifier (SPDX) */
  license: string;
  /** Transitive dependencies */
  transitive_deps?: string[];
  /** Last security scan timestamp */
  last_scanned: string;
}

/**
 * Dependency digital signature
 */
export interface DependencySignature {
  /** Signature algorithm (e.g., RSA-SHA256, ECDSA-P256) */
  algorithm: string;
  /** Base64-encoded signature */
  signature: string;
  /** Public key ID or fingerprint */
  key_id: string;
  /** Signing timestamp */
  signed_at: string;
  /** Certificate chain (PEM format) */
  certificate_chain?: string[];
  /** Signature verification status */
  verified: boolean;
}

/**
 * Common Vulnerabilities and Exposures entry
 */
export interface CVE {
  /** CVE identifier (e.g., CVE-2024-12345) */
  id: string;
  /** CVSS v3.1 base score (0.0 - 10.0) */
  cvss_score: number;
  /** Severity level */
  severity: CVESeverity;
  /** Vulnerability description */
  description: string;
  /** Affected version range */
  affected_versions: string;
  /** Fixed version (if available) */
  fixed_version?: string;
  /** Publication date */
  published_at: string;
  /** Last modified date */
  modified_at: string;
  /** CWE identifiers */
  cwe_ids: string[];
  /** Exploit availability */
  exploit_available: boolean;
  /** Patch availability */
  patch_available: boolean;
}

/**
 * Execution attestation for TEE verification
 */
export interface ExecutionAttestation {
  /** Attestation ID */
  id: string;
  /** Attestation type */
  type: AttestationType;
  /** Enclave measurement (MRENCLAVE for SGX) */
  measurement: string;
  /** Signer identity (MRSIGNER for SGX) */
  signer_id: string;
  /** Product ID */
  product_id: number;
  /** Security version number */
  svn: number;
  /** Attestation quote (base64) */
  quote: string;
  /** Quote signature */
  quote_signature: string;
  /** Collateral for verification */
  collateral?: AttestationCollateral;
  /** Memory safety verification */
  memory_safety: MemorySafetyResult;
  /** Attestation timestamp */
  attested_at: string;
  /** Expiration timestamp */
  expires_at: string;
}

/**
 * Attestation collateral for verification
 */
export interface AttestationCollateral {
  /** TCB info (for SGX) */
  tcb_info?: string;
  /** QE identity */
  qe_identity?: string;
  /** Root CA certificate */
  root_ca_cert: string;
  /** Intermediate certificates */
  intermediate_certs: string[];
  /** CRL (Certificate Revocation List) */
  crl?: string;
}

/**
 * Memory safety verification result
 */
export interface MemorySafetyResult {
  /** Overall status */
  status: MemorySafetyStatus;
  /** Memory-safe language used */
  language_safe: boolean;
  /** Static analysis passed */
  static_analysis_passed: boolean;
  /** Runtime bounds checking enabled */
  bounds_checking: boolean;
  /** Address sanitizer results */
  asan_clean?: boolean;
  /** Memory sanitizer results */
  msan_clean?: boolean;
  /** Undefined behavior sanitizer results */
  ubsan_clean?: boolean;
  /** Verification details */
  details: string[];
}

/**
 * Build artifact with provenance
 */
export interface Artifact {
  /** Artifact ID */
  id: string;
  /** Artifact name */
  name: string;
  /** Artifact type (binary, container, package) */
  type: ArtifactType;
  /** SHA-256 hash */
  hash: string;
  /** SHA-512 hash (for additional verification) */
  hash_sha512?: string;
  /** File size in bytes */
  size: number;
  /** Creation timestamp */
  created_at: string;
  /** Provenance attestation */
  provenance: ProvenanceAttestation;
  /** Digital signatures */
  signatures: ArtifactSignature[];
  /** Associated build ID */
  build_id: string;
}

/**
 * Artifact type enumeration
 */
export enum ArtifactType {
  BINARY = 'BINARY',
  CONTAINER = 'CONTAINER',
  PACKAGE = 'PACKAGE',
  LIBRARY = 'LIBRARY',
  SOURCE = 'SOURCE',
}

/**
 * Artifact digital signature
 */
export interface ArtifactSignature {
  /** Signature algorithm */
  algorithm: string;
  /** Base64-encoded signature */
  signature: string;
  /** Signer identity */
  signer: string;
  /** Public key ID */
  key_id: string;
  /** Signing timestamp */
  signed_at: string;
  /** Signature verification status */
  verified: boolean;
}

/**
 * SLSA Provenance attestation
 * @see https://slsa.dev/provenance/v1
 */
export interface ProvenanceAttestation {
  /** Attestation format version */
  version: string;
  /** Build type URI */
  build_type: string;
  /** Builder identity */
  builder: BuilderIdentity;
  /** Build metadata */
  metadata: ProvenanceMetadata;
  /** Materials (inputs) */
  materials: ProvenanceMaterial[];
  /** Subject (outputs) */
  subject: ProvenanceSubject[];
  /** In-toto statement signature */
  signature?: string;
}

/**
 * Builder identity for provenance
 */
export interface BuilderIdentity {
  /** Builder ID URI */
  id: string;
  /** Builder version */
  version?: string;
  /** Builder dependencies */
  dependencies?: string[];
}

/**
 * Provenance metadata
 */
export interface ProvenanceMetadata {
  /** Build invocation ID */
  invocation_id: string;
  /** Build started timestamp */
  build_started_on: string;
  /** Build finished timestamp */
  build_finished_on: string;
  /** Reproducible build flag */
  reproducible: boolean;
  /** Build parameters */
  parameters?: Record<string, unknown>;
}

/**
 * Provenance material (input)
 */
export interface ProvenanceMaterial {
  /** Material URI */
  uri: string;
  /** Material digest */
  digest: Record<string, string>;
}

/**
 * Provenance subject (output)
 */
export interface ProvenanceSubject {
  /** Subject name */
  name: string;
  /** Subject digest */
  digest: Record<string, string>;
}

/**
 * Immutable log entry for audit trail
 */
export interface ImmutableLogEntry {
  /** Log entry ID */
  id: string;
  /** Entry sequence number */
  sequence: number;
  /** Entry timestamp */
  timestamp: string;
  /** Entry type */
  type: LogEntryType;
  /** Artifact hash (if applicable) */
  artifact_hash?: string;
  /** Build ID (if applicable) */
  build_id?: string;
  /** Entry data hash */
  data_hash: string;
  /** Previous entry hash (for chain integrity) */
  previous_hash: string;
  /** Merkle tree root (for batch verification) */
  merkle_root?: string;
  /** Entry payload */
  payload: Record<string, unknown>;
  /** Entry signature */
  signature: string;
}

/**
 * Log entry types
 */
export enum LogEntryType {
  BUILD_STARTED = 'BUILD_STARTED',
  BUILD_COMPLETED = 'BUILD_COMPLETED',
  ARTIFACT_CREATED = 'ARTIFACT_CREATED',
  ARTIFACT_SIGNED = 'ARTIFACT_SIGNED',
  DEPENDENCY_SCANNED = 'DEPENDENCY_SCANNED',
  CVE_DETECTED = 'CVE_DETECTED',
  ATTESTATION_CREATED = 'ATTESTATION_CREATED',
  PROVENANCE_VERIFIED = 'PROVENANCE_VERIFIED',
}

/**
 * Immutable log with chain integrity
 */
export interface ImmutableLog {
  /** Log ID */
  id: string;
  /** Log name */
  name: string;
  /** Log entries */
  entries: ImmutableLogEntry[];
  /** Current chain head hash */
  head_hash: string;
  /** Log creation timestamp */
  created_at: string;
  /** Last entry timestamp */
  last_entry_at: string;
  /** Total entry count */
  entry_count: number;
  /** Log is sealed (no more entries) */
  sealed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SC³ Verification Result Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete SC³ verification result
 */
export interface SC3VerificationResult {
  /** Overall verification passed */
  passed: boolean;
  /** Verification timestamp */
  verified_at: string;
  /** Time bound (T) used for verification */
  time_bound: string;
  /** CVE severity threshold (θ) used */
  severity_threshold: CVESeverity;
  /** Build verification results */
  build_verification: BuildVerificationResult;
  /** Dependency verification results */
  dependency_verification: DependencyVerificationResult;
  /** Execution attestation results */
  execution_verification: ExecutionVerificationResult;
  /** Artifact provenance results */
  artifact_verification: ArtifactVerificationResult;
  /** Immutable log verification results */
  log_verification: LogVerificationResult;
  /** Detailed failure reasons (if any) */
  failures: SC3Failure[];
}

/**
 * Build verification result
 */
export interface BuildVerificationResult {
  /** All builds verified */
  passed: boolean;
  /** Total builds checked */
  total_builds: number;
  /** Builds with valid canonical hash */
  canonical_hash_valid: number;
  /** Builds meeting SLSA Level 3+ */
  slsa_compliant: number;
  /** Failed builds */
  failed_builds: string[];
}

/**
 * Dependency verification result
 */
export interface DependencyVerificationResult {
  /** All dependencies verified */
  passed: boolean;
  /** Total dependencies checked */
  total_dependencies: number;
  /** Signed dependencies */
  signed_count: number;
  /** Dependencies with CVEs above threshold */
  cve_violations: CVEViolation[];
  /** Unsigned dependencies */
  unsigned_dependencies: string[];
}

/**
 * CVE violation detail
 */
export interface CVEViolation {
  /** Dependency name */
  dependency: string;
  /** CVE ID */
  cve_id: string;
  /** CVE severity */
  severity: CVESeverity;
  /** CVSS score */
  cvss_score: number;
}

/**
 * Execution verification result
 */
export interface ExecutionVerificationResult {
  /** All executions verified */
  passed: boolean;
  /** Total executions checked */
  total_executions: number;
  /** Enclave-attested executions */
  attested_count: number;
  /** Memory-safe executions */
  memory_safe_count: number;
  /** Failed attestations */
  failed_attestations: string[];
}

/**
 * Artifact verification result
 */
export interface ArtifactVerificationResult {
  /** All artifacts verified */
  passed: boolean;
  /** Total artifacts checked */
  total_artifacts: number;
  /** Artifacts with valid provenance */
  provenance_valid: number;
  /** Failed artifacts */
  failed_artifacts: string[];
}

/**
 * Log verification result
 */
export interface LogVerificationResult {
  /** Log verification passed */
  passed: boolean;
  /** Log is immutable */
  immutable: boolean;
  /** All artifact hashes found in log */
  artifacts_logged: boolean;
  /** All timestamps within bound */
  timestamps_valid: boolean;
  /** Chain integrity verified */
  chain_integrity: boolean;
  /** Missing artifact hashes */
  missing_artifacts: string[];
}

/**
 * SC³ verification failure detail
 */
export interface SC3Failure {
  /** Failure category */
  category: SC3FailureCategory;
  /** Failure code */
  code: string;
  /** Failure message */
  message: string;
  /** Failure message (Persian) */
  message_fa: string;
  /** Related entity ID */
  entity_id?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * SC³ failure categories
 */
export enum SC3FailureCategory {
  BUILD = 'BUILD',
  DEPENDENCY = 'DEPENDENCY',
  EXECUTION = 'EXECUTION',
  ARTIFACT = 'ARTIFACT',
  LOG = 'LOG',
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SC³ verification configuration
 */
export interface SC3Config {
  /** CVE severity threshold (θ) */
  severity_threshold: CVESeverity;
  /** Minimum SLSA level required */
  min_slsa_level: SLSALevel;
  /** Require all dependencies to be signed */
  require_signed_deps: boolean;
  /** Require enclave attestation */
  require_attestation: boolean;
  /** Require memory safety verification */
  require_memory_safety: boolean;
  /** Trusted builder IDs */
  trusted_builders: string[];
  /** Trusted signing keys */
  trusted_keys: TrustedKey[];
  /** CVE database URL */
  cve_database_url: string;
  /** Attestation verification service URL */
  attestation_service_url?: string;
  /** Log retention days */
  log_retention_days: number;
}

/**
 * Trusted signing key
 */
export interface TrustedKey {
  /** Key ID */
  id: string;
  /** Key type (RSA, ECDSA, Ed25519) */
  type: string;
  /** Public key (PEM format) */
  public_key: string;
  /** Key owner */
  owner: string;
  /** Key expiration */
  expires_at?: string;
}

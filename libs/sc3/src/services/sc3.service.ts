// ═══════════════════════════════════════════════════════════════════════════
// SC³ Service - Supply Chain Security & Compliance Orchestrator
// ═══════════════════════════════════════════════════════════════════════════
// Main service implementing the complete SC³ formula:
// SC³(T, θ, L) := ∀b∈Builds:hash(b) = hash_canonical(b, T)
//                ∧ slsa_level(b) ≥ 3
//                ∧ ∀d∈Dependencies:signed(d)
//                ∧ ∀c∈cve_set(d): severity(c) < θ
//                ∧ ∀e∈Executions_attested:enclave_attested(e)
//                ∧ memory_safe(e)
//                ∧ ∀a∈Artifacts:provenance_verified(a)
//                ∧ ∃log∈L:immutable(log)
//                ∧ contains(log, hash(a))
//                ∧ timestamp(log) ≤ T
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import type {
  Artifact,
  AttestationType,
  Build,
  CVESeverity,
  Dependency,
  ExecutionAttestation,
  ImmutableLog,
  SC3Config,
  SC3Failure,
  SC3VerificationResult,
  SLSALevel,
} from '../types';
import type { AttestationService, AttestationVerificationOptions } from './attestation.service';
import type { BuildVerificationOptions, BuildVerifierService } from './build-verifier.service';
import type { DependencyScanOptions, DependencyScannerService } from './dependency-scanner.service';
import type { ImmutableLogService, LogVerificationOptions } from './immutable-log.service';
import type { ProvenanceService, ProvenanceVerificationOptions } from './provenance.service';

/**
 * SC³ verification input
 */
export interface SC3VerificationInput {
  /** Builds to verify */
  builds: Build[];
  /** Dependencies to scan */
  dependencies: Dependency[];
  /** Execution attestations to verify */
  executions: ExecutionAttestation[];
  /** Artifacts to verify provenance */
  artifacts: Artifact[];
  /** Immutable logs to verify */
  logs: ImmutableLog[];
}

/**
 * Default SC³ configuration
 */
export const DEFAULT_SC3_CONFIG: SC3Config = {
  severity_threshold: 3, // HIGH
  min_slsa_level: 3,
  require_signed_deps: true,
  require_attestation: true,
  require_memory_safety: true,
  trusted_builders: [
    'https://github.com/actions/runner',
    'https://cloudbuild.googleapis.com/GoogleHostedWorker',
    'https://gitlab.com/gitlab-org/gitlab-runner',
  ],
  trusted_keys: [],
  cve_database_url: 'https://osv.dev/api/v1',
  log_retention_days: 365,
};

@Injectable()
export class SC3Service {
  private readonly logger = new Logger(SC3Service.name);
  private config: SC3Config = DEFAULT_SC3_CONFIG;

  constructor(
    private readonly buildVerifier: BuildVerifierService,
    private readonly dependencyScanner: DependencyScannerService,
    private readonly attestationService: AttestationService,
    private readonly provenanceService: ProvenanceService,
    private readonly immutableLogService: ImmutableLogService
  ) {}

  /**
   * Configure SC³ service
   */
  configure(config: Partial<SC3Config>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SC3Config {
    return { ...this.config };
  }

  /**
   * Execute complete SC³ verification
   * SC³(T, θ, L) - verify entire supply chain
   */
  async verify(
    input: SC3VerificationInput,
    timeBound: Date = new Date(),
    severityThreshold?: CVESeverity
  ): Promise<SC3VerificationResult> {
    const startTime = Date.now();
    const theta = severityThreshold ?? this.config.severity_threshold;
    const allFailures: SC3Failure[] = [];

    this.logger.log('Starting SC³ verification', {
      builds: input.builds.length,
      dependencies: input.dependencies.length,
      executions: input.executions.length,
      artifacts: input.artifacts.length,
      logs: input.logs.length,
      time_bound: timeBound.toISOString(),
      severity_threshold: theta,
    });

    // 1. Verify builds: hash(b) = hash_canonical(b, T) ∧ slsa_level(b) ≥ 3
    const buildOptions: BuildVerificationOptions = {
      time_bound: timeBound,
      min_slsa_level: this.config.min_slsa_level as SLSALevel,
      trusted_builders: this.config.trusted_builders,
      require_hermetic: true,
      verify_provenance: true,
    };
    const buildResult = await this.buildVerifier.verifyBuilds(input.builds, buildOptions);
    allFailures.push(...buildResult.failures);

    // 2. Verify dependencies: signed(d) ∧ ∀c∈cve_set(d): severity(c) < θ
    const depOptions: DependencyScanOptions = {
      severity_threshold: theta,
      require_signatures: this.config.require_signed_deps,
      trusted_keys: this.config.trusted_keys,
      cve_database_url: this.config.cve_database_url,
      include_transitive: true,
    };
    const depResult = await this.dependencyScanner.verifyDependencies(
      input.dependencies,
      depOptions
    );
    allFailures.push(...depResult.failures);

    // 3. Verify executions: enclave_attested(e) ∧ memory_safe(e)
    const attestOptions: AttestationVerificationOptions = {
      require_attestation: this.config.require_attestation,
      require_memory_safety: this.config.require_memory_safety,
      allowed_types: ['SGX', 'SEV', 'NITRO', 'TRUSTZONE', 'SOFTWARE'] as AttestationType[],
      min_svn: 1,
    };
    const execResult = await this.attestationService.verifyExecutions(
      input.executions,
      attestOptions
    );
    allFailures.push(...execResult.failures);

    // 4. Verify artifacts: provenance_verified(a)
    const provOptions: ProvenanceVerificationOptions = {
      trusted_builders: this.config.trusted_builders,
      trusted_keys: this.config.trusted_keys,
      require_signature: true,
      require_reproducible: false,
      verify_materials: true,
    };
    const artifactResult = await this.provenanceService.verifyArtifacts(
      input.artifacts,
      provOptions
    );
    allFailures.push(...artifactResult.failures);

    // 5. Verify logs: ∃log∈L: immutable(log) ∧ contains(log, hash(a)) ∧ timestamp(log) ≤ T
    const artifactHashes = input.artifacts.map((a) => a.hash);
    let logResult = {
      result: {
        passed: true,
        immutable: true,
        artifacts_logged: true,
        timestamps_valid: true,
        chain_integrity: true,
        missing_artifacts: [] as string[],
      },
      failures: [] as SC3Failure[],
    };

    if (input.logs.length > 0) {
      // Find a log that contains all artifact hashes
      let foundValidLog = false;

      for (const log of input.logs) {
        const logOptions: LogVerificationOptions = {
          time_bound: timeBound,
          required_artifact_hashes: artifactHashes,
          verify_chain: true,
          verify_signatures: true,
        };

        const result = await this.immutableLogService.verifyLog(log, logOptions);

        if (result.result.passed) {
          foundValidLog = true;
          logResult = result;
          break;
        }

        // Keep track of best result
        if (result.result.chain_integrity && !logResult.result.chain_integrity) {
          logResult = result;
        }
      }

      if (!foundValidLog) {
        allFailures.push(...logResult.failures);
      }
    } else if (input.artifacts.length > 0) {
      // No logs provided but artifacts exist
      allFailures.push({
        category: 'LOG' as any,
        code: 'NO_LOGS_PROVIDED',
        message: 'No immutable logs provided for artifact verification',
        message_fa: 'هیچ لاگ تغییرناپذیری برای تأیید آرتیفکت‌ها ارائه نشده است',
      });
      logResult.result.passed = false;
    }

    const elapsed = Date.now() - startTime;
    const passed = allFailures.length === 0;

    this.logger.log(`SC³ verification completed in ${elapsed}ms`, {
      passed,
      failures: allFailures.length,
    });

    return {
      passed,
      verified_at: new Date().toISOString(),
      time_bound: timeBound.toISOString(),
      severity_threshold: theta,
      build_verification: buildResult.result,
      dependency_verification: depResult.result,
      execution_verification: execResult.result,
      artifact_verification: artifactResult.result,
      log_verification: logResult.result,
      failures: allFailures,
    };
  }

  /**
   * Quick verification - check only critical components
   */
  async quickVerify(
    input: SC3VerificationInput,
    _timeBound: Date = new Date()
  ): Promise<{ passed: boolean; critical_failures: SC3Failure[] }> {
    const criticalFailures: SC3Failure[] = [];

    // Check SLSA levels
    for (const build of input.builds) {
      if (build.slsa_level < this.config.min_slsa_level) {
        criticalFailures.push({
          category: 'BUILD' as any,
          code: 'SLSA_LEVEL_INSUFFICIENT',
          message: `Build ${build.id} SLSA level insufficient`,
          message_fa: `سطح SLSA بیلد ${build.id} کافی نیست`,
          entity_id: build.id,
        });
      }
    }

    // Check critical CVEs
    for (const dep of input.dependencies) {
      const criticalCVEs = dep.cves?.filter((c) => c.severity >= 4) || [];
      if (criticalCVEs.length > 0) {
        criticalFailures.push({
          category: 'DEPENDENCY' as any,
          code: 'CRITICAL_CVE',
          message: `Dependency ${dep.name} has critical CVEs`,
          message_fa: `وابستگی ${dep.name} دارای آسیب‌پذیری بحرانی است`,
          entity_id: `${dep.name}@${dep.version}`,
          details: { cves: criticalCVEs.map((c) => c.id) },
        });
      }
    }

    // Check attestation expiry
    for (const exec of input.executions) {
      if (new Date(exec.expires_at) < new Date()) {
        criticalFailures.push({
          category: 'EXECUTION' as any,
          code: 'ATTESTATION_EXPIRED',
          message: `Execution ${exec.id} attestation expired`,
          message_fa: `attestation اجرای ${exec.id} منقضی شده است`,
          entity_id: exec.id,
        });
      }
    }

    return {
      passed: criticalFailures.length === 0,
      critical_failures: criticalFailures,
    };
  }

  /**
   * Generate compliance report
   */
  generateReport(result: SC3VerificationResult): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════════════════',
      '                    SC³ Supply Chain Security Report',
      '═══════════════════════════════════════════════════════════════════════════',
      '',
      `Verification Time: ${result.verified_at}`,
      `Time Bound (T): ${result.time_bound}`,
      `Severity Threshold (θ): ${this.getSeverityName(result.severity_threshold)}`,
      `Overall Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`,
      '',
      '───────────────────────────────────────────────────────────────────────────',
      '                           Build Verification',
      '───────────────────────────────────────────────────────────────────────────',
      `Status: ${result.build_verification.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `Total Builds: ${result.build_verification.total_builds}`,
      `Canonical Hash Valid: ${result.build_verification.canonical_hash_valid}`,
      `SLSA Compliant: ${result.build_verification.slsa_compliant}`,
      '',
      '───────────────────────────────────────────────────────────────────────────',
      '                        Dependency Verification',
      '───────────────────────────────────────────────────────────────────────────',
      `Status: ${result.dependency_verification.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `Total Dependencies: ${result.dependency_verification.total_dependencies}`,
      `Signed: ${result.dependency_verification.signed_count}`,
      `CVE Violations: ${result.dependency_verification.cve_violations.length}`,
      '',
      '───────────────────────────────────────────────────────────────────────────',
      '                        Execution Verification',
      '───────────────────────────────────────────────────────────────────────────',
      `Status: ${result.execution_verification.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `Total Executions: ${result.execution_verification.total_executions}`,
      `Enclave Attested: ${result.execution_verification.attested_count}`,
      `Memory Safe: ${result.execution_verification.memory_safe_count}`,
      '',
      '───────────────────────────────────────────────────────────────────────────',
      '                         Artifact Verification',
      '───────────────────────────────────────────────────────────────────────────',
      `Status: ${result.artifact_verification.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `Total Artifacts: ${result.artifact_verification.total_artifacts}`,
      `Provenance Valid: ${result.artifact_verification.provenance_valid}`,
      '',
      '───────────────────────────────────────────────────────────────────────────',
      '                           Log Verification',
      '───────────────────────────────────────────────────────────────────────────',
      `Status: ${result.log_verification.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `Immutable: ${result.log_verification.immutable ? '✅' : '❌'}`,
      `Chain Integrity: ${result.log_verification.chain_integrity ? '✅' : '❌'}`,
      `Artifacts Logged: ${result.log_verification.artifacts_logged ? '✅' : '❌'}`,
      `Timestamps Valid: ${result.log_verification.timestamps_valid ? '✅' : '❌'}`,
    ];

    if (result.failures.length > 0) {
      lines.push('');
      lines.push('───────────────────────────────────────────────────────────────────────────');
      lines.push('                              Failures');
      lines.push('───────────────────────────────────────────────────────────────────────────');

      for (const failure of result.failures) {
        lines.push(`[${failure.category}] ${failure.code}: ${failure.message}`);
        if (failure.entity_id) {
          lines.push(`  Entity: ${failure.entity_id}`);
        }
      }
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Get severity name from level
   */
  private getSeverityName(severity: CVESeverity): string {
    const names = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return names[severity] || 'UNKNOWN';
  }

  /**
   * Verify single build quickly
   */
  async verifyBuild(build: Build): Promise<boolean> {
    const options: BuildVerificationOptions = {
      time_bound: new Date(),
      min_slsa_level: this.config.min_slsa_level as SLSALevel,
      trusted_builders: this.config.trusted_builders,
      require_hermetic: true,
      verify_provenance: true,
    };

    const failures = await this.buildVerifier.verifyBuild(build, options);
    return failures.length === 0;
  }

  /**
   * Verify single dependency quickly
   */
  async verifyDependency(dep: Dependency): Promise<boolean> {
    const options: DependencyScanOptions = {
      severity_threshold: this.config.severity_threshold,
      require_signatures: this.config.require_signed_deps,
      trusted_keys: this.config.trusted_keys,
      cve_database_url: this.config.cve_database_url,
      include_transitive: false,
    };

    const result = await this.dependencyScanner.verifyDependencies([dep], options);
    return result.result.passed;
  }

  /**
   * Verify single artifact quickly
   */
  async verifyArtifact(artifact: Artifact): Promise<boolean> {
    const options: ProvenanceVerificationOptions = {
      trusted_builders: this.config.trusted_builders,
      trusted_keys: this.config.trusted_keys,
      require_signature: true,
      require_reproducible: false,
      verify_materials: true,
    };

    const failures = await this.provenanceService.verifyArtifact(artifact, options);
    return failures.length === 0;
  }
}

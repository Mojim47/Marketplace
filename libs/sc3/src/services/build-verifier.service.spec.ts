// ═══════════════════════════════════════════════════════════════════════════
// Build Verifier Service Tests
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it } from 'vitest';
import type { Build, BuildStatus, SLSALevel } from '../types';
import { BuildVerifierService } from './build-verifier.service';

describe('BuildVerifierService', () => {
  let service: BuildVerifierService;

  beforeEach(() => {
    service = new BuildVerifierService();
  });

  const createBuild = (overrides: Partial<Build> = {}): Build => ({
    id: 'build-1',
    timestamp: new Date().toISOString(),
    hash: 'abc123',
    slsa_level: 3 as SLSALevel,
    source_repo: 'https://github.com/test/repo',
    commit_sha: 'abc123def456',
    config_hash: 'config123',
    builder_id: 'https://github.com/actions/runner',
    environment: {
      os: 'linux',
      arch: 'x86_64',
      compiler_version: 'gcc-12',
      env_hash: 'env123',
      hermetic: true,
    },
    status: 'VERIFIED' as BuildStatus,
    provenance: {
      version: '1.0',
      build_type: 'https://slsa.dev/provenance/v1',
      builder: { id: 'https://github.com/actions/runner' },
      metadata: {
        invocation_id: 'inv-1',
        build_started_on: new Date().toISOString(),
        build_finished_on: new Date().toISOString(),
        reproducible: true,
      },
      materials: [{ uri: 'git+https://github.com/test/repo', digest: { sha256: 'abc123' } }],
      subject: [{ name: 'artifact', digest: { sha256: 'abc123' } }],
      signature: 'sig123',
    },
    ...overrides,
  });

  describe('computeCanonicalHash', () => {
    it('should compute deterministic hash', () => {
      const build = createBuild();
      const hash1 = service.computeCanonicalHash(build, new Date());
      const hash2 = service.computeCanonicalHash(build, new Date());

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should produce different hashes for different builds', () => {
      const build1 = createBuild({ commit_sha: 'abc123' });
      const build2 = createBuild({ commit_sha: 'def456' });

      const hash1 = service.computeCanonicalHash(build1, new Date());
      const hash2 = service.computeCanonicalHash(build2, new Date());

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyBuild', () => {
    it('should pass for valid build', async () => {
      const build = createBuild();

      const failures = await service.verifyBuild(build, {
        time_bound: new Date(Date.now() + 86400000),
        min_slsa_level: 3 as SLSALevel,
        trusted_builders: ['https://github.com/actions/runner'],
        require_hermetic: true,
        verify_provenance: true,
      });

      // Should have no SLSA or builder failures
      const criticalFailures = failures.filter(
        (f) => f.code === 'SLSA_LEVEL_INSUFFICIENT' || f.code === 'UNTRUSTED_BUILDER'
      );
      expect(criticalFailures).toHaveLength(0);
    });

    it('should fail for insufficient SLSA level', async () => {
      const build = createBuild({ slsa_level: 1 as SLSALevel });

      const failures = await service.verifyBuild(build, {
        time_bound: new Date(Date.now() + 86400000),
        min_slsa_level: 3 as SLSALevel,
        trusted_builders: ['https://github.com/actions/runner'],
        require_hermetic: true,
        verify_provenance: true,
      });

      expect(failures.some((f) => f.code === 'SLSA_LEVEL_INSUFFICIENT')).toBe(true);
    });

    it('should fail for untrusted builder', async () => {
      const build = createBuild({ builder_id: 'untrusted-builder' });

      const failures = await service.verifyBuild(build, {
        time_bound: new Date(Date.now() + 86400000),
        min_slsa_level: 3 as SLSALevel,
        trusted_builders: ['https://github.com/actions/runner'],
        require_hermetic: true,
        verify_provenance: true,
      });

      expect(failures.some((f) => f.code === 'UNTRUSTED_BUILDER')).toBe(true);
    });

    it('should fail for non-hermetic build when required', async () => {
      const build = createBuild();
      build.environment.hermetic = false;

      const failures = await service.verifyBuild(build, {
        time_bound: new Date(Date.now() + 86400000),
        min_slsa_level: 3 as SLSALevel,
        trusted_builders: ['https://github.com/actions/runner'],
        require_hermetic: true,
        verify_provenance: true,
      });

      expect(failures.some((f) => f.code === 'NON_HERMETIC_BUILD')).toBe(true);
    });
  });

  describe('verifySLSALevel3', () => {
    it('should pass for compliant build', () => {
      const build = createBuild();
      // Add container_digest for full SLSA L3 compliance
      build.environment.container_digest = 'sha256:abc123';
      const result = service.verifySLSALevel3(build);

      expect(result.compliant).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should fail for non-hermetic build', () => {
      const build = createBuild();
      build.environment.hermetic = false;

      const result = service.verifySLSALevel3(build);

      expect(result.compliant).toBe(false);
      expect(result.missing).toContain('Hermetic build environment required');
    });

    it('should fail for missing provenance', () => {
      const build = createBuild();
      (build as any).provenance = undefined;

      const result = service.verifySLSALevel3(build);

      expect(result.compliant).toBe(false);
      expect(result.missing).toContain('Provenance attestation required');
    });
  });

  describe('createBuild', () => {
    it('should create build with computed hashes', () => {
      const build = service.createBuild({
        source_repo: 'https://github.com/test/repo',
        commit_sha: 'abc123',
        config_hash: 'config123',
        builder_id: 'builder-1',
        environment: {
          os: 'linux',
          arch: 'x86_64',
          compiler_version: 'gcc-12',
          env_hash: 'env123',
          hermetic: true,
        },
        slsa_level: 3 as SLSALevel,
      });

      expect(build.id).toBeDefined();
      expect(build.hash).toBeDefined();
      expect(build.canonical_hash).toBeDefined();
      expect(build.status).toBe('PENDING');
    });
  });
});

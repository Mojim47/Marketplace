// ═══════════════════════════════════════════════════════════════════════════
// SC³ Module - NestJS Module for Supply Chain Security & Compliance
// ═══════════════════════════════════════════════════════════════════════════

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { SC3Service, DEFAULT_SC3_CONFIG } from './services/sc3.service';
import { BuildVerifierService } from './services/build-verifier.service';
import { DependencyScannerService } from './services/dependency-scanner.service';
import { AttestationService } from './services/attestation.service';
import { ProvenanceService } from './services/provenance.service';
import { ImmutableLogService } from './services/immutable-log.service';
import type { SC3Config } from './types';

/**
 * SC³ module options
 */
export interface SC3ModuleOptions {
  /** SC³ configuration */
  config?: Partial<SC3Config>;
  /** Make module global */
  isGlobal?: boolean;
}

/**
 * SC³ module async options
 */
export interface SC3ModuleAsyncOptions {
  /** Make module global */
  isGlobal?: boolean;
  /** Imports for dependency injection */
  imports?: any[];
  /** Factory function to create config */
  useFactory: (...args: any[]) => Promise<Partial<SC3Config>> | Partial<SC3Config>;
  /** Dependencies to inject into factory */
  inject?: any[];
}

/**
 * SC³ config injection token
 */
export const SC3_CONFIG = 'SC3_CONFIG';

@Module({})
export class SC3Module {
  /**
   * Register SC³ module with static configuration
   */
  static forRoot(options: SC3ModuleOptions = {}): DynamicModule {
    const config = { ...DEFAULT_SC3_CONFIG, ...options.config };

    const configProvider: Provider = {
      provide: SC3_CONFIG,
      useValue: config,
    };

    return {
      module: SC3Module,
      global: options.isGlobal ?? false,
      providers: [
        configProvider,
        BuildVerifierService,
        DependencyScannerService,
        AttestationService,
        ProvenanceService,
        ImmutableLogService,
        {
          provide: SC3Service,
          useFactory: (
            buildVerifier: BuildVerifierService,
            depScanner: DependencyScannerService,
            attestation: AttestationService,
            provenance: ProvenanceService,
            immutableLog: ImmutableLogService,
          ) => {
            const service = new SC3Service(
              buildVerifier,
              depScanner,
              attestation,
              provenance,
              immutableLog,
            );
            service.configure(config);
            return service;
          },
          inject: [
            BuildVerifierService,
            DependencyScannerService,
            AttestationService,
            ProvenanceService,
            ImmutableLogService,
          ],
        },
      ],
      exports: [
        SC3_CONFIG,
        SC3Service,
        BuildVerifierService,
        DependencyScannerService,
        AttestationService,
        ProvenanceService,
        ImmutableLogService,
      ],
    };
  }

  /**
   * Register SC³ module with async configuration
   */
  static forRootAsync(options: SC3ModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: SC3_CONFIG,
      useFactory: async (...args: any[]) => {
        const partialConfig = await options.useFactory(...args);
        return { ...DEFAULT_SC3_CONFIG, ...partialConfig };
      },
      inject: options.inject || [],
    };

    return {
      module: SC3Module,
      global: options.isGlobal ?? false,
      imports: options.imports || [],
      providers: [
        configProvider,
        BuildVerifierService,
        DependencyScannerService,
        AttestationService,
        ProvenanceService,
        ImmutableLogService,
        {
          provide: SC3Service,
          useFactory: (
            config: SC3Config,
            buildVerifier: BuildVerifierService,
            depScanner: DependencyScannerService,
            attestation: AttestationService,
            provenance: ProvenanceService,
            immutableLog: ImmutableLogService,
          ) => {
            const service = new SC3Service(
              buildVerifier,
              depScanner,
              attestation,
              provenance,
              immutableLog,
            );
            service.configure(config);
            return service;
          },
          inject: [
            SC3_CONFIG,
            BuildVerifierService,
            DependencyScannerService,
            AttestationService,
            ProvenanceService,
            ImmutableLogService,
          ],
        },
      ],
      exports: [
        SC3_CONFIG,
        SC3Service,
        BuildVerifierService,
        DependencyScannerService,
        AttestationService,
        ProvenanceService,
        ImmutableLogService,
      ],
    };
  }
}

import { Global, Module } from '@nestjs/common';
import { SecretsService } from './secrets.service';

/**
 * Secrets Module
 *
 * Global module that provides SecretsService to all other modules
 * Handles credential management across the application
 */
@Global()
@Module({
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}

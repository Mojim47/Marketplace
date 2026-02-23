import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { DependencyGuardrailsService } from './dependency-guardrails.service';
import { RuntimeReconciliationService } from './runtime-reconciliation.service';

@Global()
@Module({
  imports: [DatabaseModule, MonitoringModule],
  providers: [DependencyGuardrailsService, RuntimeReconciliationService],
  exports: [DependencyGuardrailsService, RuntimeReconciliationService],
})
export class RuntimeModule {}

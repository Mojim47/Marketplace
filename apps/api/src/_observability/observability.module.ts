import { Module, Global } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { LoggingService } from './logging.service'
import { TracingService } from './tracing.service'
import { TracingInterceptor } from '../common/interceptors/tracing.interceptor'

/**
 * Observability Module
 * 
 * Global module providing:
 * - Structured logging (JSON) with correlation IDs
 * - Distributed tracing (trace ID propagation)
 * - Health checks
 * 
 * Note: Prometheus metrics are provided by MonitoringModule
 * 
 * Validates: Requirements 7.4, 7.5
 */
@Global()
@Module({
  providers: [
    LoggingService,
    TracingService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TracingInterceptor,
    },
  ],
  exports: [LoggingService, TracingService],
})
export class ObservabilityModule {}

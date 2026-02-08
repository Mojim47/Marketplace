import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from '../common/interceptors/metrics.interceptor';

/**
 * Monitoring Module
 * 
 * Provides Prometheus metrics collection and exposure:
 * - /metrics endpoint for Prometheus scraping
 * - Automatic HTTP request latency tracking
 * - Business metrics (orders, payments, cache)
 * 
 * Validates: Requirements 7.1, 7.2
 */
@Global()
@Module({
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MonitoringModule {}

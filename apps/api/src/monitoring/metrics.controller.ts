import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

/**
 * Metrics Controller
 *
 * Exposes /metrics endpoint for Prometheus scraping
 *
 * Validates: Requirements 7.1
 */
@ApiTags('monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics in text format' })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  @Post('ar/telemetry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest AR overlay telemetry for latency/guard metrics' })
  @ApiResponse({ status: 202, description: 'Telemetry accepted' })
  ingestArTelemetry(
    @Body()
    body: {
      traceId?: string;
      stage?: string;
      latencyMs: number;
      budgetMs?: number;
      guardReason?: string;
      action?: 'overlay_disabled' | 'throttled' | 'none';
    }
  ): { accepted: true } {
    const stage = body.stage || 'capture_process_overlay';
    const budgetMs = Number(body.budgetMs ?? 50);
    const latencyMs = Number(body.latencyMs);
    const outcome = Number.isFinite(latencyMs) && latencyMs <= budgetMs ? 'within_sla' : 'sla_breach';

    if (Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.metricsService.arOverlayLatency.observe({ stage, outcome }, latencyMs / 1000);
    }

    if (body.guardReason && body.guardReason !== 'none') {
      this.metricsService.arOverlayGuardEventsTotal.inc({
        reason: body.guardReason,
        action: body.action || 'overlay_disabled',
      });
    }

    return { accepted: true };
  }
}

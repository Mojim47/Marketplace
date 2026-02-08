import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from '../../monitoring/metrics.service';

/**
 * Metrics Interceptor
 * 
 * Automatically tracks HTTP request metrics:
 * - Request duration (histogram with p50, p95, p99 percentiles)
 * - Request count by method, route, and status code
 * 
 * Validates: Requirements 7.1, 7.2
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, route, url } = request;
    const routePath = route?.path || url;
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        this.recordMetrics(method, routePath, response.statusCode, startTime);
      }),
      catchError((error) => {
        const statusCode = error.status || 500;
        this.recordMetrics(method, routePath, statusCode, startTime);
        throw error;
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    startTime: bigint,
  ): void {
    const endTime = process.hrtime.bigint();
    const durationSeconds = Number(endTime - startTime) / 1e9;

    // Record request duration for latency percentiles (p50, p95, p99)
    this.metricsService.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      durationSeconds,
    );

    // Increment request counter
    this.metricsService.httpRequestTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });
  }
}

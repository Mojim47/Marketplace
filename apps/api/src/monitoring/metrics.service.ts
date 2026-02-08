import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus Metrics Service
 * 
 * Provides comprehensive metrics collection for:
 * - HTTP request latency (p50, p95, p99 percentiles)
 * - Request counts by method, route, status
 * - Business metrics (orders, payments)
 * - Database query performance
 * - Cache hit/miss rates
 * 
 * Validates: Requirements 7.1, 7.2
 */
@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestTotal: Counter;
  public readonly ordersTotal: Counter;
  public readonly orderValue: Histogram;
  public readonly paymentTransactions: Counter;
  public readonly dbQueryDuration: Histogram;
  public readonly cacheHits: Counter;
  public readonly cacheMisses: Counter;
  public readonly activeUsers: Gauge;
  public readonly orderCreateDuration: Histogram;
  public readonly orderLockConflicts: Counter;
  public readonly orderLockInfraErrors: Counter;
  public readonly orderSlaBreaches: Counter;

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js metrics (memory, CPU, event loop)
    collectDefaultMetrics({ register: this.registry });

    // HTTP request duration histogram with buckets optimized for p50, p95, p99
    // Buckets: 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.ordersTotal = new Counter({
      name: 'orders_total',
      help: 'Total number of orders',
      labelNames: ['status', 'vendor_id'],
      registers: [this.registry],
    });

    this.orderValue = new Histogram({
      name: 'order_value_irr',
      help: 'Order value in IRR',
      labelNames: ['vendor_id'],
      buckets: [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
      registers: [this.registry],
    });

    this.paymentTransactions = new Counter({
      name: 'payment_transactions_total',
      help: 'Total number of payment transactions',
      labelNames: ['gateway', 'status'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_name'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_name'],
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of currently active users',
      labelNames: ['role'],
      registers: [this.registry],
    });

    this.orderCreateDuration = new Histogram({
      name: 'order_create_duration_seconds',
      help: 'Duration of order creation in seconds',
      labelNames: ['vendor_id'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.orderLockConflicts = new Counter({
      name: 'order_lock_conflicts_total',
      help: 'Total number of order lock conflicts',
      labelNames: ['vendor_id'],
      registers: [this.registry],
    });

    this.orderLockInfraErrors = new Counter({
      name: 'order_lock_infra_errors_total',
      help: 'Total number of order lock infrastructure errors',
      labelNames: ['vendor_id'],
      registers: [this.registry],
    });

    this.orderSlaBreaches = new Counter({
      name: 'order_sla_breaches_total',
      help: 'Total number of order SLA breaches',
      labelNames: ['vendor_id'],
      registers: [this.registry],
    });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Calculate percentile from a sorted array of values
   * Used for validating latency percentile accuracy (Property 25)
   */
  static calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) {
      return 0;
    }
    if (percentile <= 0) {
      return sortedValues[0];
    }
    if (percentile >= 100) {
      return sortedValues[sortedValues.length - 1];
    }

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedValues[lower];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate p50, p95, p99 percentiles from latency values
   * Validates: Requirements 7.2
   */
  static calculateLatencyPercentiles(latencies: number[]): {
    p50: number;
    p95: number;
    p99: number;
  } {
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    return {
      p50: MetricsService.calculatePercentile(sorted, 50),
      p95: MetricsService.calculatePercentile(sorted, 95),
      p99: MetricsService.calculatePercentile(sorted, 99),
    };
  }
}

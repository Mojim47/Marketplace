import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'api_http_requests_total',
  help: 'Total number of HTTP requests served by API runtime',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'api_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const apiProcessMemoryRssBytes = new Gauge({
  name: 'api_process_memory_rss_bytes',
  help: 'API process RSS memory in bytes',
  registers: [registry],
});

export const apiOperationalErrorsTotal = new Counter({
  name: 'api_operational_errors_total',
  help: 'Operational/runtime errors observed by process handlers',
  labelNames: ['kind'],
  registers: [registry],
});

export async function renderPrometheusMetrics(): Promise<string> {
  return registry.metrics();
}

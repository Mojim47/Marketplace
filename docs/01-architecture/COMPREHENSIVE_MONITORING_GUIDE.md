# 🔍 Comprehensive Logging, Tracing, Metrics & Alerting Guide

**Status**: 🟢 **PRODUCTION READY**  
**Last Updated**: November 19, 2025  
**Coverage**: Enterprise-grade observability across all components  

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Centralized Logging](#centralized-logging)
3. [Distributed Tracing](#distributed-tracing)
4. [Metrics & Monitoring](#metrics--monitoring)
5. [Alerting & On-Call](#alerting--on-call)
6. [Dashboards](#dashboards)
7. [Azure Integration](#azure-integration)
8. [Setup & Configuration](#setup--configuration)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Architecture Overview

### 🏗️ Full Observability Stack

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
│  (Node.js + NestJS with OpenTelemetry Integration)  │
└────────────────┬────────────────┬────────────────┬──┘
                 │                │                │
        ┌────────▼─────┐  ┌─────▼────────┐  ┌──────▼──────┐
        │   Logs        │  │   Traces     │  │   Metrics   │
        │  (Winston)    │  │(OpenTelemetry)│ │(Prometheus) │
        └────────┬──────┘  └─────┬────────┘  └──────┬──────┘
                 │                │                │
        ┌────────▼──────────────────────────────────▼────────┐
        │         Monitoring & Observability Stack           │
        ├────────────────┬───────────────┬──────────────┐────┤
        │  ELK Stack     │  Jaeger       │  Prometheus  │Azure│
        │  (Logs)        │  (Traces)     │  (Metrics)   │    │
        └────────┬───────┴───────────────┴──────────────┴────┘
                 │
        ┌────────▼──────────────────────────────┐
        │    Grafana Dashboards & Alerting      │
        │    (Central Visualization Layer)      │
        └───────────────────────────────────────┘
```

---

## Centralized Logging

### 🗂️ Winston Logger with Correlation IDs

**Features**:
- ✅ Structured logging (JSON format)
- ✅ Correlation ID tracking across requests
- ✅ Multiple transports (Console, File, Elasticsearch, Azure Insights)
- ✅ Log levels (debug, info, warn, error)
- ✅ Sensitive data masking
- ✅ Request context propagation

### Log Entry Example

```json
{
  "timestamp": "2025-11-19T10:30:45.123Z",
  "level": "info",
  "message": "[POST] /api/invoices - 201",
  "service": "nextgen-market-api",
  "version": "1.0.0",
  "environment": "production",
  "correlationId": "1234567890-a1b2c3d4",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "method": "POST",
  "path": "/api/invoices",
  "statusCode": 201,
  "duration": 145,
  "userId": "user-123",
  "hostname": "api-pod-1",
  "responseSize": 2048
}
```

### Log Aggregation Destinations

#### 1️⃣ **Elasticsearch (Primary)**
```bash
# Search logs
curl -X GET "localhost:9200/logs-nextgen-market-api/_search?q=correlationId:1234567890-a1b2c3d4"

# Query in Kibana
POST logs-nextgen-market-api/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

#### 2️⃣ **Azure Application Insights**
```bash
# Query logs in Azure Portal
traces
| where message contains "error"
| where timestamp > ago(1h)
| project timestamp, message, customDimensions
```

#### 3️⃣ **Console (Development)**
```bash
npm run dev
# Logs appear in colorized format in terminal
```

### Using Correlated Logger

```typescript
import { createCorrelatedLogger } from './instrumentation/logger';

// Create logger for request
const logger = createCorrelatedLogger(correlationId);
logger.setRequestId(requestId);
logger.setTraceContext(traceId, spanId);

// Log with automatic correlation
logger.info('Processing invoice', { invoiceId: '123', amount: 1000 });
// Output includes correlationId, requestId, traceId, spanId automatically

// Child logger for nested operations
const dbLogger = logger.child({ operation: 'database_query' });
dbLogger.info('Executing query', { table: 'invoices' });
```

---

## Distributed Tracing

### 🔗 Trace ID Propagation

**Trace Context is propagated through**:
1. **Request Headers** (W3C Trace Context format)
2. **Response Headers** (echo back trace IDs)
3. **Service-to-Service Calls** (OpenTelemetry instrumentation)
4. **Database Queries** (Automatic via instrumentation)
5. **Cache Operations** (Automatic via instrumentation)
6. **Message Queues** (Custom middleware)

### Trace Header Formats Supported

```
# W3C Trace Context (preferred)
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

# Jaeger Format
uber-trace-id: 4bf92f3577b34da6a3ce929d0e0e4736:00f067aa0ba902b7:0:1

# AWS X-Ray Format
X-Amzn-Trace-Id: Root=1-5e6722a7-cc2xmpl46db7ae98c2abc123

# Custom Headers
X-Trace-ID: 4bf92f3577b34da6a3ce929d0e0e4736
X-Span-ID: 00f067aa0ba902b7
X-Correlation-ID: 1234567890-a1b2c3d4
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

### Trace Context in Frontend

```typescript
// Include trace headers in all API requests
const traceId = generateTraceId(); // uuid format
const spanId = generateSpanId();   // uuid format

fetch('/api/invoices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'traceparent': `00-${traceId}-${spanId}-01`,
    'x-correlation-id': correlationId,
  },
  body: JSON.stringify(data),
});
```

### Viewing Traces in Jaeger

```
URL: http://localhost:16686

1. Service: nextgen-market-api
2. Operation: POST /api/invoices
3. Look for trace with specific traceId
4. View span timeline showing:
   - API request
   - Database queries
   - Cache operations
   - Response time breakdown
```

---

## Metrics & Monitoring

### 📊 Metrics Collected

| Category | Metric | Unit | Threshold |
|----------|--------|------|-----------|
| **HTTP** | Request count | total | - |
| | Request duration | ms | p95 < 500ms |
| | Request size | bytes | - |
| | Active requests | count | < 10000 |
| **Database** | Query count | total | - |
| | Query latency | ms | p95 < 500ms |
| | Connection pool | count | < 95% |
| | Transaction time | ms | - |
| **Cache** | Hit ratio | % | > 80% |
| | Evictions | total | - |
| **Business** | Invoices created | total | - |
| | Payments processed | total | - |
| | Payment success rate | % | > 98% |
| **System** | Memory usage | % | < 85% |
| | CPU usage | % | < 80% |
| | Error rate (5xx) | % | < 1% |

### Prometheus Scrape Configuration

```yaml
# Automatic scrape every 15 seconds
- job_name: 'api'
  metrics_path: '/metrics'
  static_configs:
    - targets: ['localhost:3000']
      labels:
        service: 'nextgen-market-api'
        version: '1.0.0'
```

### Query Metrics in Prometheus

```promql
# Success rate (last 5 minutes)
100 * (sum(rate(http_requests_total{status_code=~"2.."}[5m])) 
       / sum(rate(http_requests_total[5m])))

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket[5m])) by (le))

# Payment success rate
100 * (sum(rate(payments_processed_total[1m])) 
       / (sum(rate(payments_processed_total[1m])) + sum(rate(payments_failed_total[1m]))))

# Cache hit ratio
100 * (sum(rate(cache_hits_total[5m])) 
       / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))))
```

---

## Alerting & On-Call

### 🚨 Alert Rules

**Critical Alerts** (Immediate action required):
- ❌ **HighErrorRate5xx**: 5xx error rate > 5% for 5 minutes
- ❌ **ServiceUnavailable**: Service down for 1 minute
- ❌ **AvailabilitySLOViolation**: Availability < 99.9% for 10 minutes
- ❌ **DatabaseConnectionPoolExhausted**: > 95% utilization
- ❌ **LowPaymentSuccessRate**: < 98% for 5 minutes
- ❌ **ErrorBudgetExceeded**: Monthly error budget exceeded
- ❌ **DLQCritical**: > 1000 messages in Dead Letter Queue
- ❌ **CriticalMemoryUsage**: > 95% memory utilization
- ❌ **CriticalLatencyP99**: P99 latency > 5 seconds

**Warning Alerts** (Investigate & prevent escalation):
- ⚠️ **HighLatencyP95**: P95 latency > 1 second
- ⚠️ **LowCacheHitRatio**: < 80% cache hit ratio
- ⚠️ **HighMemoryUsage**: > 85% memory utilization
- ⚠️ **HighDatabaseLatency**: P95 query latency > 500ms
- ⚠️ **MemoryLeakSuspected**: Continuous memory growth for 30 minutes
- ⚠️ **ErrorBudgetDepletingFast**: > 50% of monthly budget consumed

### Alert Severity Mapping

```
┌─────────────────────┬──────────┬─────────────────────┐
│   Severity Level    │ Response │   Action Required   │
├─────────────────────┼──────────┼─────────────────────┤
│ Critical (P1)       │ 5 min    │ Page on-call        │
│ Warning (P2)        │ 30 min   │ Create ticket       │
│ Info (P3)           │ 4 hours  │ Monitor & log       │
└─────────────────────┴──────────┴─────────────────────┘
```

### Setting Up Alerting Notifications

#### PagerDuty
```bash
# 1. Create PagerDuty integration service
# 2. Get integration key
# 3. Configure AlertManager
```

#### Slack
```yaml
# alertmanager.yml
global:
  slack_api_url: 'https://hooks.slack.com/services/...'

route:
  receiver: 'slack-critical'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

receivers:
  - name: 'slack-critical'
    slack_configs:
      - channel: '#incidents'
        title: '🚨 {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

#### Email
```yaml
receivers:
  - name: 'email-oncall'
    email_configs:
      - to: 'oncall@example.com'
        from: 'alerts@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alerts@example.com'
        auth_password: '${SMTP_PASSWORD}'
```

---

## Dashboards

### 📈 Grafana Dashboards

**Pre-built Dashboards**:

1. **API Health Dashboard**
   - Request rate, success rate, latency percentiles
   - Active requests, error distribution
   - Top error types, slowest endpoints

2. **Database Performance Dashboard**
   - Query count and latency
   - Connection pool utilization
   - Slow queries, transaction duration

3. **Business Metrics Dashboard**
   - Invoices created/updated/deleted
   - Payments processed and failed
   - Payment success rate and duration

4. **System Health Dashboard**
   - Memory usage and trends
   - CPU utilization
   - Network I/O, disk I/O

5. **Error Budget & SLO Dashboard**
   - Error budget consumption
   - Availability percentage
   - SLO violation timeline

6. **Cache Performance Dashboard**
   - Cache hit ratio
   - Eviction rate
   - Cache size trend

### Creating Custom Dashboard

```bash
# 1. Login to Grafana
# URL: http://localhost:3001
# Username: admin
# Password: admin123

# 2. Add Data Source (Prometheus)
# Configuration → Data Sources → Add → Prometheus
# URL: http://prometheus:9090

# 3. Create New Dashboard
# Dashboards → New → Add Panel

# 4. Query Metric Example
# histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))

# 5. Configure Panel
# - Title: "P95 Response Time"
# - Unit: "milliseconds"
# - Thresholds: Green < 500ms, Yellow < 1000ms, Red > 1000ms
```

---

## Azure Integration

### 🔵 Azure Application Insights

**Configuration**:

```bash
# Set environment variables
export APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=...;IngestionEndpoint=..."
export APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE=100  # or 10 for sampling
```

**Automatic Collection**:
- ✅ All HTTP requests/responses
- ✅ Database queries
- ✅ Cache operations
- ✅ Exceptions and logs
- ✅ Performance metrics

**Querying in Azure Portal**:

```kusto
# Recent errors in last hour
traces
| where message contains "error"
| where timestamp > ago(1h)
| project timestamp, message, customDimensions
| order by timestamp desc

# Transaction performance
requests
| where name == "POST /api/invoices"
| where timestamp > ago(24h)
| summarize avg(duration), percentile(duration, 95), count() by bin(timestamp, 1h)

# Failed requests
requests
| where success == "False"
| where timestamp > ago(1h)
| project timestamp, name, resultCode, duration
| order by timestamp desc
```

---

## Setup & Configuration

### 🚀 Quick Start

#### 1. Install Dependencies
```bash
npm install
# OpenTelemetry, Winston, Prometheus, Azure packages installed
```

#### 2. Environment Variables

Create `.env` file:
```bash
# OpenTelemetry
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
JAEGER_ENABLED=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Winston Logger
LOG_LEVEL=info
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=elastic123

# Azure Insights (optional)
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...

# Prometheus
PROMETHEUS_PORT=9464
PROMETHEUS_ENDPOINT=/metrics

# Service Info
SERVICE_NAME=nextgen-market-api
SERVICE_VERSION=1.0.0
NODE_ENV=production
```

#### 3. Start Monitoring Stack

```bash
# Start all services (API + monitoring)
docker-compose up -d

# Or start monitoring stack separately
docker-compose up -d prometheus grafana jaeger elasticsearch kibana

# Verify services
docker-compose ps
```

#### 4. Access Dashboards

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3001 | admin/admin123 |
| Jaeger | http://localhost:16686 | - |
| Kibana | http://localhost:5601 | elastic/elastic123 |
| Elasticsearch | http://localhost:9200 | - |

#### 5. View Logs

```bash
# Logs appear in three places:
# 1. Application logs: Console output
# 2. Elasticsearch: Query via Kibana
# 3. Azure Insights: Query via Azure Portal

# Docker compose logs
docker-compose logs -f api

# Search logs in Elasticsearch
curl "http://localhost:9200/logs-*/_search?q=error" | jq
```

---

## Troubleshooting

### ❌ No Metrics Appearing in Prometheus

```bash
# 1. Check Prometheus scrape targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[]'

# 2. Verify metrics endpoint on API
curl http://localhost:3000/metrics

# 3. Check for scrape errors
curl http://localhost:9090/api/v1/targets | jq '.data.droppedTargets[]'

# 4. Restart services
docker-compose restart prometheus
```

### ❌ Logs Not Appearing in Elasticsearch

```bash
# 1. Verify Elasticsearch is running
curl http://localhost:9200

# 2. Check Winston transport configuration
# Verify ELASTICSEARCH_URL env variable

# 3. View Elasticsearch indices
curl http://localhost:9200/_aliases | jq '.[]'

# 4. Test connection
docker-compose exec elasticsearch curl localhost:9200/_health
```

### ❌ Traces Not Showing in Jaeger

```bash
# 1. Verify JAEGER_ENABLED=true in env
# 2. Check Jaeger is receiving spans
curl http://localhost:16686/api/services | jq

# 3. Search for service
# Jaeger UI → Service dropdown → Select nextgen-market-api

# 4. Check OpenTelemetry configuration
# Verify OTEL_EXPORTER_OTLP_ENDPOINT
```

### ❌ High Memory Usage

```bash
# Check memory metrics
curl http://localhost:9090/api/v1/query?query=memory_usage_bytes | jq

# Analyze in Grafana
# Dashboard → System Health → Memory Usage

# Potential causes:
# - Memory leak in application code
# - Cache size growing unbounded
# - Too many log entries buffered

# Solutions:
# 1. Enable log rotation
# 2. Reduce log level in production
# 3. Implement cache eviction policy
# 4. Check for memory leaks in code
```

---

## Best Practices

### ✅ Logging

1. **Use Structured Logging**
   ```typescript
   // ✅ Good
   logger.info('Invoice created', { invoiceId, amount, currency });
   
   // ❌ Bad
   logger.info('Invoice created for ' + invoiceId);
   ```

2. **Include Context**
   ```typescript
   // ✅ Good - automatic with CorrelatedLogger
   logger.info('Processing payment', { paymentId, userId, amount });
   
   // ❌ Bad - missing context
   logger.info('Processing');
   ```

3. **Use Appropriate Log Levels**
   - **DEBUG**: Variable values, function entry/exit
   - **INFO**: State changes, completed operations
   - **WARN**: Recoverable issues, performance concerns
   - **ERROR**: Exceptions, failed operations

### ✅ Tracing

1. **Propagate Trace Context**
   ```typescript
   // ✅ Good - trace ID flows through services
   const response = await httpClient.post('/api/data', data, {
     headers: {
       'traceparent': getTraceParent(),
     },
   });
   
   // ❌ Bad - trace context lost
   await httpClient.post('/api/data', data);
   ```

2. **Add Span Attributes**
   ```typescript
   span.setAttributes({
     'user.id': userId,
     'invoice.id': invoiceId,
     'payment.amount': amount,
   });
   ```

### ✅ Metrics

1. **Use Appropriate Metric Types**
   - **Counter**: Monotonically increasing (request count)
   - **Gauge**: Fluctuating values (memory usage)
   - **Histogram**: Distribution data (latency)
   - **Updown Counter**: Can increase/decrease (active connections)

2. **Set Meaningful Labels**
   ```typescript
   metricsProvider.recordHttpRequest(
     'POST',        // method
     '/api/invoices', // path
     201,           // statusCode
     145            // duration (ms)
   );
   ```

### ✅ Alerting

1. **Alert on Symptoms, Not Causes**
   ```
   ✅ HighErrorRate (symptom)
   ❌ HighDatabaseLatency (might be cause, but not always actionable)
   ```

2. **Set Realistic Thresholds**
   ```
   ✅ P95 latency > 500ms (customer impact)
   ❌ P99 latency > 200ms (too sensitive, false positives)
   ```

3. **Include Runbooks in Alerts**
   ```yaml
   annotations:
     runbook: 'https://wiki.example.com/runbooks/high-error-rate'
     dashboard: 'http://grafana:3000/d/api-health'
   ```

### ✅ Performance

1. **Batch Span Export**
   - Reduces network overhead
   - Default: 512 spans per batch, 5 second timeout

2. **Implement Sampling**
   ```bash
   # Sample 10% of requests in production
   OTEL_SAMPLING_PERCENTAGE=10
   ```

3. **Monitor Observability Stack**
   - Alert on Prometheus disk usage
   - Monitor Elasticsearch heap size
   - Check Grafana response times

---

## 📞 Support & Runbooks

### Common Issues & Resolutions

**High Error Rate**:
1. Check error logs in Kibana
2. View error rate trend in Grafana
3. Look for pattern (specific endpoint, time, user)
4. Check database and cache performance
5. Review recent deployments

**High Latency**:
1. Check P95/P99 latency dashboard
2. Look for slow database queries
3. Check cache hit ratio
4. Monitor external service calls
5. Review connection pool utilization

**Memory Leak**:
1. Check memory usage trend in Grafana
2. Compare heap used vs heap total
3. Look for increasing log volume
4. Check for unbounded cache growth
5. Generate heap dump for analysis

---

## 🎓 Resources

- **OpenTelemetry**: https://opentelemetry.io/docs/
- **Prometheus**: https://prometheus.io/docs/
- **Grafana**: https://grafana.com/docs/grafana/
- **Jaeger**: https://www.jaegertracing.io/docs/
- **ELK Stack**: https://www.elastic.co/guide/
- **Azure Insights**: https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview

---

**Status**: 🟢 **COMPLETE & PRODUCTION READY**

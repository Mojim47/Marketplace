# 📊 Monitoring & Load Testing Guide

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Dashboards

```
Grafana:       http://localhost:3001 (admin/admin)
Prometheus:    http://localhost:9090
AlertManager:  http://localhost:9093
API:           http://localhost:3000
```

### 3. Run Load Tests

```bash
# Install K6
# macOS: brew install k6
# Linux: sudo apt-get install k6
# Windows: choco install k6

# Run load test
k6 run load-test.js --vus 100 --duration 5m

# With custom base URL
k6 run load-test.js \
  --vus 100 \
  --duration 5m \
  --env API_URL=http://api:3000 \
  --env AUTH_TOKEN=your-token
```

---

## 📈 Monitoring Metrics

### API Metrics
- `http_requests_total` - Total HTTP requests
- `http_requests_success` - Successful requests
- `http_requests_error` - Failed requests
- `http_request_duration_seconds` - Request latency
- `http_request_size_bytes` - Request size
- `http_response_size_bytes` - Response size

### Database Metrics
- `db_connections_active` - Active connections
- `db_connections_max` - Maximum connections
- `db_query_duration_seconds` - Query latency
- `db_query_count` - Query count
- `db_migrations_failed_total` - Failed migrations

### Cache Metrics
- `cache_hits_total` - Cache hits
- `cache_misses_total` - Cache misses
- `cache_size_bytes` - Cache size
- `cache_evictions_total` - Evictions

### System Metrics (Node Exporter)
- `node_cpu_seconds_total` - CPU time
- `node_memory_MemAvailable_bytes` - Available memory
- `node_disk_read_bytes_total` - Disk reads
- `node_network_receive_bytes_total` - Network in
- `node_network_transmit_bytes_total` - Network out

---

## 🎯 Alert Rules

### Critical Alerts (Immediate Action)
```
🚨 Service Down
   - Triggers when API is unreachable
   - Response: Page on-call engineer

🚨 High Error Rate (>5%)
   - Triggers when error rate exceeds 5%
   - Response: Check logs, investigate errors

🚨 Database Connection Pool Exhausted
   - Triggers when >90% of connections used
   - Response: Increase pool or restart API

🚨 Failed Database Migrations
   - Triggers when migration fails
   - Response: Check migration file, rollback
```

### Warning Alerts (Investigate)
```
⚠️ High Response Latency (>1s)
   - Triggers when P95 latency exceeds 1 second
   - Action: Check database performance, scale

⚠️ Low Cache Hit Rate (<70%)
   - Triggers when cache misses exceed 30%
   - Action: Review cache settings

⚠️ High Memory Usage (>85%)
   - Triggers when memory usage high
   - Action: Optimize or scale

⚠️ CPU Throttling
   - Triggers when CPU throttled
   - Action: Increase resource limits

⚠️ Slow Queries (>5s P99)
   - Triggers when queries take too long
   - Action: Add indexes, optimize queries

⚠️ Rate Limit Violations
   - Triggers when 429s exceed 1%
   - Action: Adjust rate limits or scale
```

---

## 🔧 Configuration

### Enable Prometheus Metrics in API

```typescript
// src/main.ts
import { MetricsService } from './observability/metrics.service'

const metricsService = app.get(MetricsService)

@Get('/metrics')
metrics() {
  return metricsService.getMetricsPrometheus()
}
```

### Configure Grafana Datasources

1. Go to http://localhost:3001
2. Settings → Data Sources
3. Add Prometheus:
   - Name: Prometheus
   - URL: http://prometheus:9090
   - Access: Server
4. Add Loki:
   - Name: Loki
   - URL: http://loki:3100
   - Access: Server

### Create Custom Dashboard

1. Go to Grafana home
2. Create → Dashboard
3. Add panels with queries:
   ```
   HTTP Requests:
   rate(http_requests_total[5m])

   Error Rate:
   rate(http_requests_total{status=~"5.."}[5m])

   P95 Latency:
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

   Cache Hit Rate:
   rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
   ```

---

## 📝 Load Testing Results Interpretation

### Response Times
- P50 (median): < 100ms ✅
- P95: < 500ms ✅
- P99: < 1000ms ⚠️
- P99.9: < 2000ms ⚠️

### Error Rates
- 0-0.1%: ✅ Excellent
- 0.1-1%: ⚠️ Acceptable
- 1-5%: 🔴 Investigate
- 5%+: 🚨 Critical

### Throughput
- Sustained 100 VUs: Target 1000 req/sec
- Peak 500 VUs: Target 5000 req/sec
- Rate limiting triggers at design limit

### Database Performance
- Connection pool exhaustion: < 10%
- Query P95: < 200ms
- Connection errors: 0

---

## 🚀 Scaling Based on Metrics

### When to Scale Up
1. CPU consistently > 70%
2. Memory consistently > 80%
3. Database connections > 80% of pool
4. Response latency increasing
5. Error rate increasing

### How to Scale
```bash
# Increase API replicas
kubectl scale deployment nextgen-api --replicas=5

# Increase database pool
# Update DB_POOL_MAX environment variable

# Add more Redis nodes
# Configure Redis Cluster

# Add database read replica
# Configure connection routing
```

---

## 🔍 Troubleshooting

### High Latency
```bash
# Check database performance
docker exec nextgen-postgres psql -U dev -d nextgen \
  -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"

# Check Redis latency
docker exec nextgen-redis redis-cli --latency

# Check logs
docker logs -f nextgen-api
```

### High Error Rate
```bash
# Check API logs for errors
docker logs -f nextgen-api | grep ERROR

# Check metrics endpoint
curl http://localhost:3000/api/metrics | grep errors

# Check database connectivity
docker exec nextgen-api npm run typecheck
```

### Alert Not Firing
```bash
# Check AlertManager configuration
curl http://localhost:9093/api/v1/alerts

# Check Prometheus rules
curl http://localhost:9090/api/v1/rules

# Verify metric exists
curl http://localhost:9090/api/v1/query?query=metric_name
```

---

## 📊 Dashboard Templates

### System Health
- API Status (up/down)
- Error Rate (%)
- Response Time (ms)
- Requests/sec

### Database Performance
- Active Connections
- Query Latency (P95, P99)
- Slow Queries Count
- Migration Status

### Resource Usage
- CPU (%)
- Memory (%)
- Disk (%)
- Network (MB/s)

### Business Metrics
- Invoices Created (daily)
- Payments Processed (daily)
- Revenue (daily)
- Active Users

---

## 📞 Next Steps

1. ✅ Setup monitoring stack
2. ✅ Configure dashboards
3. ✅ Run load tests
4. ✅ Fine-tune alert thresholds
5. ✅ Train team on monitoring
6. ✅ Document runbooks
7. ✅ Setup on-call rotation

**Status: Ready for Production Monitoring** ✅

# Runtime Failure Matrix (Elite 2026)

| Failure Domain | Expected Behavior | Metric/Log Signal | Health Impact |
|---|---|---|---|
| DB connection down | Reject writes fail-closed, no silent fallback | `boot_transition` code `BOOT_DB_CONNECT_FAILED`, `api_operational_errors_total` | `/health/ready = 503` immediately |
| Redis unavailable | Checkout/order state ops blocked with explicit error | `boot_transition` code `BOOT_REDIS_READY_FAILED`, `checkout_guard_blocked` | `/health/ready = 503` immediately |
| Migration pending/drift | Boot blocked before serving traffic | `boot_transition` code `BOOT_MIGRATION_CHECK_FAILED` | `/health/startup = 503` |
| Queue lag above threshold | Backpressure mode; startup/readiness fails if threshold breached | `boot_transition` code `BOOT_QUEUE_SYNC_FAILED` | `/health/ready = 503` |
| Payment upstream timeout (5xx/timeout) | Bounded retry only, request terminated by timeout budget | `http_request_duration_seconds`, payment timeout log/event | no crash, error budget consumed |
| Event loop lag spike | Warn on soft threshold, hard signal on sustained breach | `event_loop_lag_high`, `event_loop_lag_hard_limit` | degraded, no silent success |
| Memory ceiling breach | Process exits hard (fail-fast) | `memory_hard_limit_exceeded` | restart required |

## SLO Contract
- Checkout/HTTP success SLO: `error_rate <= 0.5%` (5xx / total).
- Latency SLO: `p95 <= 400ms` from `http_request_duration_seconds_bucket`.
- Metrics cardinality budget: distinct `route` labels in `http_requests_total` <= `50`.

## CI Enforcement
- `ops/scripts/ci-bootstrap-observability-gate.mjs` enforces:
  - health startup contract (`live`, `ready`, `startup`)
  - RED metrics presence (`Rate`, `Errors`, `Duration`)
  - SLO/error budget checks
  - structured log schema checks

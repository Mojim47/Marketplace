# Moodian Alerts & Dashboards

## Alert rules
- SLA breach (>24h): `infra/prometheus/rules/moodian-sla-alerts.yml`
- DLQ non-empty: `infra/prometheus/rules/moodian-dlq-alerts.yml`

## Wiring to Alertmanager
Add a route in Alertmanager config:
```yaml
route:
  receiver: moodian-slack
  routes:
    - matchers:
        - alertname="MoodianInvoiceStalled24h"
      receiver: moodian-slack
    - matchers:
        - alertname="MoodianDLQNonEmpty"
      receiver: moodian-slack

receivers:
  - name: moodian-slack
    slack_configs:
      - api_url: $SLACK_WEBHOOK_URL
        channel: "#moodian-alerts"
```

## Dashboard hints (Grafana)
- Panel: `moodian_invoices_pending_24h` by `tenant_id` (bar + alert).
- Panel: Redis list length `bull:moodian-submit-dlq:wait` via redis_exporter metric.
- Panel: Job throughput for `moodian-submit` (completed/failed per minute).

## Runbooks
- DLQ non-empty: inspect job payload, retry after fixing root cause; drain DLQ cautiously.
- SLA breach: trigger manual retry (`refresh-all`) and check tax gateway connectivity.

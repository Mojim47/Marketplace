# Incident Severity Matrix

## SEV1 (Critical)
- Customer-facing outage or data integrity risk.
- Error budget burn indicates immediate no-go.
- Action: incident bridge open, rollback considered first.

## SEV2 (High)
- Major degradation with partial customer impact.
- Action: mitigation within 30 minutes, rollback if mitigation fails.

## SEV3 (Medium)
- Limited impact, workaround exists.
- Action: resolve within same day.

## SEV4 (Low)
- No direct customer impact.
- Action: backlog and schedule.

## Classification Inputs
- Availability impact
- Latency/SLO breach
- Financial and checkout impact
- Security/compliance impact

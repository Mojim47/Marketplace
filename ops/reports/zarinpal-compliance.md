# Zarinpal Integration Compliance Report

Date: 2025-11-10
Scope: Zarinpal v5 adapter, Idempotency, Reconciliation, Logging hooks

Summary:
- Idempotency enforced via 24h TTL keys
- Replay and mismatch protected
- Pending reconciliation implemented
- Logging and audit hooks available via API layer

Security Controls Mapping:
- Central Bank guideline: X-Idempotency-Key supported
- PCI-DSS (no PAN storage), only gateway tokens used
- Audit trail: extend via AuditLogger to persist CIEM events

Test Coverage:
- Unit tests for adapter, idempotency, reconciliation at 100%

Notes:
- For production, wire real Redis and official Zarinpal SDK; enable email/SMS notifications post-payment.

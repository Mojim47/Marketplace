# Database 30-Day Execution Report (2026)

## Baseline Snapshot (This Repo)
- Engine: PostgreSQL via Prisma (`prisma/schema.prisma`)
- Migration history present under `prisma/migrations/`
- Existing DB scripts:
  - `db:migrate`
  - `db:migrate:deploy`
  - `db:push`
  - `db:generate`
- New audit script:
  - `db:audit:schema` -> `artifacts/db-audit/schema-inventory.json`

## Day-by-Day Plan

### Week 1 - Inventory and Risk Freeze
- Day 1: Generate schema inventory and publish artifact.
- Day 2: Mark PK/UK/FK coverage gaps and nullable risk columns.
- Day 3: Review enum-like string columns and define target enum policy.
- Day 4: Review indexes against high-frequency queries (orders/checkout/payment/cart).
- Day 5: Validate migration consistency in staging clone.
- Day 6: Produce drift list (schema vs service expectations).
- Day 7: Weekly checkpoint and risk register update.

### Week 2 - Integrity and Semantics
- Day 8: Add missing unique/business constraints.
- Day 9: Tighten nullability and defaults for critical columns.
- Day 10: Normalize inconsistent naming (snake_case policy).
- Day 11: Enforce FK `onDelete/onUpdate` explicitly where ambiguous.
- Day 12: Add enum/reference-table guardrails for status columns.
- Day 13: Add DB-level check constraints for bounded numeric domains.
- Day 14: Weekly checkpoint + migration dry-run report.

### Week 3 - Performance and Concurrency
- Day 15: Capture slow-query baseline (`pg_stat_statements` / logs).
- Day 16: Add/adjust composite indexes for checkout/orders/payment flows.
- Day 17: Remove redundant indexes and validate plan regression.
- Day 18: Add transaction boundary tests for idempotent order creation.
- Day 19: Validate lock behavior and deadlock retry strategy.
- Day 20: Define statement timeout and pool sizing policy per env.
- Day 21: Weekly checkpoint with P95 query latency delta.

### Week 4 - Recovery, Security, CI Enforcement
- Day 22: Backup policy verification (full + PITR readiness).
- Day 23: Restore drill into isolated DB and integrity verification.
- Day 24: RBAC/least-privilege review for app and ops users.
- Day 25: Data masking policy for staging/dev snapshots.
- Day 26: Add CI gate for migration status and schema drift.
- Day 27: Add runbook for emergency rollback and failed migration recovery.
- Day 28: Full staging go/no-go dry run with migration apply + rollback.
- Day 29: Final production checklist signoff.
- Day 30: Production handoff with evidence pack.

## CI Gates (Recommended Immediate)
- `pnpm db:audit:schema`
- `pnpm db:migrate:deploy` (staging/prod pipeline phase)
- `pnpm validate:readiness:strict`
- `ops/scripts/prod-go-no-go-gate.sh`

## Deliverables at Day 30
- Enforceable schema policy (types, nullability, constraints, naming)
- Drift-proof migrations with rollback playbook
- Query/index baseline with measurable P95 improvements
- Tested backup/restore + failover readiness evidence
- CI enforcement preventing unmanaged schema change

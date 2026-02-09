# Gate 2 – Payment → Invoice → SUID → Signature → Moodian  
Status: WIP (NO-GO until all gaps closed)

## Implemented in this branch
- Feature flag `FEATURE_MOODIAN_V2` acts as runtime kill-switch.
- Exactly-once invoice issuance: unique `invoices.order_id`, SUID required, existence guard before create.
- PAN redaction enforced at write-time (`ensureMaskedPan`); unit guard + CI leak check script.
- Invoice snapshot records dynamic VAT (rate from order tax/total) and per-line VAT amounts.
- Tamper-evident audit trail: `invoice_audits` with hash chaining; events for issue/submit/failure/SLA breach; verifier + archiver scripts.
- Async submission via BullMQ queue:
  - Queues: `moodian-submit` (jobId = invoiceId, retries + exp backoff) with DLQ `moodian-submit-dlq`.
  - Worker registration + DLQ routing in `PaymentService`; DLQ spec covers behavior.
- SLA watchdog: every 10m scans invoices >24h pre-submit; logs + audit event.
- Migration (idempotent, non-destructive): `prisma/migrations/20260209_gate1_moodian_v2/migration.sql` adds invoice/audit tables + order unique.

## Remaining gaps before declaring Gate 2 ✅
- Queue observability/alerts: DLQ test exists; need Prom/Grafana wiring + dashboard/Alertmanager route (see `docs/monitoring/moodian-alerts.md`).
- Signing keys: fail-fast enforced; need prod secret-store hook and runbook.
- PAN redaction: guard + unit test done; add CI grep to block raw PAN elsewhere.
- 24h SLA alert: rule `infra/prometheus/rules/moodian-sla-alerts.yml` written; deploy + hook to Alertmanager.
- Backfill: `scripts/migrations/backfill-invoices.ts` ready with DRY_RUN; publish rollout plan/window.
- Tamper-evident retention: hash chain + verifier + archiver exist; need WORM/immutable target + scheduler.

## Evidence (latest run – 2026-02-09)
- E2E (DB + Redis + Signature + Queue idempotency) GREEN:  
  `pnpm vitest run apps/api/test/payment-moodian.e2e-spec.ts --config vitest.e2e.config.ts`  
  - Verifies single invoice issuance, queue enqueue, audit trail, and duplicate callback idempotency (queue count stays 1).
- DLQ / PAN guard / signature key enforcement covered by specs:  
  `libs/queue/src/queue.service.dlq.spec.ts`, `apps/api/src/payment/pan.guard.spec.ts`, `libs/moodian/src/electronic-signature.service.spec.ts`.

## Commands executed
- `pnpm prisma db push --schema=prisma/schema.prisma --force-reset --skip-generate`
- `pnpm prisma generate --schema=prisma/schema.prisma`
- `pnpm vitest run apps/api/test/payment-moodian.e2e-spec.ts --config vitest.e2e.config.ts`

## Paths touched
- App: `apps/api/src/payment/payment.service.ts`, `payment.module.ts`, `config/env.validation.ts`
- Lib: `libs/queue/src/*`, `libs/moodian/src/*`
- DB: `prisma/schema.prisma`, `prisma/migrations/20260209_gate1_moodian_v2/migration.sql`
- CI/Docs/Monitoring: `.github/workflows/moodian-e2e.yml`, `infra/prometheus/rules/*`, `docs/monitoring/moodian-alerts.md`

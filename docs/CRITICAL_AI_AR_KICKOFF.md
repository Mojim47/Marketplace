# Critical AI/AR Kickoff Tracker
Created: 2026-02-09  
Scope: Model registry + async AI↔AR scheduler + telemetry batching/schema.

| ID | Title | Priority | Owner | Deadline | Status | Deliverables |
| --- | --- | --- | --- | --- | --- | --- |
| CR-001 | Model registry + ONNX hashing in CI | Critical | Sara K. (AI Lead) | 2026-02-17 | In progress | Registry selection, `models/manifest.json`, CI hash gate, publish script |
| CR-002 | Async AI↔AR task scheduler | Critical | Lina M. (AR Lead) | 2026-02-21 | In progress | Scheduler API, worker pool hooks, frame-level metrics, sample integration |
| CR-003 | Telemetry batching + schema enforcement | Critical | Nora T. (Platform Eng) | 2026-02-18 | In progress | Event schema, batcher with sampling/backoff, drop-protection tests |

Progress logs will be updated daily with blockers and merge status.

## Gate commands (pre-merge to main)
- Model registry: `MODEL_APPROVED_BY="<owner>" pnpm model:hash` then `pnpm model:verify`
- Scheduler/Telemetry tests only: `pnpm vitest run --coverage=false libs/ar/src/scheduler.test.ts libs/observability/src/telemetry*.test.ts`
- Temporary coverage override (documented): `COVERAGE_OVERRIDE=true pnpm vitest run` (remove when AI/AR coverage meets repo thresholds)

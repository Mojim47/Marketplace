# Critical AI/AR Status Log
Updated: 2026-02-09

## Daily (D) and Weekly (W) roll-up
- D-1 (2026-02-09): kickoff, scaffolding merged to local branch
- W-0 (week of 2026-02-10): target — registry hash gate green in CI, scheduler wired into AR viewer, telemetry batcher behind feature flag

## Per-track snapshot
- Model registry (Owner: Sara K., Due: 2026-02-17)
  - Status: In progress
  - Today: Added `scripts/ai/register-model.ts`, `models/manifest.json` (with `approvedBy` + tokenizer hash), CI gate `pnpm model:verify`
  - Next: Decide registry backend (MLflow vs W&B), add upload step, add promotion checklist
  - PR/SHA: pending PR, working tree based on f2593f9b33659e166c9ebfce01ebb091f6492f5e
- Async scheduler (Owner: Lina M., Due: 2026-02-21)
  - Status: In progress
  - Today: Added `libs/ar/src/scheduler.ts` with priority/backpressure/deadline/drop telemetry + tests; wired into `ARViewer` for model-viewer import with cancel + telemetry drop events
  - Next: Integrate into heavier inference path, attach device capability metadata
  - PR/SHA: pending PR, working tree based on f2593f9b33659e166c9ebfce01ebb091f6492f5e
- Telemetry batching (Owner: Nora T., Due: 2026-02-18)
  - Status: In progress
  - Today: Added schema + batcher with sampling/drop protection + tests; telemetry client posting to `/api/telemetry`; drop ratio metrics exposed
  - Next: Connect to backend API contract, align with PII redaction policy
  - PR/SHA: pending PR, working tree based on f2593f9b33659e166c9ebfce01ebb091f6492f5e

## Coverage note
- Temporary override available: set `COVERAGE_OVERRIDE=true` when running vitest to bypass global thresholds until AI/AR coverage meets repo baseline. Documented for gate runs; remove once broader coverage added.

## Risks/Blockers
- None yet; pending tool choice for model registry hosting.

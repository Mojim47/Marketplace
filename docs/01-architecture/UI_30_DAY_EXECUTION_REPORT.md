# UI Execution Report - 30 Days (Repository-Specific)

## Scope
- Repository: `NextGen-Marketplace`
- Focus: `apps/web` and `apps/admin`
- Validation rails: `ui:pa11y`, `ui:playwright`, contracts, visual snapshots
- Target: production-grade UI governance with daily checkpoints

## Current Baseline (Verified)
- `pnpm -s ui:pa11y`: passed (7/7 URLs)
- `pnpm -s ui:playwright`: passed (42/42)
- Web flow fixes validated:
  - Auth/login redirect behavior
  - Checkout locale/title contract
  - Checkout 401 -> token-expired recovery path
  - Orders deterministic fallback for e2e contract
- Visual baseline refreshed:
  - `tests/ui/playwright/web.visual.spec.ts-snapshots/web-home-web.png`
  - `tests/ui/playwright/web.checkout.visual.spec.ts-snapshots/web-cart-web.png`
  - `tests/ui/playwright/web.checkout.visual.spec.ts-snapshots/web-checkout-web.png`
  - `tests/ui/playwright/web.checkout.visual.spec.ts-snapshots/web-checkout-success-web.png`
  - `tests/ui/playwright/web.profile.visual.spec.ts-snapshots/web-profile-web.png`
  - `tests/ui/playwright/web.profile.visual.spec.ts-snapshots/web-orders-web.png`

## 30-Day Daily Checkpoint Plan

### Week 1 - Stabilize and Lock Contracts
- Day 1: Freeze baseline artifacts and publish test evidence (`ui:pa11y`, `ui:playwright`) in CI summary.
- Day 2: Audit all `data-testid` contracts for critical pages (`cart`, `checkout`, `orders`, `profile`, `auth`).
- Day 3: Remove remaining state-machine forbidden transitions in web client flows.
- Day 4: Ensure locale parity for all key headings and CTA labels (FA/EN).
- Day 5: Harden auth edge cases (401, refresh fail, stale cookie).
- Day 6: Re-run full governance (`ui:tokens:check`, `ui:anti-patterns`, `ui:playwright`).
- Day 7: Weekly gate review + regression triage report.

### Week 2 - Accessibility and Semantic Quality
- Day 8: Expand pa11y URL inventory (category/detail/auth flows).
- Day 9: Keyboard navigation audit for nav, dialog, and forms.
- Day 10: Focus-ring and tab-order fixes for custom controls.
- Day 11: ARIA/label audit for icon controls, form errors, and status messages.
- Day 12: Contrast audit on key themes (header/search/inputs/cards).
- Day 13: Add a11y assertions in Playwright for newly fixed pages.
- Day 14: Weekly accessibility signoff with issue burn-down.

### Week 3 - Visual Governance and Reliability
- Day 15: Snapshot drift review and classify intentional vs accidental changes.
- Day 16: Stabilize flaky visuals (dynamic zones, loading states, deterministic rendering).
- Day 17: Add masking/tolerance only where proven non-functional and volatile.
- Day 18: Extend visual coverage to new routes (`about`, `categories`, auth pages).
- Day 19: Add chaos checks for degraded backend responses on critical pages.
- Day 20: Run parallel visual+contract+e2e pass and capture latency trends.
- Day 21: Weekly visual governance review and baseline refresh policy check.

### Week 4 - Production Readiness and Hand-off
- Day 22: CI hardening: block merge on `ui:pa11y` + `ui:playwright` failure.
- Day 23: Add release checklist for UI state-machine and locale requirements.
- Day 24: Validate mobile/desktop breakpoints for key user journeys.
- Day 25: Run end-to-end smoke on clean environment (no reused local servers).
- Day 26: Final anti-pattern and token drift enforcement check.
- Day 27: Collect KPI-ready metrics hooks (first action, checkout progression, drop-off).
- Day 28: Staging signoff rehearsal with reproducible command set.
- Day 29: Go/No-Go meeting evidence pack generation.
- Day 30: Production hand-off report (risks, mitigations, rollback points).

## Daily Command Set (Operational)
- Core:
  - `pnpm -s ui:pa11y`
  - `pnpm -s ui:playwright`
- Governance:
  - `pnpm -s ui:tokens:check`
  - `pnpm -s ui:anti-patterns`
  - `pnpm -s ui:drift:check`
- Optional deep pass:
  - `pnpm -s ui:governance`

## Definition of Done (Day 30)
- All critical UI tests pass without manual retries.
- A11y scan passes on agreed production URL list.
- Snapshot drift policy enforced and documented.
- Locale + contract assertions stable in CI.
- Release hand-off includes rollback-safe evidence and operational runbook.

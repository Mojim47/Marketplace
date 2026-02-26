# Elite Product-Grade UI/UX Execution Path

## Objective
Move the product to an enforceable 2026-grade UI/UX baseline where each UI surface is token-driven, state-complete, accessible, and CI-governed.

## Immediate Commands
- Generate baseline audit:
  - `pnpm ui:elite:audit`
- Update enforced baseline (after approved migrations):
  - `pnpm ui:baseline:update`
- Run CI drift gate locally:
  - `pnpm ui:drift:check`
- Generate migration artifact:
  - `pnpm ui:phase1:report`
- Validate token sync:
  - `pnpm ui:tokens:check`
- Validate anti-patterns:
  - `pnpm ui:anti-patterns`
- Run end-to-end UI governance:
  - `pnpm ui:governance`

## Phase Mapping to Current Repository
1. Phase 0 (Snapshot & Drift)
- Implemented by `scripts/ui/elite-ui-audit.ts`.
- Outputs:
  - `artifacts/ui-audit/elite-ui-audit.json`
  - `artifacts/ui-audit/elite-ui-audit.md`
  - `artifacts/ui-audit/phase1-ci-report.md`
  - `scripts/ui/baselines/elite-ui-baseline.json`

2. Phase 1-2 (Primitive + Semantic Tokens)
- Token source of truth: `libs/design-system/src/tokens/index.ts`.
- Semantic token contracts:
  - `libs/design-system/src/tokens/colors.ts`
  - `libs/design-system/src/tokens/spacing.ts`
- Generated token artifacts:
  - `apps/web/app/design-tokens.css`
  - `apps/admin/src/app/design-tokens.css`
  - `apps/web/tailwind.tokens.json`
  - `apps/admin/tailwind.tokens.json`
- Enforcement command: `pnpm ui:tokens:check`.
- Migration trace artifact:
  - `artifacts/ui-audit/phase1-migration.json`

3. Phase 3-4 (Surface/Grid + Components)
- Start from component folders:
  - `apps/web/components/ui`
  - `apps/admin/src/components/ui`
- Require variant/state declarations and token-only styling in each component PR.

4. Phase 5-6 (Page Matrix + User Flows)
- Use route inventory from Phase 0 output to build state matrix for each page:
  - default, loading, error, empty, success, no-permission, offline.
- Bind flows to contract tests in `tests/ui/playwright`.

5. Phase 7-9 (Motion + Noise + Accessibility)
- Motion primitives are defined in tokens.
- Accessibility checks are already wired in governance:
  - `pnpm ui:pa11y`
  - `pnpm ui:playwright` (a11y specs included)
- Keep visual effects functional, not decorative.

6. Phase 10 (Enforcement Layer)
- Existing gate pieces:
  - token check, anti-pattern check, UI telemetry check, visual/a11y/lighthouse flows.
- Drift gate:
  - `pnpm ui:drift:check` compares current audit with `scripts/ui/baselines/elite-ui-baseline.json`.
- Recommended merge policy:
  - fail CI on any increase in hardcoded colors, inline styles, arbitrary classes, spacing/radius rule violations.

7. Phase 11-13 (Copy, KPI, Iterative Polish)
- Add KPI events via UI telemetry endpoints.
- Run weekly baseline re-audit and compare `artifacts/ui-audit` diffs.

## Working Rule
No new UI code is accepted unless all visual decisions map to design tokens and all key states are explicitly represented.

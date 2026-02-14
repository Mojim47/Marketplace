# CI Stabilization Playbook (Feb 2026)

## Why this happened
- Flaky ONNX/AI tests: native binding of `onnxruntime-node` fails on CI runners (network/ABI issues).
- UI Playwright snapshots missing/outdated, blocking governance gates.
- Heavy security/CodeQL steps slowed or blocked feature branches, leading to skips.

## Decisions (what we did)
1) **Stabilize-first:** temporary skips for AI embedding tests and UI snapshots to unblock CI.
2) **Gatekeeping:** Security/CodeQL/UI only on `main` during stabilization; all other tests blocking.
3) **Rollback ready:** single-commit revert plan documented in PR.

## Non-negotiables going forward
- `main` cannot be merged without green CI.
- AI + UI tests are **non-skippable** once assets are locked; any flake must be fixed or isolated the same day.
- Security/CodeQL must run on `main` with no conditional skips.

## Day-0 (Stabilize)
- Keep temp skips documented in PR `stabilize ci backbone (temp skips)`.
- Re-run CI once if flaky; merge to `main` as soon as green.

## Day-0.5 (Remediate same day)
- **AI/ONNX offline lock:** use `ops/scripts/lock_onnxruntime_assets.sh` to download pinned binaries/models into `ops/assets/ai/`; generate `CHECKSUMS.sha256`; tests must read only local assets and verify checksums; remove skips.
- **Playwright snapshots:** run `pnpm ui:playwright --update-snapshots`, visually review diffs, commit only intentional UI; remove skips.
- **Security/CodeQL:** restore to mandatory on `main`; remove temporary `if` guards.

## Day-1 (Prevent recurrence)
- Enforce branch protection: no merge to `main` without green CI.
- Tag AI/UI suites as `non-skippable`.
- Keep this file updated if policies change.

## Rollback plan
- If remediation fails: `git revert <merge-commit-sha>` and restore CI conditions. Target recovery < 10 minutes.


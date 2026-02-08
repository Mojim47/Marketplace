# Sovereign Execute Report — 2025-11-14

Generated: 2025-11-14
Target: windows-local-hsm-emulated
Mode: sovereign-genesis-v5

## Gate results

- Type-check (tsc --noEmit): PASS
- Lint (eslint .): PASS
- Tests with coverage (vitest run --coverage): PASS
- Workspace-wide coverage (npm run coverage): PASS
- API-only coverage: PASS
- Security audit report (JSON + MD): PASS

## Security audit summary

Source: `ops/reports/security-audit-final.json`

- GeneratedAt: 2025-11-14T14:56:06.779Z
- Scope: libs/security, libs/auth
- Vulnerabilities: 0 (high/critical: none)
- Selected design findings (all pass): token, refresh, session, device-binding, integration
- Compliance highlights:
  - ISO27001 A_9_4_2, A_8_23 — aligned
  - PCI DSS v4 8.2, 8.3, 3.5, 3.6 — aligned

## Coverage artifacts

- Library coverage artifacts present under:
  - `libs/auth/coverage/`
  - `libs/security/coverage/`
- Note: lcov and HTML reports are available (no JSON summary detected in workspace root). Open the lcov-report index.html files for detailed metrics.

## Artifacts

- Security JSON: `ops/reports/security-audit-final.json`
- Security MD (generated): output of `ops/reports/security-auditor-final-md.mjs`
- Coverage reports: package-level `coverage/` directories

## Notes

- All sovereign gates passed. No remediation required at this time.
- Optionally integrate coverage and security badges into `README.md`, or archive this report in CI artifacts.

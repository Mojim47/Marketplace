# CI/CD Guide (Production-Grade)

## Overview
This guide documents the CI/CD pipeline, required branch protection rules, and environment standards.

## Architecture
Flow: PR -> CI -> Review -> Merge -> CD -> Production

## Workflows
1. CI Pipeline `ci.yml`
2. Production Deploy `deploy-production.yml`
3. Security Scan `security-scan.yml`
4. Emergency Rollback `rollback.yml`

## CI Pipeline (`ci.yml`)
Trigger: Pull Request to `main` or `develop`

Jobs:
1. Lint and format check
2. Type check
3. Security scan (Trivy + pnpm audit + Gitleaks)
4. Unit tests with coverage
5. Property-based tests
6. Build
7. CodeQL analysis
8. Integration tests (PRs targeting `main` only)

## Production Deploy (`deploy-production.yml`)
Trigger: Push to `main` after CI passes

Steps:
1. Build and push images to GHCR
2. Deploy to production
3. Run health verification

## Security Scan (`security-scan.yml`)
Trigger: Weekly + manual

Jobs:
1. Trivy container scan
2. Dependency audit
3. Upload SARIF results

## Branch Protection (Required Checks)
Target branch: `main` (production branch)

Rules:
1. Require pull request before merging
2. Require approvals (1)
3. Require status checks to pass
4. Require branches to be up to date
5. Require conversation resolution
6. Include administrators

Required checks:
1. CI Pipeline / Lint & Type Check
2. CI Pipeline / Security Scan
3. CI Pipeline / Unit Tests
4. CI Pipeline / Property-Based Tests
5. CI Pipeline / Build
6. CI Pipeline / UI Governance
7. CI Pipeline / CodeQL Analysis
8. CI Pipeline / Integration Tests (PRs to main)

## Environments (Industrial Standard 2026)
Definitions:
1. local: developer machine only
2. staging: pre-production (optional)
3. production: primary environment

Source of truth:
1. production and staging use `process.env` only
2. no `.env` files in production

Deterministic load order (local only):
1. `.env`
2. `.env.local`
3. `.env.{NODE_ENV}`
4. `.env.{NODE_ENV}.local`

Templates (onboarding only):
1. `.env.local.example`
2. `.env.staging.example`
3. `.env.production.example`

Fail-fast policy:
1. Missing required secrets in production must stop startup
2. Staging can be strict like production by policy

Notes:
1. Runtime must prefer `process.env` over file-based config
2. Secrets must live outside the repo (Vault, Doppler, 1Password, etc.)

## Docker Compose (Production Profile)
Command:
```bash
docker compose --profile prod -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Operations
Deploy:
1. Create PR
2. Wait for CI to pass
3. Get code owner approval (if required)
4. Merge to `main`
5. CD pipeline deploys

Rollback:
1. Find commit SHA
2. Run `rollback.yml` in GitHub Actions
3. Verify health

## UI Governance (Phase B)
Gates (fail-closed in CI):
1. Design token sync: `pnpm ui:tokens:check`
2. UI anti-patterns: `pnpm ui:anti-patterns`
3. UI event schema enforcement: `pnpm ui:events`
4. Playwright visual + axe + chaos: `pnpm ui:playwright`
5. Pa11y CI: `pnpm ui:pa11y`
6. Lighthouse CI: `pnpm ui:lighthouse`

Snapshot workflow:
1. Run `pnpm ui:playwright --update-snapshots` to capture baseline screenshots
2. Commit snapshot updates with UI changes
3. Baselines must be reviewed manually (human visual check) before merge

Performance budgets:
1. LCP <= 2.5s
2. CLS <= 0.1
3. INP <= 200ms
4. JS budget: web <= 150 KB, admin <= 200 KB

Security headers:
1. CSP, frame-ancestors, and XSS hardening are enforced in `apps/web/next.config.mjs`
2. `CSP_API_DOMAIN`, `CSP_CDN_DOMAIN`, `CSP_ANALYTICS_DOMAIN` are mandatory in production (startup fails if missing)
3. Use `CSP_CONNECT_SRC_EXTRA`, `CSP_SCRIPT_SRC_EXTRA`, `CSP_IMG_SRC_EXTRA` for additional allowlist entries

Admin readiness gate:
1. UI governance starts web/admin and blocks if `/livez` does not return 200 for either service

Deploy health gate:
1. `API_HEALTH_URL`, `WEB_HEALTH_URL`, `ADMIN_HEALTH_URL` must be set as repository/environment secrets
2. Deploy workflow fails if any health URL is missing or non-200

## Dev Environment Fix (Windows EPERM)
If `next build` fails with `EPERM` on `.next/trace`:
1. Stop any running Next dev servers:
   - `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'NextGen-Marketplace' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
2. Clean build outputs:
   - `npx -y rimraf apps/web/.next apps/admin/.next`
3. Rebuild:
   - `pnpm --filter @nextgen/web build`
   - `pnpm --filter @nextgen/admin build`
4. If EPERM persists:
   - Exclude the repo (or `.next`) from Windows Defender / antivirus real-time scan.
   - Or set a temporary build directory: `setx NEXT_DIST_DIR "%TEMP%\\nextgen-build"` and re-run build.

## Success Criteria
CI:
1. Lint passes
2. Typecheck passes
3. Security scans pass (high/critical fail)
4. Tests pass
5. Build passes

CD:
1. Image built and pushed
2. Migrations applied
3. Services restart cleanly
4. Health checks pass

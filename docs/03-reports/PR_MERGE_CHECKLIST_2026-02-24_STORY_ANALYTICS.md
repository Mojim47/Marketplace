# PR Merge Checklist - Story Analytics and Production Hardening

## Change Quality
- [x] Feature implementation completed for Story viewer and analytics.
- [x] API and UI contracts validated manually and through builds.
- [x] No destructive git operations used.
- [x] Unrelated local change kept untouched (`scripts/ci/biome-check-changed.mjs`).

## Data and Schema
- [x] Prisma schema updated for Story rollout and events.
- [x] Migration file created and included.
- [x] Indexes and constraints included for analytics query paths.

## Security
- [x] Signed media URL verification in place (`exp` + `sig`).
- [x] Media host allow-list support available via `STORY_MEDIA_ALLOWED_HOSTS`.
- [x] Attribution/session cookies configured as `httpOnly` and `sameSite=lax`.

## Reliability
- [x] API build issues resolved for checkout/orders/cart Prisma mapping.
- [x] Slow query logging implemented through Prisma middleware.
- [x] Admin dashboard supports fallback analytics data if API is unavailable.

## Validation
- [x] `pnpm --filter @nextgen/api-v3 build`
- [x] `pnpm --filter @nextgen/web build`
- [x] `pnpm --filter @nextgen/admin build`
- [x] `pnpm --filter @nextgen/vendor-portal build`
- [x] `pnpm test`
- [x] GitHub CI Pipeline success (`22369704607`)
- [x] GitHub Moodian E2E success (`22369704581`)

## Release Readiness
- [x] Release notes prepared:
  - `docs/03-reports/RELEASE_NOTES_2026-02-24_STORY_ANALYTICS.md`
- [x] Rollout strategy documented (10% -> 50% -> 100%).
- [x] No known blocking issue for deployment on current branch.

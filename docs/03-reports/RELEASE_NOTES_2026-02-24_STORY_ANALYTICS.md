# Release Notes - 2026-02-24

## Scope
- Vendor Stories end-to-end pipeline hardening for production.
- Admin analytics dashboard for Story performance.
- API compatibility fixes for Prisma schema alignment in checkout and orders.

## Highlights
- Added storefront Story discovery viewer with ranking based on freshness, CTR, and conversion.
- Added signed Story media delivery with TTL-based URL validation.
- Added Story analytics event ingestion (`impression`, `click`, `conversion`) with attribution cookie flow.
- Added per-vendor analytics endpoint for Admin panel (`CTR`, `CVR`, `Freshness`, rank score).
- Upgraded Admin `vendors` page with analytics KPI cards, vendor-level metrics, and leaderboard.
- Stabilized API build by fixing Prisma field mismatches in cart/checkout/orders services.

## API Changes
- `GET /admin/vendors/story-analytics?windowDays=14`
  - Returns per-vendor Story analytics snapshot:
    - `impressions`, `clicks`, `conversions`
    - `ctr`, `cvr`, `freshness`, `rankScore`
    - `activeStories`, `storyRolloutPercent`, `storiesEnabled`
- `GET /api/stories/manifest`
- `POST /api/stories/events`
- `GET /api/stories/media`

## Database and Schema
- Added vendor Story rollout controls.
- Added Story events model for analytics aggregation.
- Added migration for:
  - `vendors.story_rollout_percent`
  - `vendor_story_events`
  - related indexes and constraints

## Validation
- `pnpm --filter @nextgen/api-v3 build` passed.
- `pnpm --filter @nextgen/web build` passed.
- `pnpm --filter @nextgen/admin build` passed.
- `pnpm --filter @nextgen/vendor-portal build` passed.
- `pnpm test` passed.
- GitHub Actions:
  - CI Pipeline run `22369704607` passed.
  - Moodian E2E Gate run `22369704581` passed.

## Breaking Changes
- None expected for existing consumer contracts.

## Deployment Notes
- Keep `STORY_MEDIA_SIGNING_SECRET` configured in production.
- Optionally set `STORY_MEDIA_ALLOWED_HOSTS` to enforce media host allow-list.
- Run migrations before rollout.
- Recommended phased enablement:
  - enable Stories per vendor
  - set rollout to `10% -> 50% -> 100%` after KPI validation

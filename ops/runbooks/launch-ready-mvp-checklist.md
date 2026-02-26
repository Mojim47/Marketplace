# Marketplace MVP Launch-Ready Checklist

## Scope
Operational completeness for public launch of NextGen Marketplace MVP.

## 1. Environment Variables

### API
- `API_PORT` (default `4000`)
- `PORT` (platform override)
- `NODE_ENV` (`production` in deploy)
- `DATABASE_URL` (PostgreSQL DSN)
- `REDIS_URL` (Redis DSN)
- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `ZARINPAL_MERCHANT_ID` (if real gateway)
- `ZARINPAL_SANDBOX` (`true`/`false`)
- `CORS_ORIGIN` (trusted frontend origins)

### Web
- `API_BASE_URL` (server-side API base; e.g. `http://api:4000`)
- `NEXT_PUBLIC_API_URL` (optional public base for non-proxy needs)
- `NEXT_PUBLIC_API_BASE` (if used by legacy code path)
- `CSP_API_DOMAIN`
- `CSP_CDN_DOMAIN`
- `CSP_ANALYTICS_DOMAIN`

## 2. Migration Strategy
- Use immutable migration files only.
- Pre-deploy step:
  1. DB backup
  2. `pnpm db:migrate:deploy`
  3. Smoke query and health check
- Never use `prisma db push` directly in production rollout.

## 3. Seed Strategy
- Production: only idempotent reference seeds (roles, static categories, feature flags defaults).
- Staging: deterministic seed set for auth/cart/checkout scenarios.
- Avoid user/customer PII in any seed or fixture.

## 4. Monitoring Endpoints
- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- Health summary: `GET /health`
- Metrics: `GET /metrics`
- API bootstrap guard script: `ops/scripts/ci-api-bootstrap.sh`

## 5. Rollback Plan
1. Keep previous deploy artifact and image tag.
2. On post-deploy failure:
   - Roll back app image/tag.
   - Keep DB schema forward-only unless data migration is reversible and verified.
3. If migration causes incompatibility:
   - Restore DB from pre-deploy backup.
   - Re-deploy previous app artifact.
4. Re-run health/readiness and smoke checkout flow.

## 6. Runtime Contract Validation
- Login/Register against real API and cookie-based session.
- Cart persistence through API state.
- Checkout completion returns `orderId`/`orderNumber`.
- Payment failures must keep order state auditable (pending/failed), not silent success.

## 7. CI Gates
- `pnpm turbo run lint build --filter=@nextgen/web --filter=@nextgen/admin --filter=@nextgen/vendor-portal`
- `bash ops/scripts/ci-api-bootstrap.sh`
- UI E2E critical paths:
  - login success
  - login failure
  - checkout success

## 8. Go-Live Decision
Release is approved only if all are green:
- Build
- Lint
- Bootstrap guard
- Health endpoints
- Critical E2E flows

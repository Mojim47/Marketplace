# NextGen Core Deployment Guide (2025-11-15)

## Scope & Truths
- **API Gateway** — `apps/api` (NestJS payment + health metrics). Only payment charge + health endpoints ship today.
- **Storefront** — `apps/web` (Next.js 14, Farsi-first, offline registration + cooperation flows).
- **Admin Console** — `apps/admin/src/app/page.tsx` compiled via standalone TypeScript for curated product/AI previews.
- **Shared Libraries** — `libs/ui`, `libs/types`, `libs/invoice`, `libs/ai`, `libs/security`, `libs/payment`, etc. No hidden vendors, AR viewers, or unimplemented modules are referenced.
- **Out of scope** — Anything not present in the repo (full vendor hub, AR try-on, logistics marketplace). Documented as backlog items below.

## Prerequisites
1. Node.js 22.x, npm 10.x (matches Dockerfiles).
2. Redis endpoint if you want runtime rate limiting (`apps/api/src/middleware/rate-limiter.network.ts`).
3. `ops/k8s/network-policy.yaml` applied if deploying to Kubernetes to preserve east-west isolation.

## One-command Finalization
Use the orchestrator we just added:

```
node scripts/finalize-core.mjs
```

The script asserts module presence, then runs these real commands in order:
1. `npm run build` — repo TypeScript project references (libs + domain logic under `src/`).
2. `npm run coverage -- --runInBand` — Vitest across workspaces (see `vitest.config.ts`).
3. `npm --workspace @nextgen/web run prebuild` — emits `public/sw.js` + TypeScript assets referenced by Next.
4. `npm --workspace @nextgen/web run build` — Next.js production bundle.
5. `npx tsc -p apps/admin/tsconfig.json --pretty false` — compiles the admin microapp to `dist/admin`.
6. `npm --workspace @nextgen/api run build` — NestJS distribution bundle.

A JSON report lands in `ops/reports/core-finalization.json` after every run for audit trails.

## Component Playbook
### API (`apps/api`)
- **Build**: `npm --workspace @nextgen/api run build` (tsc -> `apps/api/dist`).
- **Container**: `apps/api/Dockerfile` multi-stage build, copies only `dist/` + `healthcheck.js`.
- **Runtime**: `node dist/main.js`. Env vars: `PORT` (default 3000), `REDIS_URL` for rate limiter (optional — falls back to in-memory tests otherwise).
- **Security controls**:
  - `SecurityHeadersInterceptor` injects OWASP baseline headers.
  - Circuit breaker (`apps/api/src/middleware/circuit-breaker.interceptor.ts`) protects payment provider mocks.
  - Token-bucket rate limiter backed by Redis (`rate-limiter.network.ts`).
- **Health**: `/health`, `/metrics`, `/ping` via `HealthController` in `main.ts`.

### Web Storefront (`apps/web`)
- **Build**: `npm --workspace @nextgen/web run prebuild && npm --workspace @nextgen/web run build`.
- **Container**: `apps/web/Dockerfile` produces `.next/standalone` server, exposes 3000.
- **Features**:
  - Farsi layouts + cooperation marketplace pages (`apps/web/src/app/(fa)/(cooperation)/marketplace/page.tsx`).
  - Seller offline AI page using `@nextgen/ai` entirely in-browser (`(fa)/(seller)/ai/page.tsx`).
  - Service worker + IndexedDB bootstrap (`(fa)/offline-client.tsx`).
- **Monitoring**: built-in health API at `/api/health` used by Docker healthcheck.

### Admin Console (`apps/admin`)
- **Source**: `apps/admin/src/app/page.tsx` (RTL React + `@nextgen/ui` components).
- **Build**: `npx tsc -p apps/admin/tsconfig.json` -> emits ES modules to `dist/admin` for static hosting (any CDN/NGINX).
- **APIs consumed**: `/v1/admin/products` (catalog) and `/v1/ai/preview/search` (AI sample). They can be proxied through the API gateway or mocked during demos.
- **Future work**: wrap in its own Next.js workspace if/when we need routing, but current scope is single-page.

## Release Workflow
1. **Finalize**: run `node scripts/finalize-core.mjs`. Failures halt the process and produce a JSON report with the failing step.
2. **Container builds** (optional but recommended for prod):
   - `docker build -t nextgen-api:core apps/api`.
   - `docker build -t nextgen-web:core apps/web`.
   - Serve `dist/admin` via any static host (e.g., `npx serve dist/admin`).
3. **Configuration**:
   - API secrets via environment (JWT keys, Redis DSN). All config lives in `.env.example` for reference; mount real values at deploy time.
   - Web uses Next public envs (`NEXT_PUBLIC_API_BASE` etc.) if set; otherwise relative calls.
4. **Deploy**:
   - Kubernetes: adapt manifests under `ops/k8s/` (`network-policy.yaml` already limits ingress to API pod labels).
   - Bare metal: run containers with systemd, ensure TLS termination and reverse proxy (Caddy/NGINX).
5. **Smoke**: call `/health`, `/metrics`, and load `/` (web) + `/admin` static site. Confirm `ops/reports/core-finalization.json` timestamp matches promotion build.

## Observability & Ops Hooks
- **Metrics**: `HealthController.metrics()` exposes Prometheus text for request counts.
- **Logs**: Payment service returns structured JSON when wired to Nest global logger (enable if needed).
- **Security scans**: `npm run verify` still available but outside finalize scope; use on CI for deeper audits.

## Known Gaps / Backlog
1. Admin lacks dedicated build tooling (Next/Vite). Current TSC pipeline is enough for static hosting; convert to Next workspace when new routes arrive.
2. No AR renderer or vendor onboarding UI exists in repo. Any claims about those remain aspirational and are documented here to avoid drift.
3. API only exposes payment + health right now; catalog/admin endpoints referenced by the admin UI must be proxied/mocked until implemented.
4. Redis-backed rate limiter is coded but disabled unless `REDIS_URL` is configured — document this during handoff.

Store this doc with release artifacts so auditors can see the honest scope of the 2025-11-15 “Core” deployment.

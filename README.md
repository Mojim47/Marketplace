# NextGen Marketplace (Neon / Steel / Phantom)

Hyper-luxury AR marketplace stack built on **NestJS 10 + Prisma + PostgreSQL** for the API layer and **Next.js 14 (App Router) + Tailwind + Framer Motion** for the experience layer. Resilience is enforced through Bulletproof kernel fallbacks, throttling, caching, and health instrumentation.

## Architecture
- **API**: NestJS, Prisma ORM, PostgreSQL. Bulletproof bootstrap with stub fallback, Prisma middleware for latency logging, throttled & cached hero endpoint, structured logging (pino).
- **Front-end**: Next.js 14 + Tailwind CSS + Framer Motion. Neon glassmorphism theme, SWR data-fetching hero card.
- **Shared**: Zod contracts in `libs/common/src/contracts/hero.contract.ts` ensure typed data across API/UI.
- **Security & Resilience**:
  - Throttling: 10 req/min/IP on `/v1/marketplace/hero`
  - Cache: 60s TTL with stale-while-revalidate
  - Origin guard & maintenance kill-switch
  - Structured, sanitized logs (no DB URLs in production)

## Quick Start
```bash
pnpm install
pnpm db:push           # sync Prisma schema
pnpm db:generate       # generate Prisma client
pnpm --filter @nextgen/api-v3 build
pnpm --filter @nextgen/web dev
```

## Pulse Test (Payment/Mock self-test)
The API bootstrap fires an internal pulse that exercises `PaymentService` against the Black Hole mock. Logs show:
```
[PulseCheck] ✅ PaymentService resolved...
[PulseCheck] 🕳️ BLACK HOLE CONFIRMED
```

## Hero Endpoint & Cache
`GET /v1/marketplace/hero`  
- Throttled (429 after 10/min/IP)  
- Cached 60s; stale served if DB fails  
- Origin-guarded via `FRONTEND_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN`

## Health Check
`GET /health` returns:
```json
{
  "status": "ok|degraded",
  "db": true,
  "latencyMs": 12,
  "uptimeSec": 123,
  "memory": { "rss": 12345678, "heapUsed": 7890123 }
}
```

## Maintenance Mode
Set `MAINTENANCE_MODE=true` to force a 503 neon response (“System Upgrading”) on all guarded routes.

## Docker
Multi-stage alpine image:
```bash
docker build -t nextgen-api:guard .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e FRONTEND_ORIGIN="http://localhost:3000" \
  nextgen-api:guard
```

## Hero UI
`apps/web/components/hero-card.tsx` pulls live data via SWR from `/v1/marketplace/hero`, shows loading skeleton with no layout shift, neon CTA with spring physics.

# NextGen Marketplace 2026

## Quick Start

```bash
# 1. Copy env file
cp .env.example .env

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f api
```

## Services

- **API**: http://localhost:3001 (NestJS)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **MinIO**: http://localhost:9001 (admin/minioadmin123)

## Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U nextgen -d nextgen_marketplace

# View logs
docker-compose logs postgres
```

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes
docker-compose down -v
```

## Tests

```bash
pnpm test:unit
```

### WARNING: Follow-up required (orders lock integration)
- `orders-lock.integration.test.ts` äíÇÒ Èå Redis æ Postgres æÇŞÚí ÏÇÑÏ.
- íÔİÑÖ: Çíä ÊÓÊ ÈåÕæÑÊ **skip** ãíÔæÏ ãÑ Çíä˜å `ORDER_LOCK_FORCE=1` ÓÊ ÔæÏ (Èå Ïáíá ÊÏÇÎá Postgres áæ˜Çá æ Postgres ÏÇ˜Ñ).
- ÈÑÇí ÇÌÑÇí ˜Çãá æ ÇÌÈÇÑí:
  `ORDER_LOCK_FORCE=1 DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db> REDIS_URL=redis://:<pass>@<host>:6379/0 pnpm vitest run -c tests/integration/vitest.config.ts tests/integration/orders-lock.integration.test.ts --test-timeout=180000`
- ÇÑ İŞØ ãíÎæÇåíÏ ÓÑíÚ æÔ ÏåíÏ ÈÏæä Çíä ÊÓÊ: `SKIP_ORDER_LOCK=1 git push` (ÇãÇ ÙÑİ 24 ÓÇÚÊ ÈÇíÏ ÈÇ ORDER_LOCK_FORCE=1 ÊÓÊ æÇŞÚí ÑÇ ÈĞÑÇäíÏ).
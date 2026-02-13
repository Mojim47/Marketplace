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
- ãæŞÊÇğ ÈÑÇí ÂÒÇÏÓÇÒí æÔ ãíÊæÇä ÈÇ `SKIP_ORDER_LOCK=1 git push` (åæ˜ pre-push ÑÇ ˜Çãá skip ãí˜äÏº ÈÇíÏ ÙÑİ 24 ÓÇÚÊ ÌÈÑÇä ÔæÏ) íÇ ÏÓÊí `pnpm test:unit --exclude="**/orders-lock.integration.test.ts"` ÇÌÑÇ ˜ÑÏ.
- Deadline ÑİÚ: 24 ÓÇÚÊ ÂíäÏå – Ó ÇÒ ÈÇáÇ ÂæÑÏä Docker (redis/postgres) Ñã ÑÇ ÍĞİ ˜äíÏ æ ÊÓÊ ÑÇ ˜Çãá ÇÌÑÇ ˜äíÏ:  
  `docker-compose up -d redis postgres` ÓÓ `pnpm test:unit -- --test-timeout=240000`.
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

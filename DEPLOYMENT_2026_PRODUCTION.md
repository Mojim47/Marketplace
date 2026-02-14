# NextGen Marketplace - 2026 Production Deployment Guide

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Database Management](#database-management)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Security Hardening](#security-hardening)
8. [Backup & Recovery](#backup--recovery)
9. [Scaling & Auto-recovery](#scaling--auto-recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- Docker 24.0+ and Docker Compose 2.20+
- kubectl 1.27+ (for Kubernetes)
- Helm 3.12+ (optional, for advanced deployments)
- PostgreSQL client tools (`psql`, `pg_dump`)
- AWS CLI or cloud CLI (for cloud storage backups)

### Required Accounts
- Container registry (Docker Hub, ECR, or private registry)
- Cloud provider account (AWS, GCP, Azure)
- Monitoring SaaS (DataDog, New Relic, or self-hosted)

### Infrastructure Requirements

#### Docker Compose (Single Host)
- CPU: 4+ cores
- RAM: 16GB minimum
- Storage: 500GB SSD
- Network: 1Gbps connectivity

#### Kubernetes (Multi-node Production)
- Master nodes: 3 (minimum) with 2CPU, 4GB RAM
- Worker nodes: 3+ with 4CPU, 8GB RAM
- Storage: 500GB+ persistent volumes
- Network: Container networking (Flannel, Weave, Calico)

---

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/nextgen-marketplace.git
cd nextgen-marketplace
```

### 2. Create Environment Files

**Development:**
```bash
cp .env.example .env.local
```

**Production:**
```bash
cat > .env.production << 'EOF'
# Database
DB_USER=nextgen-prod
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE
DB_NAME=nextgen_marketplace_prod
DB_PORT=5432

# Redis
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD
REDIS_PORT=6379

# MinIO
MINIO_ROOT_USER=minioadmin-prod
MINIO_ROOT_PASSWORD=YOUR_STRONG_MINIO_PASSWORD
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_BUCKET=nextgen-uploads
MINIO_SERVER_URL=https://minio.your-domain.com
MINIO_BROWSER_URL=https://minio-console.your-domain.com

# API
API_PORT=3001
ALLOWED_ORIGINS=https://app.your-domain.com,https://admin.your-domain.com,https://vendor.your-domain.com

# JWT
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION=7d

# Logging
LOG_LEVEL=info
EOF
```

### 3. Build Docker Images

```bash
# Production build
docker build -f Dockerfile.prod -t nextgen-marketplace:latest .
docker tag nextgen-marketplace:latest your-registry/nextgen-marketplace:latest
docker push your-registry/nextgen-marketplace:latest
```

---

## Docker Compose Deployment

### 1. Start Services

```bash
# Load environment
export $(cat .env.production | xargs)

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Verify services
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 2. Initialize Database

```bash
# Wait for PostgreSQL to be ready
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U nextgen-prod

# Run Prisma migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Seed database (optional)
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

### 3. Verify Health

```bash
# Health check API
curl http://localhost:3001/api/v3/health

# Health check database
docker compose -f docker-compose.prod.yml exec postgres psql -U nextgen-prod -d nextgen_marketplace_prod -c "SELECT 1"

# Health check Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD ping

# Health check MinIO
curl http://localhost:9000/minio/health/live
```

---

## Kubernetes Deployment

### 1. Prerequisites

```bash
# Create namespace
kubectl create namespace nextgen-prod

# Create image pull secret (if using private registry)
kubectl create secret docker-registry regcred \
  --docker-server=your-registry.com \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PASSWORD \
  --docker-email=your-email@example.com \
  -n nextgen-prod
```

### 2. Create Storage Classes

```bash
kubectl apply -f - << 'EOF'
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: 3000
  throughput: 125
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: ebs.csi.aws.com
parameters:
  type: gp2
EOF
```

### 3. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/k8s-production.yaml

# Verify deployments
kubectl get deployments -n nextgen-prod
kubectl get pods -n nextgen-prod
kubectl get pvc -n nextgen-prod
```

### 4. Setup Ingress

```bash
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nextgen-ingress
  namespace: nextgen-prod
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.your-domain.com
      secretName: nextgen-tls
  rules:
    - host: api.your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nextgen-api
                port:
                  number: 80
EOF
```

### 5. Verify Kubernetes Deployment

```bash
# Check pod status
kubectl get pods -n nextgen-prod -w

# Check logs
kubectl logs -n nextgen-prod -l app=nextgen-api -f

# Check events
kubectl get events -n nextgen-prod --sort-by='.lastTimestamp'

# Verify database connectivity
kubectl exec -n nextgen-prod -it deployment/nextgen-api -- \
  psql postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME} -c "SELECT 1"
```

---

## Database Management

### Automatic Backups

```bash
# Make backup script executable
chmod +x scripts/backup-database.sh

# Manual backup
DB_HOST=localhost DB_USER=nextgen DB_NAME=nextgen_marketplace \
  DB_PASSWORD=your_password scripts/backup-database.sh

# Setup cron for daily backups at 2 AM
0 2 * * * /path/to/scripts/backup-database.sh >> /var/log/backups/cron.log 2>&1
```

### Point-in-Time Recovery

```bash
# Make recovery script executable
chmod +x scripts/recover-database.sh

# List available backups
ls -lh /backups/database/

# Recover from backup
scripts/recover-database.sh -f /backups/database/nextgen_marketplace_backup_2024-01-15.sql.gz -c -v
```

### Prisma Migrations

```bash
# Create migration
npx prisma migrate dev --name add_new_table

# Deploy migration to production
npx prisma migrate deploy

# Reset database (development only!)
npx prisma migrate reset --force
```

---

## Monitoring & Alerting

### Prometheus & Grafana Setup

```bash
# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Access Grafana
# URL: http://localhost:3000
# Default credentials: admin / admin
```

### Key Metrics to Monitor

1. **API Performance**
   - Request rate: `rate(http_requests_total[5m])`
   - Response time: `histogram_quantile(0.99, http_request_duration_seconds)`
   - Error rate: `rate(http_requests_total{status=~"5.."}[5m])`

2. **Database Health**
   - Connection count: `postgresql_connections`
   - Query time: `postgresql_query_duration_seconds`
   - Replication lag: `postgresql_replication_lag_seconds`

3. **Resource Utilization**
   - CPU: `rate(container_cpu_usage_seconds_total[5m])`
   - Memory: `container_memory_usage_bytes`
   - Disk: `node_filesystem_avail_bytes`

4. **Caching Performance**
   - Cache hit rate: `redis_keyspace_hits / (redis_keyspace_hits + redis_keyspace_misses)`
   - Memory usage: `redis_memory_used_bytes`

---

## Security Hardening

### 1. Enable SSL/TLS

```bash
# Generate SSL certificates
certbot certonly --standalone -d api.your-domain.com

# Update docker-compose with SSL certificates
volumes:
  - /etc/letsencrypt/live/api.your-domain.com:/etc/nginx/ssl:ro
```

### 2. Database Security

```sql
-- Create restricted user
CREATE ROLE app_user WITH LOGIN PASSWORD 'strong_password';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Revoke dangerous permissions
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
```

### 3. Network Security

```bash
# Restrict ingress traffic
docker network create --driver bridge \
  --opt com.docker.network.bridge.name=nextgen-br0 \
  --opt com.docker.driver.mtu=1450 \
  nextgen-secure

# Use firewall rules
ufw default deny incoming
ufw default allow outgoing
ufw allow 3001/tcp  # API port only
ufw allow 22/tcp    # SSH
ufw enable
```

### 4. Secrets Management

```bash
# Use Docker Secrets (Swarm mode)
echo "your_database_password" | docker secret create db_password -

# Or use environment files with restrictive permissions
chmod 600 .env.production
chown nextgen:nextgen .env.production
```

---

## Backup & Recovery

### S3 Integration for Cloud Backups

```bash
#!/bin/bash
# scripts/backup-to-s3.sh

BACKUP_DIR="/backups/database"
S3_BUCKET="s3://nextgen-backups"
BACKUP_FILE="${BACKUP_DIR}/nextgen_marketplace_backup_$(date +%Y-%m-%d_%H-%M-%S).sql.gz"

# Create backup
scripts/backup-database.sh

# Upload to S3
aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/" --sse AES256

# Keep local backup for 7 days, S3 for 90 days
```

### Disaster Recovery Plan

1. **RTO (Recovery Time Objective)**: 15 minutes
2. **RPO (Recovery Point Objective)**: 1 hour

**Recovery Procedure:**
```bash
# 1. Spin up new infrastructure
terraform apply -var="environment=production" -var="enable_backup_restore=true"

# 2. Restore latest backup
scripts/recover-database.sh -f s3://nextgen-backups/latest-backup.sql.gz

# 3. Verify data integrity
docker compose exec api npx prisma db seed --preview-features

# 4. Run smoke tests
docker compose exec api npm run test:integration

# 5. Promote to production
docker service update --image nextgen-marketplace:prod nextgen_api
```

---

## Scaling & Auto-recovery

### Horizontal Pod Autoscaling (Kubernetes)

```bash
# HPA already configured in k8s-production.yaml
# Monitor HPA status
kubectl get hpa -n nextgen-prod -w

# Manual scaling
kubectl scale deployment nextgen-api -n nextgen-prod --replicas=5
```

### Load Balancing

```yaml
# Kubernetes Service with LoadBalancer
apiVersion: v1
kind: Service
metadata:
  name: nextgen-api-lb
  namespace: nextgen-prod
spec:
  type: LoadBalancer
  selector:
    app: nextgen-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3001
```

### Health Checks & Auto-recovery

```bash
# Readiness probe ensures traffic only goes to healthy pods
curl -s http://localhost:3001/api/v3/health | jq '.status'

# Liveness probe automatically restarts failing pods
kubectl get pods -n nextgen-prod -o wide

# View pod restart count
kubectl get pods -n nextgen-prod --sort-by=.status.containerStatuses[0].restartCount
```

---

## Troubleshooting

### Common Issues

#### 1. API Pod Crashing

```bash
# Check logs
kubectl logs -n nextgen-prod -l app=nextgen-api -f

# Check events
kubectl describe pod -n nextgen-prod $(kubectl get pod -n nextgen-prod -l app=nextgen-api -o jsonpath='{.items[0].metadata.name}')

# Verify database connectivity
kubectl exec -it -n nextgen-prod deployment/nextgen-api -- \
  psql "$DATABASE_URL" -c "SELECT version()"
```

#### 2. Database Connection Issues

```bash
# Check PostgreSQL pod
kubectl get pod -n nextgen-prod -l app=postgres

# Check PostgreSQL logs
kubectl logs -n nextgen-prod deployment/postgres

# Test connection
docker exec nextgen-postgres-prod psql -U nextgen -d nextgen_marketplace -c "SELECT 1"
```

#### 3. Memory Leaks

```bash
# Monitor memory usage
docker stats nextgen-api

# Check for memory leaks in logs
docker logs nextgen-api | grep -i "memory\|heap"

# Restart pod
kubectl rollout restart deployment/nextgen-api -n nextgen-prod
```

#### 4. Disk Space Issues

```bash
# Check disk usage
docker system df

# Clean up unused data
docker system prune -a --volumes

# For Kubernetes
kubectl exec -n nextgen-prod deployment/postgres -- du -sh /var/lib/postgresql/data
```

### Debug Commands

```bash
# Docker Compose
docker compose -f docker-compose.prod.yml logs -f [service_name]
docker compose -f docker-compose.prod.yml exec [service] [command]

# Kubernetes
kubectl logs -n nextgen-prod -l app=[app_name] -f
kubectl exec -n nextgen-prod -it deployment/[name] -- bash
kubectl port-forward -n nextgen-prod svc/nextgen-api 3001:80
```

---

## Performance Optimization

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_vendor_id ON products(vendor_id);

-- Enable query optimization
ANALYZE;

-- Monitor query performance
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 'xxx';
```

### Caching Strategy

- Session cache: Redis (TTL: 1 hour)
- Query cache: Redis (TTL: 5 minutes)
- Static assets: CDN (TTL: 24 hours)

### Connection Pool

```typescript
// .env.production
DATABASE_CONNECTION_LIMIT=20
REDIS_CONNECTION_LIMIT=50
```

---

## Maintenance Tasks

### Weekly
- Review logs for errors
- Check backup completion
- Verify monitoring alerts

### Monthly
- Run security scan: `docker scan nextgen-marketplace:latest`
- Update dependencies: `pnpm update`
- Review database statistics: `ANALYZE;`

### Quarterly
- Disaster recovery drill
- Security audit
- Performance optimization review
- Cost analysis

---

## Support & Escalation

**On-Call Support:**
- Page: PagerDuty integration
- Chat: Slack integration
- Email: ops-team@your-domain.com

**Escalation Path:**
1. Level 1: On-call engineer
2. Level 2: Senior SRE
3. Level 3: Architecture team

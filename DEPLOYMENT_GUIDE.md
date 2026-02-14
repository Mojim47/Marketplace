# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace 2026 - COMPREHENSIVE DEPLOYMENT GUIDE
# ═══════════════════════════════════════════════════════════════════════════
# Enterprise Production Deployment with Zero-Downtime & Disaster Recovery

## TABLE OF CONTENTS

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Local Development Setup](#local-development-setup)
3. [Staging Deployment](#staging-deployment)
4. [Production Deployment](#production-deployment)
5. [Database Migrations](#database-migrations)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Disaster Recovery](#backup--disaster-recovery)
8. [Scaling & Performance](#scaling--performance)
9. [Troubleshooting](#troubleshooting)
10. [Security Hardening](#security-hardening)

---

## PRE-DEPLOYMENT CHECKLIST

### 1. System Requirements

```bash
# Minimum Hardware (Single Host)
- CPU: 8 cores
- RAM: 16GB
- Storage: 500GB SSD
- Network: 1Gbps

# Recommended (Production)
- CPU: 16 cores
- RAM: 32GB
- Storage: 2TB SSD (RAID-6)
- Network: 10Gbps
- Backup Storage: 5TB
```

### 2. Software Prerequisites

```bash
# Check Docker version
docker --version  # >= 24.0
docker-compose --version  # >= 2.20

# Check system
uname -a
lsb_release -a  # Ubuntu/Debian
cat /etc/os-release  # Any Linux

# Kernel requirements
uname -r  # >= 5.10

# Available disk space
df -h /

# Network connectivity
ping -c 1 8.8.8.8
curl -I https://registry.npmjs.org/
```

### 3. Security Audit

```bash
# Run security check
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image nextgen-api:latest
```

### 4. Environment Validation

```bash
# Copy and validate .env file
cp .env.production .env
grep "change_me_" .env  # Should return NOTHING - all secrets must be set
wc -l .env  # Should have all required variables
```

---

## LOCAL DEVELOPMENT SETUP

### 1. Initialize Local Environment

```bash
# 1. Create data directory
mkdir -p /data/{postgres,redis,minio}
chmod 700 /data

# 2. Copy environment files
cp .env.example .env.local
cp docker-compose.yml docker-compose.dev.yml

# 3. Start services (development)
docker-compose -f docker-compose.yml up -d

# 4. Wait for services to be healthy
docker-compose ps
docker-compose logs -f postgres
```

### 2. Run Database Migrations

```bash
# Connect to running container
docker-compose exec api bash

# Inside container:
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm exec prisma studio  # Open at http://localhost:5555
```

### 3. Verify Local Setup

```bash
# Check API health
curl -s http://localhost:3001/health | jq '.'

# Check Web health
curl -s http://localhost:3000/api/health

# Check Admin health
curl -s http://localhost:3003/api/health

# Check MinIO
curl -s http://localhost:9001/minio/health/live

# View logs
docker-compose logs -f api
docker-compose logs -f postgres
```

---

## STAGING DEPLOYMENT

### 1. Pre-Staging Setup

```bash
# On staging server:
ssh staging.example.com

# 1. System update
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y docker.io docker-compose curl wget git htop

# 2. Create deployment user
sudo useradd -m -s /bin/bash deployer
sudo usermod -aG docker deployer

# 3. Create application directory
sudo mkdir -p /opt/nextgen
sudo chown deployer:deployer /opt/nextgen
cd /opt/nextgen
```

### 2. Clone & Configure

```bash
# As deployer user
git clone https://github.com/nextgen/marketplace.git .
git checkout main

# Configure environment
cp .env.production .env

# Edit secrets (use secure method - Vault/1Password recommended)
nano .env

# Validate configuration
./scripts/validate-config.sh
```

### 3. Pre-deployment Checks

```bash
# Run security audit
docker-compose -f docker-compose.prod.yml config
docker image ls nextgen-*

# Build images if needed
docker-compose -f docker-compose.prod.yml build --pull

# Validate database URL
echo $DATABASE_URL | grep -q "sslmode=require" && echo "SSL enabled" || echo "SSL NOT enabled!"
```

### 4. Deploy to Staging

```bash
# Backup current deployment (if exists)
docker-compose -f docker-compose.prod.yml down -v --remove-orphans || true
sudo cp -r /data /data.backup.$(date +%s)

# Start new deployment
docker-compose -f docker-compose.prod.yml up -d

# Monitor startup
watch -n 2 docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f

# Wait for migrations
sleep 30
docker-compose -f docker-compose.prod.yml logs migrate
```

### 5. Post-deployment Validation

```bash
# Health checks
curl -f http://localhost:3001/health || echo "API unhealthy"
curl -f http://localhost:3000/api/health || echo "Web unhealthy"
curl -f http://localhost:3003/api/health || echo "Admin unhealthy"

# Database verification
docker-compose -f docker-compose.prod.yml exec postgres psql -U nextgen -d nextgen_marketplace -c "SELECT COUNT(*) FROM users;"

# Cache verification
docker-compose -f docker-compose.prod.yml exec redis redis-cli PING

# Storage verification
curl -u admin:password http://localhost:9001/minio/health/live
```

### 6. Smoke Testing

```bash
# Run quick test suite
docker run --network nextgen-network \
  -e API_URL=http://api:3001 \
  nextgen/tests:latest npm run test:smoke

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=100 api | grep -i error
```

---

## PRODUCTION DEPLOYMENT

### 1. Pre-Production Snapshot

```bash
# Create full backup before production deploy
./scripts/backup-database.sh
./scripts/backup-storage.sh

# Verify backups
ls -lah /backups/
md5sum /backups/* > /backups/checksums.md5
```

### 2. Production Server Setup

```bash
# On production server (with load balancer)
ssh prod-1.example.com

# 1. Enhanced security hardening
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y docker.io docker-compose ufw fail2ban auditd

# 2. Firewall configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP
sudo ufw allow 443/tcp       # HTTPS
sudo ufw allow 3001/tcp      # API (internal)
sudo ufw enable

# 3. Fail2ban setup
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 4. SSL/TLS certificates
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot certonly --standalone -d api.marketplace.example.com -d marketplace.example.com
```

### 3. Production Deployment

```bash
# Deploy with blue-green strategy
git clone https://github.com/nextgen/marketplace.git /opt/nextgen-blue
cd /opt/nextgen-blue
git checkout v2026.1.0  # Use version tag

# Configure production environment
cp .env.production .env

# Edit critical secrets
# Use: Vault, AWS Secrets Manager, or 1Password
./scripts/load-secrets-from-vault.sh

# Build with cache optimization
docker-compose -f docker-compose.prod.yml build --parallel

# Pre-warm Docker layer cache
docker pull nextgen-api:latest || true
docker pull nextgen-web:latest || true

# Start blue environment
export COMPOSE_PROJECT_NAME=nextgen_blue
docker-compose -f docker-compose.prod.yml up -d

# Verify blue is healthy
sleep 30
docker-compose -f docker-compose.prod.yml ps
curl -f http://localhost:3001/health
```

### 4. Switch from Green to Blue (Zero-Downtime)

```bash
# 1. Health check blue
curl -f http://localhost:3001/health || exit 1

# 2. Update load balancer to route to blue
# (Update nginx/HAProxy upstream)

# 3. Monitor traffic
watch -n 1 'docker stats --no-stream'

# 4. If all good, remove green
export COMPOSE_PROJECT_NAME=nextgen_green
docker-compose -f docker-compose.prod.yml down -v

# 5. Set blue as current
rm -rf /opt/nextgen-green || true
mv /opt/nextgen-blue /opt/nextgen
```

### 5. Post-Production Verification

```bash
# Full health check suite
./scripts/health-check.sh

# Verify all services
docker-compose -f docker-compose.prod.yml ps

# Check application logs
docker-compose -f docker-compose.prod.yml logs --since 2m api | tail -50

# Monitor resources
docker stats --no-stream

# Test critical flows
curl -X POST http://localhost:3001/api/v3/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Verify database integrity
docker-compose -f docker-compose.prod.yml exec postgres psql -U nextgen -d nextgen_marketplace << EOF
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
SELECT COUNT(*) FROM users;
EOF
```

---

## DATABASE MIGRATIONS

### 1. Safe Migration Process

```bash
# 1. Backup database before any migration
./scripts/backup-database.sh

# 2. Test migrations on staging first
docker-compose -f docker-compose.prod.yml exec api pnpm exec prisma migrate deploy --schema=./prisma/schema.prisma --skip-engine

# 3. Review Prisma history
docker-compose -f docker-compose.prod.yml exec api pnpm exec prisma migrate status

# 4. Apply production migrations
# (Use migrate container in docker-compose.prod.yml)
docker-compose -f docker-compose.prod.yml run --rm migrate

# 5. Verify schema
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U nextgen nextgen_marketplace | grep "CREATE TABLE" | wc -l
```

### 2. Rollback Procedure

```bash
# If migration fails:

# 1. Restore from backup
./scripts/restore-database.sh /backups/database.sql

# 2. Redeploy previous version
git checkout v2026.0.9
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# 3. Investigate issue
docker-compose logs migrate | tail -100
```

---

## MONITORING & LOGGING

### 1. Enable Monitoring Stack

```bash
# Start Prometheus + Grafana
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana
# http://localhost:3000 (admin:admin)

# Import dashboards
# - Prometheus Dashboard
# - Docker Container Stats
# - PostgreSQL Monitoring
# - Application Metrics
```

### 2. Configure Alerting

```bash
# Update AlertManager config
docker-compose -f docker-compose.monitoring.yml exec alertmanager \
  cat /etc/alertmanager/config.yml

# Test alert
docker-compose -f docker-compose.monitoring.yml exec prometheus \
  amtool alert
```

### 3. Centralized Logging

```bash
# Option 1: ELK Stack
docker-compose -f docker-compose.elk.yml up -d

# Option 2: CloudWatch (AWS)
docker-compose config | grep -i log

# Option 3: Datadog/New Relic
# Add APM agent to Dockerfile
```

---

## BACKUP & DISASTER RECOVERY

### 1. Automated Backups

```bash
# 1. Database backup script
./scripts/backup-database.sh

# 2. Storage backup script
./scripts/backup-storage.sh

# 3. Schedule with cron
crontab -e
# Add: 0 2 * * * /opt/nextgen/scripts/backup-all.sh

# 4. Verify backups
./scripts/verify-backups.sh
ls -lah /backups/
```

### 2. Recovery Procedures

```bash
# Restore database
./scripts/restore-database.sh /backups/database-2024-01-15.sql

# Restore storage
./scripts/restore-storage.sh /backups/minio-2024-01-15.tar.gz

# Verify recovery
curl -f http://localhost:3001/health
```

### 3. Disaster Recovery Plan

```
RTO (Recovery Time Objective): 15 minutes
RPO (Recovery Point Objective): 1 hour

1. Database: PostgreSQL with WAL archiving to S3
2. Storage: MinIO with cross-region replication
3. Configuration: GitOps via version control
4. Secrets: Vault with HA setup

Quick Recovery:
1. Launch new infrastructure from IaC (Terraform)
2. Restore database from latest backup
3. Restore storage from replication
4. Deploy application
5. Verify and switch traffic
```

---

## SCALING & PERFORMANCE

### 1. Horizontal Scaling (Multiple Servers)

```bash
# Docker Swarm setup (for 2-5 nodes)
docker swarm init
docker node ls

# Deploy stack
docker stack deploy -c docker-compose.prod.yml nextgen

# Scale services
docker service scale nextgen_api=5
docker service ps nextgen_api

# Monitor swarm
docker stats
```

### 2. Kubernetes Deployment (Enterprise)

```bash
# Deploy to K8s
kubectl apply -f k8s/k8s-api.yaml

# Verify deployment
kubectl get pods -n nextgen
kubectl get svc -n nextgen
kubectl logs -n nextgen deployment/nextgen-api

# Scale with HPA
kubectl get hpa -n nextgen
kubectl describe hpa nextgen-api-hpa
```

### 3. Performance Tuning

```bash
# Database optimization
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U nextgen -d nextgen_marketplace << EOF
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
ANALYZE;
EOF

# Redis optimization
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli CONFIG SET maxmemory-policy allkeys-lru

# API optimization
# Set NODE_OPTIONS=--max-old-space-size=2048
```

---

## TROUBLESHOOTING

### Common Issues

#### 1. Postgres Connection Failed

```bash
# Check if service is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check logs
docker-compose -f docker-compose.prod.yml logs postgres

# Verify connection string
echo $DATABASE_URL

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U nextgen -c "SELECT 1;"
```

#### 2. Out of Memory

```bash
# Check memory usage
docker stats --no-stream

# Increase limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

#### 3. High CPU Usage

```bash
# Identify CPU hog
docker top <container_id>

# Check slow queries
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U nextgen -c "SELECT query FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;"
```

#### 4. Disk Space Issues

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes

# Rotate logs
docker-compose -f docker-compose.prod.yml logs --tail 1000 > /archive/logs.txt
```

---

## SECURITY HARDENING

### 1. Environment Security

```bash
# File permissions
chmod 600 .env
chmod 700 /data

# Secret rotation
# Rotate every 90 days:
./scripts/rotate-secrets.sh

# Audit logs
sudo tail -f /var/log/audit/audit.log
```

### 2. Network Security

```bash
# Firewall rules (ufw)
sudo ufw allow from 10.0.0.0/8 to any port 3001

# Network policies (Kubernetes)
kubectl apply -f k8s/network-policy.yaml

# SSL/TLS enforcement
# All connections use TLS 1.3+
```

### 3. Container Security

```bash
# Scan images
docker scan nextgen-api:latest

# Non-root user (already configured)
docker inspect nextgen-api:latest | grep User

# Read-only filesystem
docker run --read-only nextgen-api:latest
```

---

## MONITORING DASHBOARD

Access monitoring URLs:
- **Grafana**: https://monitoring.example.com:3000
- **Prometheus**: https://monitoring.example.com:9090
- **AlertManager**: https://monitoring.example.com:9093
- **Jaeger (Tracing)**: https://monitoring.example.com:16686

---

## SUPPORT & ESCALATION

**24/7 Incident Response**: ops@marketplace.example.com
**Critical Issues**: +1-800-NEXTGEN-911
**Status Page**: https://status.marketplace.example.com

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 2026.1.0 | 2024-01-15 | Initial production release |

---

**Last Updated**: 2024-01-15  
**Author**: DevOps Team  
**Document Version**: 1.0  

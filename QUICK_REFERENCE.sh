#!/usr/bin/env bash

# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace 2026 - QUICK REFERENCE & CHEAT SHEET
# ═══════════════════════════════════════════════════════════════════════════

cat << 'EOF'

╔═══════════════════════════════════════════════════════════════════════════╗
║                 NEXTGEN MARKETPLACE 2026 - QUICK REFERENCE                ║
║                    Enterprise Production Deployment                       ║
╚═══════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📋 QUICK START COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 DEVELOPMENT
  $ docker-compose up -d                    # Start all services
  $ docker-compose logs -f api              # Watch API logs
  $ docker-compose ps                       # Check status

 STAGING
  $ docker-compose -f docker-compose.prod.yml up -d
  $ ./scripts/health-check.sh                # Verify deployment
  $ docker-compose -f docker-compose.prod.yml logs -f

 PRODUCTION
  $ ./scripts/backup-all.sh --upload-s3     # Backup before deploy
  $ docker-compose -f docker-compose.prod.yml up -d
  $ ./scripts/health-check.sh                # Full verification
  $ kubectl apply -f k8s/k8s-api.yaml       # Deploy to Kubernetes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🔧 SERVICE MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 START
  $ docker-compose up -d

 STOP
  $ docker-compose down

 RESTART SPECIFIC SERVICE
  $ docker-compose restart api              # Restart API only
  $ docker-compose restart postgres         # Restart database

 VIEW LOGS
  $ docker-compose logs api                 # Current API logs
  $ docker-compose logs -f api              # Follow API logs
  $ docker-compose logs --tail=100 postgres # Last 100 lines

 EXECUTE COMMAND
  $ docker-compose exec api bash            # SSH into API container
  $ docker-compose exec postgres psql       # Access PostgreSQL CLI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🩺 HEALTH & MONITORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 COMPREHENSIVE HEALTH CHECK
  $ ./scripts/health-check.sh                # Full system audit

 QUICK STATUS
  $ docker-compose ps                       # Container status
  $ docker stats                            # Real-time resource usage

 SERVICE HEALTH ENDPOINTS
  $ curl http://localhost:3001/livez        # API health
  $ curl http://localhost:3000/api/health   # Web health
  $ curl http://localhost:3003/api/health   # Admin health

 DATABASE CHECK
  $ docker-compose exec postgres pg_isready

 CACHE CHECK
  $ docker-compose exec redis redis-cli PING

 STORAGE CHECK
  $ curl -f http://localhost:9000/minio/health/live

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 💾 BACKUP & RECOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 CREATE BACKUP
  $ ./scripts/backup-all.sh                 # Local backup
  $ ./scripts/backup-all.sh --upload-s3     # Backup + S3 upload

 LIST BACKUPS
  $ ls -lah /backups/

 VERIFY BACKUP INTEGRITY
  $ gunzip -t /backups/nextgen_backup_*/database.sql.gz

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🗄️ DATABASE OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 MIGRATIONS
  $ docker-compose exec api pnpm exec prisma migrate dev
  $ docker-compose exec api pnpm exec prisma migrate deploy

 DATABASE SHELL
  $ docker-compose exec postgres psql -U nextgen -d nextgen_marketplace

 VIEW SCHEMA
  $ docker-compose exec postgres psql -U nextgen -d nextgen_marketplace << EOF
    SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    EOF

 DATABASE BACKUP
  $ docker-compose exec postgres pg_dump -U nextgen > backup.sql

 SEED DATA
  $ docker-compose exec api pnpm exec prisma db seed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🔐 SECURITY & SECRETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 GENERATE RANDOM SECRET (32 chars)
  $ openssl rand -base64 32

 CHECK ENVIRONMENT SECRETS
  $ grep "change_me_" .env.production || echo "✓ All secrets configured"

 ROTATE JWT SECRETS
  $ ./scripts/rotate-secrets.sh

 VIEW SECRETS (PROD - RESTRICTED)
  $ cat .env.production | grep -E "SECRET|PASSWORD" | head -10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🚀 DEPLOYMENT STRATEGIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 BLUE-GREEN DEPLOYMENT
  # Blue environment (currently running)
  $ export COMPOSE_PROJECT_NAME=nextgen_blue
  $ docker-compose -f docker-compose.prod.yml up -d

  # Test blue health
  $ ./scripts/health-check.sh

  # Switch traffic to blue (update load balancer)
  # Remove green environment
  $ export COMPOSE_PROJECT_NAME=nextgen_green
  $ docker-compose -f docker-compose.prod.yml down

 CANARY DEPLOYMENT (Kubernetes)
  $ kubectl apply -f k8s/k8s-api.yaml
  $ kubectl set image deployment/nextgen-api nextgen-api=nextgen-api:new-tag
  $ kubectl rollout status deployment/nextgen-api

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📊 MONITORING & DASHBOARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 START MONITORING STACK
  $ docker-compose -f docker-compose.monitoring.yml up -d

 ACCESS DASHBOARDS
  Grafana:       http://localhost:3000       (admin:admin)
  Prometheus:    http://localhost:9090
  AlertManager:  http://localhost:9093
  Jaeger:        http://localhost:16686

 REAL-TIME METRICS
  $ docker stats --no-stream

 SERVICE METRICS
  $ curl http://localhost:9090/api/v1/query?query=up

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🛠️ TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 CHECK ALL LOGS
  $ docker-compose -f docker-compose.prod.yml logs --since 1h -f

 DATABASE CONNECTION ISSUES
  $ docker-compose exec postgres psql -U nextgen -c "SELECT 1;"

 OUT OF MEMORY
  $ docker stats --no-stream | grep "docker-compose"
  $ docker system prune -a --volumes  # Clean up

 DISK SPACE ISSUES
  $ df -h /
  $ docker system df

 NETWORK ISSUES
  $ docker network ls
  $ docker network inspect nextgen-network

 CONTAINER LOGS (DETAILED)
  $ docker logs -f <container_id>
  $ docker inspect <container_id>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📚 KUBERNETES OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 DEPLOY
  $ kubectl apply -f k8s/k8s-api.yaml

 CHECK PODS
  $ kubectl get pods -n nextgen
  $ kubectl get pods -n nextgen -w                # Watch

 VIEW LOGS
  $ kubectl logs -n nextgen deployment/nextgen-api
  $ kubectl logs -n nextgen deployment/nextgen-api -f

 SCALE
  $ kubectl scale deployment nextgen-api -n nextgen --replicas=5

 RESTART
  $ kubectl rollout restart deployment/nextgen-api -n nextgen

 DELETE
  $ kubectl delete -f k8s/k8s-api.yaml

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📁 IMPORTANT FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 DEPLOYMENT GUIDE        ./DEPLOYMENT_GUIDE.md
 SECURITY CHECKLIST      ./SECURITY_CHECKLIST.md
 PRODUCTION REPORT       ./PRODUCTION_READY_REPORT.md

 DOCKER FILES
  Dockerfile              ./Dockerfile              (Multi-stage)
  docker-compose.yml      ./docker-compose.yml      (Development)
  docker-compose.prod.yml ./docker-compose.prod.yml (Production)

 CONFIGURATION
  .env.production         All production secrets

 KUBERNETES
  k8s-api.yaml            ./k8s/k8s-api.yaml        (Full manifests)

 SCRIPTS
  backup-all.sh           ./scripts/backup-all.sh
  health-check.sh         ./scripts/health-check.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🆘 INCIDENT RESPONSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 CRITICAL ISSUE - IMMEDIATE STEPS
  1. Check health:        ./scripts/health-check.sh
  2. View recent logs:    docker-compose logs --since 5m
  3. Restart services:    docker-compose restart
  4. Check resources:     docker stats
  5. Review errors:       docker-compose logs | grep ERROR

 SERVICE DOWN - ROLLBACK
  1. Stop current:        docker-compose down
  2. Restore backup:      ./scripts/restore-database.sh /backups/backup.sql
  3. Deploy previous:     git checkout v2026.0.9
  4. Restart:             docker-compose up -d
  5. Verify:              ./scripts/health-check.sh

 SECURITY BREACH SUSPECTED
  1. Isolate service:     docker-compose pause api
  2. Preserve logs:       tar czf /backups/logs-$(date +%s).tar.gz logs/
  3. Review audit log:    docker-compose exec postgres psql...
  4. Contact security:    security@marketplace.example.com
  5. Run scan:            docker scan nextgen-api:latest

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📞 SUPPORT CONTACTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 DevOps Lead        devops@marketplace.example.com  (24/7)
 Security Team      security@marketplace.example.com (24/7)
 Operations         ops@marketplace.example.com      (Business hrs)
 Emergency:         +98-21-INCIDENT-HOTLINE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅ PRODUCTION STATUS VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALWAYS RUN BEFORE DEPLOYMENT:
  ✓ grep -v "change_me_" .env.production > /dev/null
  ✓ ./scripts/health-check.sh
  ✓ docker scan nextgen-api:latest | grep -i "critical" || echo "Safe"
  ✓ ./scripts/backup-all.sh
  ✓ docker-compose -f docker-compose.prod.yml config | grep -v "x-"

╔═══════════════════════════════════════════════════════════════════════════╗
║  FOR DETAILED DOCUMENTATION, SEE:                                         ║
║  - DEPLOYMENT_GUIDE.md      (Complete deployment procedures)              ║
║  - PRODUCTION_READY_REPORT.md (Final audit & readiness status)            ║
║  - SECURITY_CHECKLIST.md    (Security controls & compliance)              ║
╚═══════════════════════════════════════════════════════════════════════════╝

EOF

# 🚀 Enterprise Deployment Runbook

## Quick Reference

```
DEV:     Auto-deploy on develop push     (~5 min)
STAGING: Manual review + Blue-Green      (~10 min)
PROD:    Tagged release + Canary + Gradual (~20 min)
```

## Pre-Deployment Checklist

```yaml
48 Hours Before Release:
  ☐ Create release issue: "Release v1.0.0"
  ☐ Review changelog
  ☐ Notify stakeholders
  ☐ Schedule maintenance window (if needed)
  ☐ Test rollback procedure (dry run)

24 Hours Before Release:
  ☐ Verify all tests passing on main
  ☐ Load test: 10,000 req/s (must pass)
  ☐ Security scan: 0 high/critical (must pass)
  ☐ Database migration test (dry run)
  ☐ Backup production database

4 Hours Before Release:
  ☐ Final code review
  ☐ Release notes finalized
  ☐ Notify support team
  ☐ Update status page (scheduled maintenance)
  ☐ Page on-call engineers

30 Minutes Before Release:
  ☐ Verify all approvals received
  ☐ Production environment healthy
  ☐ Database connections < 15/20
  ☐ CPU/Memory < 60% baseline
  ☐ Team in Slack #nextgen-devops
```

---

## Deployment Scenarios

### Scenario 1: Feature Deploy to Dev

**Trigger**: Push to `develop` branch  
**Duration**: 5 minutes  
**Rollback**: Manual only

#### Step 1: Code Push & Pipeline Trigger

```bash
# Make feature ready
git add .
git commit -m "feat(invoice): add new feature"
git push origin feature-branch

# Create PR to develop
# GitHub Action ci-cd-enterprise.yml starts automatically
```

**Status**: ✅ CI/CD triggered on `develop` push

#### Step 2: Lint, Test, Security, Build

```
Lint:     ESLint + TypeScript ✓
Test:     Unit + Integration ✓
Security: Trivy + npm audit ✓
Build:    Docker image pushed to GHCR ✓
```

**Status**: ✅ All checks passing

#### Step 3: Automatic Deploy to Dev

```yaml
Deployment:
  Environment: Development
  Instance: aci-dev-nextgen
  Image: ghcr.io/nextgen-market/nextgen-market:develop-{git-sha}
  Replicas: 1
  CPU: 1 core
  Memory: 1 GB
  Database: dev_nextgen (isolated)
  Redis: redis-dev
```

**Status**: ✅ Container running

#### Step 4: Smoke Test

```bash
# GitHub Actions automatically runs
curl -f https://dev-api.nextgen.local/health || exit 1
curl -f https://dev-api.nextgen.local/api/invoices || exit 1

# Expected response: 200 OK
```

**Status**: ✅ Smoke tests passed

#### Step 5: Notification

```
Slack Channel: #nextgen-devops
Message: ✅ Dev deployment complete
  Version: develop-a1b2c3d
  Duration: 5 minutes
  Status: HEALTHY
  Health: /health → 200 OK
  Logs: [Workflow Link]
```

**Status**: ✅ Deployment complete

#### Troubleshooting Dev Deployment

```yaml
Issue: Build failed (Lint error)
Solution:
  1. Review GitHub Actions log
  2. Fix ESLint/TypeScript error locally
  3. Push fix to develop
  4. Retry automatic

Issue: Smoke test failed
Solution:
  1. SSH to dev instance
     az container exec -g dev-nextgen -n aci-dev-nextgen --exec-command bash
  2. Check logs: tail -f /var/log/app.log
  3. Check health: curl http://localhost:3000/health
  4. Manual rollback: az container delete -g dev-nextgen -n aci-dev-nextgen

Issue: Out of memory
Solution:
  1. Check container memory: az container show -g dev-nextgen -n aci-dev-nextgen
  2. Scale up: CPU 2, Memory 2GB
  3. Restart deployment
```

---

### Scenario 2: Release to Staging

**Trigger**: Merge to `main` branch (after PR approval)  
**Duration**: 10 minutes  
**Strategy**: Blue-Green  
**Rollback**: Automatic on health check failure

#### Step 1: Create and Approve PR

```bash
# Feature branch → main
git checkout -b feature/invoice-v1
git commit -m "feat(invoice): new feature"
git push origin feature/invoice-v1

# Create PR via GitHub UI
# Requires:
#   ✅ Lint passing
#   ✅ Tests passing (coverage > 80%)
#   ✅ Security audit passing
#   ✅ Code owner approval (@nextgen-market/core-team)
#   ✅ 1 approval from team member
```

**Status**: ✅ PR created, waiting for reviews

#### Step 2: Review & Merge

```
Reviewer 1: Code review
  ├─ Check logic correctness
  ├─ Check for security issues
  ├─ Check database migrations
  └─ Approve PR

Reviewer 2 (Code Owner): Final approval
  ├─ Verify domain consistency
  ├─ Check against architecture guidelines
  └─ Approve for merge

Merge: Squash and merge to main
  Commit message: feat(invoice): add new feature (#123)
```

**Status**: ✅ PR merged to main

#### Step 3: Pipeline Trigger

```
GitHub Actions triggers ci-cd-enterprise.yml:
├─ Lint (ESLint, TypeScript) ✓
├─ Test (Unit + Integration + PostgreSQL/Redis) ✓
├─ Security (Trivy, npm audit) ✓
├─ Build (Docker image) ✓
└─ Deploy-Staging (Blue-Green)
```

**Status**: ✅ Build complete, deploying to staging

#### Step 4: Blue-Green Deployment

```
CURRENT STATE:
  Blue  (stable): ghcr.io/nextgen-market/nextgen-market:v0.9.5
  │
  └─→ Load Balancer → Users (100% traffic to Blue)

DEPLOYMENT STARTS:
  Deploy Green (new): ghcr.io/nextgen-market/nextgen-market:main-a1b2c3d
  │
  ├─ Health check: GET /health
  │  Loop (30 retries × 10 seconds = 5 minutes)
  │  └─ If all pass: Continue to traffic switch
  │  └─ If fail: Delete Green, keep Blue (zero downtime)
```

**Status**: ✅ Green instance deployed & healthy

#### Step 5: Traffic Switch

```
BEFORE:
  Load Balancer
    └─ 100% → Blue (aci-staging-blue)

DURING (1 second):
  Traffic Manager instant switch
    └─ 100% → Green (aci-staging-green)

AFTER:
  Load Balancer
    └─ 100% → Green (aci-staging-green)

Verification:
  ✅ Green instance receiving requests
  ✅ No connection errors
  ✅ Response times normal
```

**Status**: ✅ Traffic switched to Green

#### Step 6: Decommission Blue

```
Decision Gate: Wait 30 minutes
  ├─ Monitor error rates (target: 0%)
  ├─ Monitor latency (target: < 100ms)
  ├─ Monitor business metrics
  └─ If issues: Instant rollback to Blue

Actions (after 30 minutes):
  1. Verify Green stable
  2. Delete Blue instance
  3. Green becomes new "stable"
  4. Mark release as stable
```

**Status**: ✅ Blue decommissioned, Green stable

#### Step 7: Smoke Tests

```bash
# Comprehensive staging smoke tests
curl -f https://staging-api.nextgen.local/health
curl -f https://staging-api.nextgen.local/api/invoices
curl -f https://staging-api.nextgen.local/api/payments
curl -f https://staging-api.nextgen.local/api/health/db

# All should return 200 OK
```

**Status**: ✅ All smoke tests passed

#### Step 8: Notification

```
Slack Channel: #nextgen-devops
Message:
  ✅ Staging deployment complete (Blue-Green)
  Branch: main
  Commit: a1b2c3d
  Previous: aci-staging-blue (v0.9.5)
  Current:  aci-staging-green (main-a1b2c3d)
  Duration: 10 minutes
  Status: HEALTHY
  Logs: [Workflow Link]
  Ready for production approval? Comment: /ready-for-prod
```

**Status**: ✅ Deployment complete

#### Troubleshooting Staging Deployment

```yaml
Issue: Green health checks failing
Solution:
  1. Check Green logs: az container logs -g staging-nextgen -n aci-staging-green
  2. Common issues:
     - Database migration failed: Check pg_upgrade logs
     - Redis connection: Check Redis service status
     - Environment variables: Verify STAGING_* secrets
  3. Actions:
     - Delete Green automatically (keeping Blue)
     - Investigate issue locally
     - Fix code/database
     - Retry deployment

Issue: Traffic not switching to Green
Solution:
  1. Check Load Balancer status
  2. Verify Green instance IP
  3. Check firewall rules (NSG)
  4. Manual traffic switch (if automated fails)
  5. If still failing: Rollback to Blue

Issue: Rollback needed after traffic switch
Solution:
  1. Instant action: Switch traffic back to Blue
     az traffic-manager endpoint update \
       --resource-group staging-nextgen \
       --profile-name tm-staging \
       --name blue-endpoint \
       --type azureEndpoints \
       --endpoint-status Enabled
  2. Delete Green: az container delete -g staging-nextgen -n aci-staging-green
  3. Post-incident analysis
```

---

### Scenario 3: Production Release

**Trigger**: Create & push Git tag `v1.0.0`  
**Duration**: 20 minutes (5 canary + 10 gradual + 5 stabilization)  
**Strategy**: Canary + Gradual Promotion  
**Rollback**: Automatic on canary error >1%, or manual via workflow dispatch

#### Pre-Production Checklist

```yaml
Staging Verification (Must complete):
  ☐ Feature tested in staging for 24 hours
  ☐ No critical issues reported
  ☐ Performance acceptable (p99 < 500ms)
  ☐ Database migrations validated
  ☐ Backward-compatible API changes

Production Window:
  ☐ Off-peak time (target: 2am - 6am UTC)
  ☐ Low traffic expected
  ☐ Support team notified
  ☐ On-call engineers paged
  ☐ Status page notification queued

Approvals:
  ☐ Release manager approved
  ☐ Tech lead approved
  ☐ Operations lead approved
```

#### Step 1: Create Release Tag

```bash
# In your local repo, make sure main is up to date
git fetch origin main
git checkout main
git pull origin main

# Update version in package.json
npm version minor  # or major, patch
# This creates tag automatically

# Or manually:
git tag -a v1.0.0 -m "Release v1.0.0: Invoice DDD + Resiliency"
git push origin v1.0.0

# Verify tag pushed
git ls-remote --tags origin | grep v1.0.0
```

**Status**: ✅ Tag v1.0.0 created & pushed

#### Step 2: CI/CD Pipeline

```
GitHub Actions triggers on tag:

├─ Lint      ✓ (ESLint, TypeScript)
├─ Test      ✓ (Unit + Integration)
├─ Security  ✓ (Trivy, npm audit)
├─ Build     ✓ (Docker with version tag)
│   Docker image: ghcr.io/nextgen-market/nextgen-market:v1.0.0
├─ Deploy-Staging (if on main) ⊘ (skip on tags)
└─ Deploy-Prod (Canary deployment)
```

**Status**: ✅ All checks passing, starting canary

#### Step 3: Canary Deployment (0-5 minutes)

```
ARCHITECTURE:
  Stable Instances (3):
    ├─ prod-stable-1: v0.9.5 (50% traffic)
    ├─ prod-stable-2: v0.9.5 (50% traffic)
    └─ prod-stable-3: v0.9.5 (backup)
  
  Canary Instance (1):
    └─ prod-canary-1: v1.0.0 (5% traffic)

TRAFFIC SPLIT:
  Load Balancer
    ├─ 95% → Stable (v0.9.5)
    └─ 5%  → Canary (v1.0.0)

MONITORING (Every 10 seconds):
  Error Rate:     < 1.0% (baseline: 0.05%)
  Latency p99:    < 2000ms (baseline: 500ms)
  Database Pool:  < 18/20 connections
  CPU Usage:      < 90%
  Memory Usage:   < 90%
```

**Timeline**:
```
00:00 - Canary deployment starts
00:30 - First metrics collected
01:00 - Health checks normal
02:00 - Business metrics normal
03:00 - Latency stable
04:00 - Error rate normal
05:00 - Canary phase complete
```

**Monitoring Commands**:
```bash
# Watch error rate (Prometheus)
curl -s 'http://prometheus:9090/api/v1/query?query=rate(requests_total{job="prod"}[5m])' | jq

# Check canary health
az container show -g prod-nextgen -n prod-canary-1 --query instanceView.state
curl -f https://prod-api.nextgen.local/health

# Check stable health
curl -f https://prod-api-stable.nextgen.local/health

# Database connections
psql $PROD_DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

**Automatic Rollback Triggers**:
```yaml
If ANY of these occur:
  - Error rate > 1.0% for 2 consecutive checks
  - Latency p99 > 2000ms for 3 consecutive checks
  - Canary instance health check fails
  - Database pool exhausted (>19/20)
  - Pod crash loop (>2 restarts)

Then:
  1. Alert team (Slack, PagerDuty)
  2. Delete canary instance
  3. Keep stable at 100%
  4. Incident response protocol
```

**Status**: ✅ Canary passed monitoring (5 minutes)

#### Step 4: Gradual Traffic Promotion (5-20 minutes)

```
PHASE 1: 25% Traffic (5:00 - 5:05)
  New Instance (1): v1.0.0 (25% traffic)
  Stable Instances (2): v0.9.5 (75% traffic)
  
  Load Balancer
    ├─ 75% → prod-stable-1, prod-stable-2
    └─ 25% → prod-canary-1

  Monitoring:
    ✓ Error rate < 0.5%
    ✓ Latency p99 < 1000ms
    ✓ Throughput (invoices/min)
    ✓ Payment success rate

  Decision: Continue or Rollback?
    ✓ All metrics normal → Continue
    ✗ Issues detected → Rollback to 0%

Time: 5 minutes elapsed
```

```
PHASE 2: 50% Traffic (5:05 - 5:10)
  New Instance (1): v1.0.0 (50% traffic)
  Stable Instance (1): v0.9.5 (50% traffic)
  
  Load Balancer
    ├─ 50% → prod-stable-1
    └─ 50% → prod-canary-1

  Monitoring:
    ✓ Request volume doubled
    ✓ Error rate < 0.2%
    ✓ Cache hit ratio
    ✓ Database query latency

  Decision: Continue or Rollback?
    ✓ All metrics normal → Continue
    ✗ Issues detected → Rollback to 25%

Time: 10 minutes elapsed
```

```
PHASE 3: 100% Traffic (5:10 - 5:15)
  All traffic: v1.0.0
  
  Load Balancer
    └─ 100% → prod-canary-1

  Immediate Actions:
    1. Delete stable instances (v0.9.5)
    2. Canary becomes new stable
    3. Rename: prod-canary-1 → prod-stable-1
    4. Scale: Create 2 more stable instances
    
  Monitoring:
    ✓ Full production load
    ✓ Error rate < 0.1%
    ✓ Latency p99 < 500ms
    ✓ SLA compliance (99.9%)

Time: 15 minutes elapsed
```

**Gradual Promotion Workflow**:
```
Start Canary (5% traffic)
  ↓ (5 minutes)
  ├─ Pass? → 25% Traffic
  └─ Fail? → Rollback
  
25% Traffic
  ↓ (5 minutes)
  ├─ Pass? → 50% Traffic
  └─ Fail? → Rollback to 0%

50% Traffic
  ↓ (5 minutes)
  ├─ Pass? → 100% Traffic
  └─ Fail? → Rollback to 25%

100% Traffic (STABLE)
  ↓ (ongoing)
  ├─ Monitor for 30 minutes
  ├─ Check SLA compliance
  └─ Complete deployment
```

**Status**: ✅ 100% traffic on v1.0.0 (20 minutes)

#### Step 5: Stabilization (20-50 minutes)

```yaml
Post-Deployment Actions:
  ├─ Continue monitoring (30 more minutes)
  ├─ Run full smoke test suite
  ├─ Validate database integrity
  ├─ Check backup completion
  ├─ Verify scheduled jobs running
  └─ Monitor alert rules (0 new critical)

Stabilization Metrics:
  Error Rate:  0.05% (< 0.1% required)
  Latency p99: 450ms (< 500ms required)
  Throughput:  100% of baseline
  Success Rate: 99.95% (SLO: 99.9%)
```

**Final Checks**:
```bash
# Health endpoint
curl https://prod-api.nextgen.local/health | jq

# Business metrics
curl https://prod-api.nextgen.local/metrics | grep invoices_processed_total

# Database state
psql $PROD_DATABASE_URL -c "SELECT count(*) FROM invoices WHERE status='COMPLETED';"

# Uptime
curl https://status.nextgen.local/api/incidents?limit=1
```

**Status**: ✅ Production stable (50 minutes)

#### Step 6: Post-Deployment

```
Immediate (first hour):
  ✅ Update status page: "Production update complete"
  ✅ Notify stakeholders: Email/Slack
  ✅ Document any issues: Jira incident
  ✅ Team celebration: #nextgen-devops "🎉 v1.0.0 live!"

Within 24 hours:
  ✅ Review logs for warnings
  ✅ Check for any manual issues reported
  ✅ Validate all integrations working
  ✅ Run performance baseline tests

Within 7 days:
  ✅ Post-deployment review meeting
  ✅ Document lessons learned
  ✅ Update runbooks if needed
  ✅ Archive release artifacts
```

**Final Notification**:
```
Slack Channel: #nextgen-devops
Message:
  🎉 PRODUCTION DEPLOYMENT COMPLETE
  
  Version: v1.0.0
  Duration: 20 minutes
  Status: HEALTHY
  
  Changes:
    ✓ Invoice DDD architecture
    ✓ Resiliency patterns (circuit breaker, bulkhead)
    ✓ Idempotency for state-changing APIs
    ✓ Redis caching with tag-based invalidation
  
  Metrics:
    Error rate: 0.05%
    Latency p99: 450ms
    Throughput: 100%
    Uptime: 99.95%
  
  Rollback: Manual dispatch available
  Logs: [Workflow Link]
  Dashboard: [Grafana Link]
```

**Status**: ✅ Deployment complete

#### Troubleshooting Production Deployment

```yaml
Issue: Canary error rate > 1%
Trigger: Automatic rollback
Solution:
  1. Canary instance deleted
  2. Stable instances remain at 100%
  3. Incident created: PagerDuty
  4. Team alerted: Slack, SMS
  5. Actions:
     - Investigate logs
     - Identify root cause
     - Fix in develop/main
     - Retry deployment after fix
  6. Post-mortem within 2 hours

Issue: Gradual promotion stuck at 25%
Root Cause Examples:
  - High error rate on new version
  - Database connection pool exhaustion
  - Cache invalidation issue
  - New dependency failure

Manual Rollback:
  1. Trigger workflow_dispatch: rollback/prod
  2. Verify stable instances at 100%
  3. Delete new instance
  4. Confirm health checks passing
  5. Document incident

Issue: Database migration timeout
Solution:
  1. Check pg_upgrade logs
  2. Verify table locks
  3. Kill blocking transactions (if safe)
  4. Resume migration
  5. If still fails: Rollback & fix migration

Issue: API responds with 503 (service unavailable)
Immediate Actions:
  1. Check upstream services (Redis, DB)
  2. Verify all instances healthy
  3. Check network policies (firewall)
  4. Restart instance if stuck
  5. If widespread: Trigger manual rollback
```

---

## Rollback Procedures

### Automatic Rollback (Canary Failure)

**Trigger**: Error rate > 1% detected  
**Action**: Automatic, no manual intervention needed  
**Time**: < 30 seconds

```
1. Canary monitoring detects error_rate > 1%
2. Alert system triggers: CRITICAL
3. GitHub Actions: Delete canary instance
4. Traffic: Stays 100% on stable (v0.9.5)
5. Incident: Auto-created in PagerDuty
6. Team: Alerted via Slack + SMS
7. Result: Rollback complete (zero downtime)
```

### Manual Rollback (Production)

**Trigger**: User initiates via workflow dispatch  
**Action**: Human-controlled rollback  
**Time**: 2-3 minutes

```bash
# Option 1: GitHub CLI
gh workflow run ci-cd-enterprise.yml \
  -f environment=prod \
  -r main

# Option 2: GitHub UI
1. Go to Actions → ci-cd-enterprise.yml
2. Click "Run workflow"
3. Environment: prod
4. Click "Run workflow"

# Option 3: Azure CLI
az container delete \
  -g prod-nextgen \
  -n prod-canary-1 \
  --yes
```

**Steps**:
```
1. Verify previous version stable
2. Delete new instance
3. Update Load Balancer to point to stable
4. Verify health checks passing
5. Update status page
6. Alert team: Incident resolved
```

### Staged Rollback (Gradual Revert)

```
If issues detected AFTER full promotion:

Current State (100% v1.0.0):
  All traffic → prod-stable-1 (v1.0.0)

Action 1: Create old instance
  Deploy old version (v0.9.5)
  → prod-old-1

Action 2: Test old version
  Smoke tests: All pass ✓

Action 3: Gradual shift (reverse)
  75% → v1.0.0
  25% → v0.9.5
  (monitor 5 minutes)

Action 4: Continue shift
  50% → v1.0.0
  50% → v0.9.5
  (monitor 5 minutes)

Action 5: Complete shift
  100% → v0.9.5 (old version)

Result: Rolled back to previous version
```

---

## Runbook Approval Flow

```
Production Deployment Approval Request
├─ Release Manager: Approve deployment
├─ Tech Lead: Approve technical readiness
└─ Operations Lead: Approve infrastructure readiness

Approval Timeout: 24 hours
├─ If not approved: Deployment rejected
├─ Restart workflow to retry
└─ Update approval request with new timestamp

Escalation: Tech Lead + Ops Lead → VP Engineering
├─ Critical issues found: VP must approve override
├─ Time constraint override: VP authorization
└─ Emergency deployment: VP signature required
```

## Emergency Contact

```yaml
On-Call Rotation: PagerDuty
Escalation:
  1st: On-call DevOps engineer (5 min response)
  2nd: DevOps lead (15 min response)
  3rd: VP Engineering (30 min response)

Critical Issues:
  Slack: #nextgen-incidents
  Email: incidents@nextgen.local
  Phone: Follow PagerDuty escalation
  
Support:
  Documentation: https://nextgen.local/docs
  Status Page: https://status.nextgen.local
  Monitoring: https://grafana.nextgen.local
```

---

## Deployment Complete ✅

All scenarios documented with:
- ✅ Step-by-step procedures
- ✅ Troubleshooting guides
- ✅ Monitoring commands
- ✅ Rollback procedures
- ✅ Communication templates
- ✅ Emergency contacts

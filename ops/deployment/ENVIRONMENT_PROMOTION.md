# 📦 Artifact Versioning & Environment Promotion

## Semantic Versioning Strategy

```yaml
VERSION FORMAT: MAJOR.MINOR.PATCH-METADATA+BUILD

Examples:
  v1.0.0                                    # Release version
  v1.0.1                                    # Patch (bug fix)
  v1.1.0                                    # Minor (feature)
  v2.0.0                                    # Major (breaking)
  v1.0.0-alpha.1                            # Pre-release
  v1.0.0-rc.1                               # Release candidate
  v1.0.0-beta.1+build.123                   # Build metadata
```

## Docker Image Tagging

```yaml
PRODUCTION:
  ghcr.io/nextgen-market/nextgen-market:v1.0.0
  ghcr.io/nextgen-market/nextgen-market:1.0
  ghcr.io/nextgen-market/nextgen-market:1.0.0-{git-sha}
  ghcr.io/nextgen-market/nextgen-market:latest

STAGING:
  ghcr.io/nextgen-market/nextgen-market:v1.1.0-rc.1
  ghcr.io/nextgen-market/nextgen-market:main-{git-sha}
  ghcr.io/nextgen-market/nextgen-market:staging

DEVELOPMENT:
  ghcr.io/nextgen-market/nextgen-market:develop-{git-sha}
  ghcr.io/nextgen-market/nextgen-market:dev
```

## Build Metadata

```json
{
  "version": "1.0.0",
  "gitSha": "a1b2c3d",
  "buildDate": "2025-11-19T10:30:00Z",
  "buildNumber": "123",
  "branch": "main",
  "nodeVersion": "20.10.0",
  "npmVersion": "10.2.0",
  "buildDuration": "5m 23s"
}
```

## Environment Promotion Flow

```
┌──────────────────────────────────────────────────────────────┐
│ DEVELOPMENT ENVIRONMENT (Auto Deploy)                        │
├──────────────────────────────────────────────────────────────┤
│ Trigger: Push to develop branch                              │
│ Duration: ~5 minutes                                         │
│ Strategy: Direct deployment                                  │
│ Rollback: Manual (workflow dispatch)                         │
│ Health Check: Basic smoke test                               │
│ Approval: None (automatic)                                   │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ↓ (Create PR to main, merge after review)
┌──────────────────────────────────────────────────────────────┐
│ STAGING ENVIRONMENT (Blue-Green)                             │
├──────────────────────────────────────────────────────────────┤
│ Trigger: Merge to main branch                                │
│ Duration: ~10 minutes                                        │
│ Strategy: Blue-Green (zero downtime)                         │
│ Rollback: Automatic (if health checks fail)                  │
│ Health Check: Full smoke test suite                          │
│ Approval: REQUIRED - Pull Request policy                     │
│ ├─ Code review (1 approval minimum)                          │
│ ├─ Status checks (all passing)                               │
│ └─ Branch protection (up to date with base)                  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ↓ (Create release tag v1.0.0, push tag)
┌──────────────────────────────────────────────────────────────┐
│ PRODUCTION ENVIRONMENT (Canary + Gradual)                    │
├──────────────────────────────────────────────────────────────┤
│ Trigger: Release tag created (v1.0.0)                        │
│ Duration: ~20 minutes (5min canary + 10min gradual)          │
│ Strategy: Canary (5%) → Gradual (25% → 50% → 100%)         │
│ Rollback: Automatic (if canary fails) or Manual              │
│ Health Check: Continuous monitoring                          │
│ Metrics Tracked:                                             │
│ ├─ Error rate (alert if > 1%)                               │
│ ├─ Latency (alert if p99 > 2s)                              │
│ ├─ CPU/Memory (alert if > 80%)                              │
│ └─ Database connections (alert if exhausted)                │
│ Approval: REQUIRED - Azure release pipeline approval        │
│ ├─ Release manager sign-off                                 │
│ ├─ Scheduled maintenance window (off-peak)                  │
│ └─ Rollback plan verified                                   │
└──────────────────────────────────────────────────────────────┘
```

## Promotion Approval Gates

### STAGING Approval Gate (Pull Request Policy)

```yaml
Branch Protection Rules:
  ├─ Require pull request reviews
  │   └─ Minimum 1 approval
  ├─ Dismiss stale pull request approvals
  │   └─ When new commits pushed
  ├─ Require status checks to pass
  │   ├─ Lint (required)
  │   ├─ Test (required)
  │   ├─ Security (required)
  │   ├─ Build (required)
  │   └─ SonarQube quality gate (required)
  ├─ Require branches to be up to date
  │   └─ Before merging
  ├─ Require code reviews from code owners
  │   └─ CODEOWNERS file path: .github/CODEOWNERS
  └─ Require conversation resolution
      └─ Before merging
```

### PRODUCTION Approval Gate (Azure Release)

```yaml
Approval Requirements:
  ├─ Pre-deployment approvers
  │   ├─ Release Manager (person-specific)
  │   ├─ Tech Lead
  │   └─ At least 2 approvals required
  ├─ Deployment gates
  │   ├─ Health check monitoring (5 minutes)
  │   ├─ SLA validation (uptime > 99.9%)
  │   └─ Database migration validation
  ├─ Post-deployment approvers
  │   ├─ Operations team
  │   └─ Monitoring confirmation
  └─ Approval timeout
      └─ Auto-reject after 24 hours
```

## Deployment Strategies

### DEVELOPMENT: Direct Deployment

```
1. Code pushed to develop branch
2. CI pipeline runs: Lint → Test → Build
3. Docker image built and pushed to registry
4. Deploy container to Dev environment
5. Smoke test: curl /health
6. Success → Complete
   Failure → Alert team, manual rollback

Rollback:
  Manual workflow dispatch (redeploy previous tag)
```

### STAGING: Blue-Green Deployment

```
STAGE 1: Deploy Green (New Version)
  1. Current production = BLUE
  2. Deploy new version = GREEN
  3. Run health checks on GREEN
  4. If GREEN fails:
     └─ Terminate GREEN
     └─ Keep BLUE running (zero downtime)

STAGE 2: Switch Traffic
  1. Load balancer routes 100% → GREEN
  2. Monitor error rate (target: < 0.1%)
  3. If errors spike:
     └─ Route 100% → BLUE (automatic rollback)

STAGE 3: Decommission Blue
  1. Wait 30 minutes (hold previous version)
  2. Terminate BLUE
  3. GREEN now becomes "stable"

Benefits:
  ✓ Zero downtime
  ✓ Instant rollback capability
  ✓ Easy to A/B test
  ✓ Database migrations backward-compatible
```

### PRODUCTION: Canary + Gradual Promotion

```
STAGE 1: Canary Deployment (5% Traffic)
  1. Deploy canary version to isolated instances
  2. Route 5% traffic to canary
  3. Monitor for 5 minutes:
     ├─ Error rate (alert if > 1%)
     ├─ Latency p99 (alert if > 2s)
     ├─ Database connection pool
     └─ Memory/CPU usage
  4. If canary fails:
     └─ Automatic rollback to stable
     └─ Alert team immediately

STAGE 2: Gradual Traffic Shift (Success Path)
  25% Traffic (5 minutes):
    └─ Route 25% → new version
    └─ 75% → stable version
    └─ Monitor metrics
  
  50% Traffic (5 minutes):
    └─ Route 50% → new version
    └─ Monitor: error rate, latency, throughput
  
  100% Traffic (Complete):
    └─ All traffic → new version
    └─ Monitor next 30 minutes

STAGE 3: Stabilization & Cleanup
  ├─ Monitor for 1 hour
  ├─ Run smoke tests every 5 minutes
  ├─ Check error budgets (SLO compliance)
  └─ Decommission canary instances

Benefits:
  ✓ Detects issues affecting small % before full rollout
  ✓ Gradual user exposure to changes
  ✓ Database schema changes validated
  ✓ Performance impact measured
  ✓ Ability to rollback anytime (< 30 min window)
```

## Rollback Strategies

### Automatic Rollback (Canary/Staging)

```yaml
Triggers:
  - Error rate > 1% (5-minute window)
  - Latency p99 > 2 seconds
  - Health check failure (>3 consecutive fails)
  - Critical error pattern detected
  - Database connection pool exhausted

Actions:
  1. Detect anomaly
  2. Alert team (Slack, PagerDuty)
  3. Switch traffic to previous version
  4. Verify health of previous version
  5. Post-incident analysis
  6. No manual intervention needed
```

### Manual Rollback (Workflow Dispatch)

```bash
# Trigger rollback manually
curl -X POST \
  https://api.github.com/repos/nextgen-market/nextgen-market/actions/workflows/ci-cd-enterprise.yml/dispatches \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"ref":"main","inputs":{"environment":"prod"}}'
```

## Version Control

### Git Tags for Production

```bash
# Semantic versioning with git tags
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Tag naming convention
v{MAJOR}.{MINOR}.{PATCH}[-{PRERELEASE}][+{BUILD}]

Examples:
  v1.0.0                    # Production release
  v1.0.1                    # Patch release
  v1.1.0                    # Minor release
  v2.0.0                    # Major release
  v1.0.0-rc.1              # Release candidate
  v1.0.0-beta.1+build.123  # Pre-release with build info
```

### Changelog Management

```
CHANGELOG.md (Semantic)
├─ [1.0.0] - 2025-11-19
│   ├─ Added
│   │   ├─ Circuit breaker pattern
│   │   └─ Idempotency support
│   ├─ Changed
│   │   └─ Migration to TypeORM 0.3
│   ├─ Fixed
│   │   ├─ Memory leak in cache service
│   │   └─ Race condition in payment processing
│   ├─ Security
│   │   └─ Updated npm dependencies
│   └─ Deployment Notes
│       ├─ Database migration: npm run migration:run
│       ├─ Breaking: API v1 endpoint deprecated
│       └─ Rollback: Use v0.9.5 image tag

├─ [0.9.5] - 2025-11-10
├─ [0.9.0] - 2025-10-15
└─ ... (older versions)
```

## Monitoring During Deployment

```yaml
Canary Phase (0-5 minutes):
  Every 10 seconds:
    ├─ Check error rate (baseline: 0.05%)
    ├─ Check p99 latency (baseline: 500ms)
    ├─ Check CPU usage (baseline: 40%)
    ├─ Check memory usage (baseline: 60%)
    └─ Check database connections (baseline: 15/20)

  Alert Thresholds:
    ├─ Error rate > 1.0% → Rollback immediately
    ├─ p99 latency > 2000ms → Investigate
    ├─ CPU > 90% → Investigate
    ├─ Memory > 90% → Investigate
    └─ DB connections > 18/20 → Scale up

Gradual Promotion Phase (5-20 minutes):
  Every 30 seconds:
    ├─ Business metrics (invoice throughput)
    ├─ Payment success rate
    ├─ Error budget consumption
    └─ SLA compliance (99.9% uptime)

Stabilization Phase (20-80 minutes):
  Every 5 minutes:
    ├─ Full smoke test suite
    ├─ Database query performance
    ├─ Cache hit ratio
    └─ Average response time
```

## Approval Request Template

```markdown
## Production Deployment Request

**Release Version**: v1.0.0
**Deployment Date**: 2025-11-20 14:00 UTC
**Expected Duration**: 15 minutes

### Changes Summary
- ✅ New DDD architecture implemented
- ✅ Resiliency patterns (circuit breaker, bulkhead)
- ✅ Idempotency for all state-changing APIs
- ✅ Redis caching with tag-based invalidation

### Risk Assessment
- **Risk Level**: 🟢 LOW
- **Test Coverage**: 85%
- **Load Tests**: PASSED (10,000 req/s)
- **Security Audit**: PASSED (0 critical)

### Rollback Plan
- **Rollback Version**: v0.9.5
- **Estimated Rollback Time**: 3 minutes (canary → immediate)
- **Data Safety**: ✅ Backward-compatible schema

### Approvers Needed
- [ ] Release Manager (@release-mgr)
- [ ] Tech Lead (@tech-lead)
- [ ] DevOps Lead (@devops-lead)

### Deployment Timeline
```
14:00 UTC - Canary deployment (5% traffic)
14:05 UTC - Monitor canary (5 minutes)
14:10 UTC - Gradual shift 25%
14:15 UTC - Shift 50%
14:20 UTC - Shift 100%
14:25 UTC - Final verification
```

### Approval Deadline
2025-11-20 13:30 UTC (30 minutes before deployment)

### Questions?
Slack: #nextgen-devops
PagerDuty: on-call rotation
```

## Rollback Checklist

```yaml
Pre-Rollback:
  ☐ Alert team: #nextgen-incidents
  ☐ Page on-call: PagerDuty incident
  ☐ Document issue: Root cause
  ☐ Notify customers: Status page update

Rollback Execution:
  ☐ Trigger rollback workflow
  ☐ Monitor previous version health
  ☐ Verify health checks passing
  ☐ Monitor error rates (expect return to baseline)
  ☐ Monitor latency (expect return to baseline)

Post-Rollback:
  ☐ Update incident status
  ☐ Schedule post-mortem
  ☐ Document lessons learned
  ☐ Update deployment checklist
  ☐ Fix issues before retry
  ☐ Plan remediation timeline
```

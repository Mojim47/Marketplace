# 📖 Runbooks & Playbooks - Incident Response & Operations

## Table of Contents

1. [On-Call Procedures](#on-call-procedures)
2. [Incident Response Playbooks](#incident-response-playbooks)
3. [Deployment Guide](#deployment-guide)
4. [Troubleshooting Steps](#troubleshooting-steps)
5. [Escalation Paths](#escalation-paths)

---

## On-Call Procedures

### On-Call Rotation

```
Week 1: Team A (Primary: @alice, Secondary: @bob)
Week 2: Team B (Primary: @charlie, Secondary: @diana)
Week 3: Team C (Primary: @eve, Secondary: @frank)
Week 4: Team A (rotation repeats)

Handoff Timing: Monday 09:00 UTC
Escalation: Alert → 5min → Primary → 10min → Secondary → 15min → Manager
```

### First 5 Minutes (Triage)

```
☐ Acknowledge alert (click link in Slack/PagerDuty)
☐ Open dashboard: https://grafana.nextgen.local/d/prod-overview
☐ Check error rate: Check if > baseline (usually <0.1%)
☐ Check latency: Check if p99 > 1000ms
☐ Check resources: CPU/Memory/Disk on nodes
☐ Review recent deployments (last 30 minutes)
☐ Check if incident is known/acknowledged
☐ Post in #incidents channel: "Incident acknowledged by @oncall"
```

### 10-Minute Assessment

```
☐ Determine severity:
  ├─ P1: Complete outage, all users affected, 10+ errors/sec
  ├─ P2: Partial outage, some users affected, errors < 10/sec
  ├─ P3: Degraded performance, p99 > 2000ms
  └─ P4: Minor issues, no user impact
  
☐ Check logs:
  └─ kubectl logs -f deployment/nextgen-api -n production
  └─ Look for: error stack trace, database connection, timeout
  
☐ Identify affected service:
  ├─ API: Check 3000/health, database connectivity
  ├─ Database: Check CPU, connections, replication lag
  ├─ Cache: Check Redis PING, memory usage
  ├─ Ingress: Check request rate, blocked connections
  └─ Other: Identify from metrics
  
☐ Decide: Can fix in <5 minutes? → Fix directly
  ☐ If yes: Proceed to "Quick Fix" section
  ☐ If no: Escalate to team lead within 15 minutes
```

### Communication Template (Slack)

```
🚨 Incident P{1-4}: {Service} {Issue}

Severity: {P1/P2/P3/P4}
Started: {TIME} UTC
Status: Investigating / Mitigating / Resolved

Affected: {Service/Endpoint}
Impact: {X% of requests failing | p99 latency +Y%}
Root Cause: {investigating}

Actions Taken:
- {action 1}
- {action 2}

ETA to Resolution: {if known}
```

---

## Incident Response Playbooks

### Playbook 1: High Error Rate

**Trigger**: Error rate > 1% for > 5 minutes

```
SEVERITY: P2 (usually) → P1 (if > 5%)

IMMEDIATE (0-5 min):
  1. Check Grafana error dashboard
     └─ Identify which endpoint is failing
     └─ Check error type: 500 (server) vs 400 (client)
  
  2. Check logs
     kubectl logs -f deployment/nextgen-api -n production --tail=100
     
  3. Check database
     kubectl exec -it postgres-0 -c postgres -- \
       psql -U postgres -d nextgen_db -c "SELECT * FROM pg_stat_activity;"
     
     If connections > 80: Database is saturated

MITIGATION (5-15 min):
  Option A: Database saturation
    └─ Scale API replicas down to 1
       kubectl scale deployment nextgen-api --replicas=1
    └─ Wait 2 minutes, check if errors reduce
    └─ If yes: Database connection pool issue (see Playbook 4)
    └─ Scale back up gradually: replicas=3, wait 1min, then replicas=5

  Option B: Memory leak (memory increasing)
    └─ Restart pods (causes brief downtime):
       kubectl rollout restart deployment/nextgen-api
    └─ Monitor memory: kubectl top pods -n production
    └─ If memory stable: Memory leak fixed by restart
    └─ Investigate code review needed after incident

  Option C: Recent deployment
    └─ Check last deployment:
       kubectl rollout history deployment/nextgen-api
    └─ Rollback if committed < 30 min ago:
       kubectl rollout undo deployment/nextgen-api
    └─ Wait 2 minutes, verify error rate drops
    └─ Post-incident: Review deployment changes

VALIDATION (15+ min):
  ✓ Error rate < baseline (0.1%)
  ✓ No alerts firing
  ✓ Users reporting no issues
  ✓ All replicas healthy (kubectl get pods)

POST-INCIDENT:
  1. Create incident ticket in Jira
  2. Schedule postmortem (within 24 hours)
  3. Collect metrics: error_rate_max, duration, impact
```

### Playbook 2: High Latency

**Trigger**: p99 latency > 2 seconds for > 5 minutes

```
SEVERITY: P3 (if p99 > 2s), P2 (if p99 > 5s)

IMMEDIATE (0-5 min):
  1. Check which endpoint is slow
     kubectl exec -i prometheus-0 -c prometheus -- bash << 'EOF'
     curl -s 'http://localhost:9090/api/v1/query_range?query=\
       histogram_quantile(0.99,http_request_duration_seconds)&\
       start=1h&step=1m' | jq '.data.result[] | {metric, value}'
     EOF
  
  2. Check database query performance
     kubectl exec -it postgres-0 -c postgres -- \
       psql -U postgres -d nextgen_db << 'SQL'
     SELECT query, calls, mean_time, max_time FROM pg_stat_statements 
     ORDER BY mean_time DESC LIMIT 10;
     SQL
  
  3. Check resource usage
     kubectl top nodes
     kubectl top pods -n production

MITIGATION (5-15 min):
  Option A: Database slow queries
    └─ Check slow query log:
       kubectl exec -it postgres-0 -c postgres -- \
         tail -100 /var/log/postgresql/postgresql.log | grep "duration"
    └─ Scale database READ replicas if available
    └─ Add database connection pooling (PgBouncer)
  
  Option B: API service slow (high CPU)
    └─ Scale replicas up:
       kubectl scale deployment/nextgen-api --replicas=10
    └─ Wait 1 minute, recheck p99 latency
    └─ If improved: Load balancing issue, add more replicas
    └─ If not improved: Not CPU-bound, investigate database/network
  
  Option C: Cache miss (high Redis latency)
    └─ Check Redis connection pool:
       kubectl exec -it redis-0 -c redis -- \
         redis-cli INFO stats | grep -E "(total_commands|connected_clients)"
    └─ Flush cache (cautious - will spike load):
       kubectl exec -it redis-0 -c redis -- redis-cli FLUSHDB
    └─ Rebuild cache gradually (monitor error rate during this)

VALIDATION (15+ min):
  ✓ p99 latency < 1s
  ✓ p95 latency < 500ms
  ✓ No new error spikes
  ✓ CPU utilization < 70%

POST-INCIDENT:
  1. Analyze root cause in Prometheus
  2. Check if scaling needs adjustment
  3. Plan query optimization if DB was issue
```

### Playbook 3: Pod Restart Loop

**Trigger**: Pod restarting > 3 times in 5 minutes

```
SEVERITY: P2 (service degraded)

IMMEDIATE (0-5 min):
  1. Check pod status
     kubectl get pods -n production -w
  
  2. Check restart count
     kubectl get pods -n production -o custom-columns=\
       NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount
  
  3. Check pod logs
     kubectl logs deployment/nextgen-api -n production --previous
     └─ Note: --previous gets last terminated container logs

DIAGNOSIS (5-10 min):
  Check for common causes:
  
  A. OOMKilled (Out of Memory)
     └─ kubectl describe pod {pod-name} -n production | grep "OOMKilled"
     └─ Fix: Increase memory limit
        kubectl set resources deployment/nextgen-api \
          --limits=memory=2Gi -n production
  
  B. Liveness probe failing
     └─ kubectl logs {pod-name} -n production | grep "health\|probe"
     └─ Fix: Temporarily increase probe timeout
        kubectl patch deployment nextgen-api -n production -p \
          '{"spec":{"template":{"spec":{"containers":[{"name":"api","livenessProbe":{"initialDelaySeconds":60}}]}}}}'
  
  C. Crash on startup
     └─ kubectl logs {pod-name} -n production | tail -50
     └─ Look for: database connection error, config missing
     └─ Fix: Verify ConfigMaps/Secrets exist
        kubectl get configmap,secret -n production

MITIGATION (10-20 min):
  1. Scale deployment to 0 (stop restart loop)
     kubectl scale deployment/nextgen-api --replicas=0
  
  2. Fix underlying issue (OOM, config, etc.)
  
  3. Scale back to desired replicas
     kubectl scale deployment/nextgen-api --replicas=3

VALIDATION:
  ✓ Pod stable for > 5 minutes
  ✓ No more restart events
  ✓ Service responding to requests

POST-INCIDENT:
  1. Review pod events: kubectl describe pod {pod-name}
  2. Update resource limits if OOMKilled
  3. Review recent config changes
```

### Playbook 4: Database Connection Exhaustion

**Trigger**: DB connections > 90 of max 100

```
SEVERITY: P1 (queries start timing out)

IMMEDIATE (0-5 min):
  1. Check connection status
     kubectl exec -it postgres-0 -c postgres -- \
       psql -U postgres -d nextgen_db -c \
       "SELECT datname, usename, state, COUNT(*) FROM pg_stat_activity 
        GROUP BY datname, usename, state;"
  
  2. Identify long-running queries
     kubectl exec -it postgres-0 -c postgres -- \
       psql -U postgres -d nextgen_db -c \
       "SELECT pid, usename, query_start, query FROM pg_stat_activity 
        WHERE state != 'idle' ORDER BY query_start ASC;"

MITIGATION (5-15 min):
  Option A: Stale connections (idle for > 1 hour)
    └─ Identify: state = 'idle' and query_start < NOW - 1 hour
    └─ Terminate safely:
       SELECT pg_terminate_backend(pid) 
       FROM pg_stat_activity 
       WHERE state = 'idle' 
       AND query_start < NOW() - INTERVAL '1 hour'
       AND datname = 'nextgen_db';
  
  Option B: Long-running transaction
    └─ Kill if > 30 min:
       SELECT pg_terminate_backend(pid) 
       FROM pg_stat_activity 
       WHERE (NOW() - query_start) > INTERVAL '30 minutes'
       AND state = 'active';
    └─ Identify application issue that caused long transaction
  
  Option C: Connection pool saturation (normal)
    └─ Add PgBouncer (connection pooler) if not present
    └─ Increase max_connections in postgresql.conf:
       max_connections = 200  (from 100)
       shared_buffers = 512MB (increase for more connections)
    └─ Apply with: ALTER SYSTEM SET max_connections = 200;
       SELECT pg_ctl('restart');

VALIDATION (15+ min):
  ✓ Active connections < 20
  ✓ Idle connections < 10
  ✓ Query response time < 1s
  ✓ No "FATAL: remaining connection slots reserved" errors

POST-INCIDENT:
  1. Review application connection handling
  2. Implement connection pooling (PgBouncer/PgPool)
  3. Set up alert for connection threshold
```

### Playbook 5: Disk Space Full

**Trigger**: Disk usage > 90%

```
SEVERITY: P1 (can cause crashes)

IMMEDIATE (0-5 min):
  1. Check disk usage
     kubectl exec -it master-node -- df -h
  
  2. Find large files
     kubectl exec -it master-node -- \
       du -sh /* | sort -rh | head -20

MITIGATION (5-20 min):
  Option A: Container logs filling disk
    └─ Clear logs:
       kubectl delete pod -n production -l app=nextgen-api
    └─ Note: New pods will start with clean logs
    └─ Set log retention:
       kubectl patch ds filebeat -n kube-system -p \
       '{"spec":{"template":{"spec":{"containers":[{"name":"filebeat","env":[{"name":"LOGSTASH_FIELDS","value":"retention=7d"}]}]}}}}'
  
  Option B: etcd database growing
    └─ Compact etcd:
       kubectl exec -it etcd-master -- \
         etcdctl compact $(etcdctl endpoint status --write-out=json | jq '.header.revision')
    └─ Defragment:
       etcdctl defrag --endpoints=127.0.0.1:2379
  
  Option C: Persistent volume full
    └─ Identify which PVC:
       kubectl get pvc -A
    └─ Check what's consuming space:
       kubectl exec -it postgres-0 -- du -sh /var/lib/postgresql/data/*
    └─ Expand PVC (if storage allows):
       kubectl patch pvc postgres-data -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
    └─ Wait for storage expansion to complete
    └─ Verify in pod: df -h /var/lib/postgresql/data

VALIDATION:
  ✓ Disk usage < 70%
  ✓ No more "No space left on device" errors
  ✓ Services responding normally

POST-INCIDENT:
  1. Review disk usage trends
  2. Implement disk usage alerts at 75%
  3. Implement automatic log rotation (7-day retention)
  4. Plan storage expansion if growth continues
```

---

## Deployment Guide

### Pre-Deployment Checklist

```
☐ Code Review
  ├─ Approved by 2+ reviewers
  ├─ No known security issues
  └─ Passed all automated checks
  
☐ Testing
  ├─ Unit tests: > 80% coverage
  ├─ Integration tests: Pass
  ├─ Staging environment: Tested
  └─ Load test if critical change
  
☐ Monitoring
  ├─ Metrics dashboard ready
  ├─ Alerts configured
  ├─ Log aggregation working
  └─ Canary thresholds set
  
☐ Rollback Plan
  ├─ Previous version identified
  ├─ Rollback procedure tested
  └─ Team agrees on rollback criteria
  
☐ Communication
  ├─ Team notified of deployment window
  ├─ On-call engineer assigned
  └─ Stakeholders informed
```

### Deployment Steps

```
STEP 1: Merge to main branch
  └─ git merge --ff-only feature/my-feature

STEP 2: Trigger GitHub Actions
  └─ Workflow: ci-cd-enterprise.yml
  └─ Stages: Lint → Test → Security → Build → Deploy Staging → Deploy Prod

STEP 3: Monitor Staging (5 min)
  └─ Check Grafana dashboard
  └─ Verify no new errors
  └─ Run smoke tests:
     curl -f https://api-staging.nextgen.local/health

STEP 4: Approve Production Deployment
  └─ Requires code owner approval
  └─ Check PR review comments
  └─ Approve in GitHub Actions UI

STEP 5: Monitor Canary Deployment (10 min)
  └─ 10% of traffic → new version
  └─ Metrics: error_rate < 0.5%, latency < 1.2x baseline
  └─ If metrics fail → Automatic rollback
  └─ If metrics pass → Proceed to 100%

STEP 6: Monitor Production (30 min)
  └─ 100% traffic on new version
  └─ Error rate normal
  └─ Latency stable
  └─ No customer complaints

STEP 7: Finaliz Deployment
  └─ Mark as complete in GitHub Actions
  └─ Post success message in #deployments
  └─ Create incident ticket if any issues found
```

### Rollback Procedure

```
MANUAL ROLLBACK (if canary failed):
  1. Identify previous stable version
     kubectl rollout history deployment/nextgen-api
  
  2. Rollback immediately
     kubectl rollout undo deployment/nextgen-api
  
  3. Verify rollback
     kubectl rollout status deployment/nextgen-api
  
  4. Monitor for 5 minutes
     Grafana error rate, latency, pods
  
  5. Post incident notification
     "Rollback completed. Deployment reverted to previous version."

AUTOMATIC ROLLBACK (canary threshold exceeded):
  └─ Triggered automatically by GitHub Actions
  └─ Threshold: error_rate > 1% or latency > 2x baseline
  └─ Duration: < 30 seconds
  └─ Alert sent to on-call engineer
  └─ Investigate before next deployment attempt
```

---

## Troubleshooting Steps

### General Troubleshooting Flow

```
1. Define the Problem
   ├─ What is broken? (API, database, cache, etc.)
   ├─ When did it start? (exact time)
   ├─ How many users affected? (% of traffic)
   └─ What changed recently? (deployment, config, traffic)

2. Gather Evidence
   ├─ Logs: kubectl logs -f deployment/nextgen-api
   ├─ Metrics: Grafana dashboard
   ├─ Events: kubectl describe pod {pod-name}
   └─ Configuration: kubectl get configmap,secret -A

3. Form Hypothesis
   ├─ Is it infrastructure? (nodes, storage, network)
   ├─ Is it application? (code, configuration, resources)
   ├─ Is it external? (database, cache, third-party)
   └─ Is it user error? (misconfiguration, wrong endpoint)

4. Test Hypothesis
   ├─ Isolate the component
   ├─ Test connectivity
   ├─ Verify configuration
   └─ Run health checks

5. Execute Fix
   ├─ Implement safest solution first
   ├─ Monitor impact
   ├─ Have rollback ready
   └─ Document changes
```

### Common Issues & Fixes

```
ISSUE: "CrashLoopBackOff"
  Fix:
  1. Check logs: kubectl logs {pod} --previous
  2. Common causes:
     - Database not reachable → Verify ConnectionString
     - Config missing → kubectl get configmap -n production
     - OOMKilled → Increase memory limits
  3. Restart cleanly:
     kubectl delete pod {pod} -n production

ISSUE: "Connection refused"
  Fix:
  1. Service not running: kubectl get svc -n production
  2. Pod not healthy: kubectl get pods -n production
  3. Port mismatch: kubectl get svc {service} -o yaml | grep port
  4. Network policy blocking: kubectl get networkpolicies -n production

ISSUE: "Timeout - Waiting for connection pool"
  Fix:
  1. Check database: kubectl get pod -n production -l app=postgres
  2. Check connections:
     SELECT COUNT(*) FROM pg_stat_activity;
  3. Kill stale connections (see Playbook 4)
  4. Increase pool size: max_connections = 200

ISSUE: "Disk space - mktemp: cannot create temp directory"
  Fix:
  1. Check disk: df -h /
  2. Find large files: du -sh /* | sort -rh | head -10
  3. Clear logs: kubectl logs -c log-aggregator {pod} > /dev/null
  4. Clean up: rm -rf /tmp/*

ISSUE: "Rate limit exceeded - Too many requests"
  Fix:
  1. Check rate limit config: kubectl get ingress -o yaml | grep limit
  2. Whitelist IP if needed: Add to limit-whitelist annotation
  3. Increase limit if legitimate: nginx.ingress.kubernetes.io/limit-rps: 200
  4. Check for DDoS: Look for single IP sending requests
```

---

## Escalation Paths

### Severity & Response Times

```
┌─────────────────────────────────────────────────────────┐
│ P1 - CRITICAL (Complete Outage)                         │
├─────────────────────────────────────────────────────────┤
│ Response: < 5 minutes                                   │
│ Escalation: On-call → Team Lead → Manager              │
│ Communication: Every 5 minutes                          │
│ Target Resolution: < 30 minutes                         │
│ Post-Incident: Postmortem within 24 hours             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ P2 - HIGH (Partial Degradation)                        │
├─────────────────────────────────────────────────────────┤
│ Response: < 15 minutes                                  │
│ Escalation: On-call → Team Lead (if not resolved)     │
│ Communication: Every 15 minutes                         │
│ Target Resolution: < 2 hours                            │
│ Post-Incident: Postmortem within 48 hours             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ P3 - MEDIUM (Degraded Performance)                     │
├─────────────────────────────────────────────────────────┤
│ Response: < 30 minutes                                  │
│ Escalation: On-call → Team Lead (if needed)            │
│ Communication: As needed                                │
│ Target Resolution: < 4 hours                            │
│ Post-Incident: Analysis during standup                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ P4 - LOW (Minor Issues)                                │
├─────────────────────────────────────────────────────────┤
│ Response: < 1 day                                       │
│ Escalation: Track in Jira                              │
│ Communication: During standup                          │
│ Target Resolution: < 1 week                             │
│ Post-Incident: None required                           │
└─────────────────────────────────────────────────────────┘
```

### Escalation Contacts

```
Tier 1 (On-Call)
  ├─ @alice (Mon-Sun 09:00-17:00 UTC)
  ├─ On-call team in Slack: #on-call
  └─ PagerDuty: nextgen-platform-oncall

Tier 2 (Team Lead)
  ├─ @bob (Backend Lead)
  ├─ @charlie (DevOps Lead)
  └─ Slack: @team-leads

Tier 3 (Management)
  ├─ @diana (Engineering Manager)
  ├─ @eve (VP Engineering)
  └─ Email: engineering-vp@nextgen.local
```

### When to Escalate

```
ESCALATE IMMEDIATELY if:
  ✓ P1 severity (complete outage)
  ✓ Cannot identify root cause within 10 minutes
  ✓ Quick fix fails and alternative unknown
  ✓ Requires infrastructure change (scale up, etc.)
  ✓ Requires database migration or data change
  ✓ Affects paying customers

ESCALATE WITHIN 15 MINUTES if:
  ✓ P2 severity (partial outage)
  ✓ On-call cannot fix within 30 minutes
  ✓ Requires temporary workaround longer than 1 hour

ESCALATE WITHIN 1 HOUR if:
  ✓ P3 severity (degraded performance)
  ✓ Will require planned maintenance
  ✓ Likely to recur without permanent fix
```

---

## On-Call Handoff Template

```
INCOMING ON-CALL ENGINEER:
  ☐ Check PagerDuty for active incidents
  ☐ Review Grafana dashboard trends (last 24 hours)
  ☐ Read Slack #incidents (last 7 days)
  ☐ Run health check:
     kubectl get nodes
     kubectl get pods -n production
  ☐ Verify communication channels working
  ☐ Confirm phone number in PagerDuty

OUTGOING ON-CALL ENGINEER:
  ☐ Brief incoming on any ongoing issues
  ☐ Transfer PagerDuty primary to incoming
  ☐ Review any recent incidents during shift
  ☐ Pass on any context not in documentation
  ☐ Confirm incoming ready to take over
```

---

## Status: ✅ Enterprise-Grade Operations Documentation

All runbooks, playbooks, and procedures documented for zero-error incident response.

# ✅ چک‌لیست آماده‌سازی برای استقرار فوری

**تاریخ**: 20 نوامبر 2025 | **وضعیت**: 🟢 READY

---

## 🔴 آماده‌سازی قبل از استقرار (Before Deployment)

### ☑️ تأیید Infrastructure

- [ ] AKS cluster فعال است (`kubectl cluster-info`)
- [ ] PostgreSQL database دسترس‌پذیر است
- [ ] Redis cache متصل است
- [ ] Storage account کار می‌کند
- [ ] Key Vault accessible است
- [ ] Load Balancer IP مشخص است
- [ ] DNS entries update شده‌اند
- [ ] SSL certificates valid هستند

### ☑️ تأیید Secrets & Configuration

- [ ] Database password در Key Vault موجود
- [ ] JWT secret تنظیم شده
- [ ] API keys برای services موجود
- [ ] Environment variables تنظیم شده
- [ ] Rate limiting rules loaded
- [ ] WAF rules configured
- [ ] Monitoring credentials ready

### ☑️ تأیید Backup & DR

- [ ] Latest backup تست شده
- [ ] Restore procedure validated
- [ ] RTO/RPO documented
- [ ] Backup schedule active
- [ ] Disaster recovery plan reviewed

### ☑️ تأیید Monitoring & Alerts

- [ ] Prometheus running
- [ ] Grafana dashboards loaded
- [ ] AlertManager configured
- [ ] PagerDuty integration active
- [ ] Notification channels tested
- [ ] Thresholds verified

### ☑️ تأیید Team & Communication

- [ ] On-call engineer assigned
- [ ] Incident channel prepared (#incidents)
- [ ] Deployment channel (#deployments)
- [ ] Communication template ready
- [ ] Escalation contacts confirmed
- [ ] Runbooks reviewed by team
- [ ] All team members trained

---

## 🟡 مرحله 1: Canary Deployment (10%)

### قبل از شروع

- [ ] تمام prerequisites تکمیل شده
- [ ] Deployment plan approved
- [ ] Team in place (on-call, engineers)
- [ ] Communications open

### Deploy Steps

```bash
# Step 1: تمام pods موجود هستند؟
kubectl get pods -n production --watch

# Step 2: Helm chart deploy (10%)
helm install nextgen ./helm/nextgen \
  --namespace production \
  --values ./helm/values-canary.yaml

# Step 3: Check rollout status
kubectl rollout status deployment/nextgen-api -n production

# Step 4: Verify services are ready
kubectl get svc -n production
kubectl get ingress -n production
```

### Validation (5 minutes)

- [ ] API responding to health checks
- [ ] Database connections successful
- [ ] Errors rate < 0.1%
- [ ] Latency normal
- [ ] No memory leaks
- [ ] Cache working
- [ ] Logs clean

### Monitoring

```
Watch Dashboard: Grafana → Deployments → NextGen
Metrics to Monitor:
├─ Request/sec: Should be ~10% of normal
├─ Error rate: Should be 0%
├─ Latency p99: Should be normal
├─ CPU: Should be < 50%
├─ Memory: Should be stable
└─ Pod restarts: Should be 0
```

### ✅ Decision: Continue?

- **YES** ✅ → Proceed to 25%
- **NO** ❌ → Rollback immediately

---

## 🟡 مرحله 2: Canary 25%

### Deploy Steps

```bash
# Scale to 25%
kubectl set image deployment/nextgen-api \
  nextgen-api=nextgen:NEW_VERSION \
  -n production

# Watch rollout
kubectl rollout status deployment/nextgen-api -n production --watch
```

### Validation (5 minutes)

- [ ] Request/sec at ~25% of baseline
- [ ] Error rate < 0.5%
- [ ] Latency normal
- [ ] Database load increasing gradually
- [ ] No error spikes
- [ ] Memory stable
- [ ] CPU < 60%

### ✅ Decision: Continue?

- **YES** ✅ → Proceed to 50%
- **NO** ❌ → Rollback

---

## 🟡 مرحله 3: Canary 50%

### Deploy Steps

```bash
# Scale to 50%
kubectl scale deployment/nextgen-api \
  --replicas=5 -n production
```

### Validation (5 minutes)

- [ ] Request/sec at 50%
- [ ] Error rate stable < 0.1%
- [ ] Latency p95 < 300ms
- [ ] Latency p99 < 1000ms
- [ ] Database queries normal
- [ ] Cache hit rate good
- [ ] Pod health: All Running

### ✅ Decision: Continue?

- **YES** ✅ → Proceed to 100%
- **NO** ❌ → Rollback

---

## 🟢 مرحله 4: Full Production (100%)

### Deploy Steps

```bash
# Scale to 100%
kubectl scale deployment/nextgen-api \
  --replicas=10 -n production

# Verify all pods running
kubectl get pods -n production -l app=nextgen-api
```

### Final Validation (10 minutes)

- [ ] Request/sec at normal baseline
- [ ] Error rate < 0.1%
- [ ] Latency p99 < 1000ms
- [ ] All 10 pods Running
- [ ] Database load normal
- [ ] CPU utilization 40-60%
- [ ] Memory stable
- [ ] Cache working efficiently
- [ ] No warnings in logs

### Post-Deployment Checks

```bash
# Check pod logs for any errors
kubectl logs deployment/nextgen-api -n production --all-containers=true

# Verify API endpoints
curl -H "Authorization: Bearer $TOKEN" \
  https://api.nextgen.local/health

# Check database connectivity
kubectl exec -it deployment/nextgen-api -n production -- \
  nc -zv postgres.database.azure.com 5432

# Verify cache
kubectl exec -it deployment/nextgen-api -n production -- \
  redis-cli -h redis.cache.azure.com ping
```

---

## ⚠️ Rollback Plan (اگر مشکل پیدا شد)

### Automatic Rollback

```bash
# If issues detected, auto-trigger rollback
kubectl rollout undo deployment/nextgen-api -n production

# Verify rollback
kubectl rollout status deployment/nextgen-api -n production
```

### Manual Rollback (اگر خودکار کار نکرد)

```bash
# 1. Stop current deployment
kubectl patch deployment nextgen-api -n production \
  -p '{"spec":{"replicas":0}}'

# 2. Deploy previous version
helm install nextgen ./helm/nextgen \
  --namespace production \
  --values ./helm/values-production.yaml \
  --set image.tag=PREVIOUS_TAG

# 3. Scale back up
kubectl scale deployment/nextgen-api \
  --replicas=10 -n production

# 4. Verify
kubectl rollout status deployment/nextgen-api -n production
```

---

## 📊 Monitoring Dashboard URLs

```
Grafana Dashboard:    https://grafana.nextgen.local
├─ Overview:        Production → Overview
├─ API Metrics:     Production → API Performance
├─ Database:        Production → PostgreSQL
├─ Cache:           Production → Redis
└─ Infrastructure:  Production → Kubernetes

Prometheus:          https://prometheus.nextgen.local
├─ Targets:         Status → Targets
├─ Alerts:          Alerts
└─ Graph:           Graph

AlertManager:        https://alertmanager.nextgen.local
├─ Active Alerts:   See all alerts
├─ Routing:         Alert routing rules
└─ Silences:        Manage silences

Kibana Logs:         https://kibana.nextgen.local
├─ Logs:            Discover
├─ Dashboards:      Dashboards
└─ Alerts:          Stack Management → Rules
```

---

## 📞 Emergency Contacts

```
On-Call Engineer:    @on-call (Slack)
Engineering Manager: @eng-manager (Slack)
DevOps Lead:         @devops (Slack)
CTO:                 @cto (Slack)

Channels:
#deployments         - Deployment notifications
#incidents           - Incident discussion
#monitoring          - Alert escalation
#technical-questions - Technical support
```

---

## 🔍 Post-Deployment Health Check (30 minutes)

### 5-minute mark

- [ ] Error rate still < 0.1%
- [ ] Latency stable
- [ ] No pod restarts
- [ ] Database queries normal
- [ ] Cache working

### 15-minute mark

- [ ] All business transactions processing
- [ ] No alert storms
- [ ] User reports normal
- [ ] Database replication lag < 1 second
- [ ] Cache hit rate > 70%

### 30-minute mark

- [ ] System fully stabilized
- [ ] All metrics normal
- [ ] No pending issues
- [ ] Team confidence high
- [ ] Ready to close deployment

### ✅ Deployment Successful!

Document in:
```markdown
**Deployment Date**: 2025-11-20
**Version**: v3.1.0
**Duration**: XX minutes
**Status**: ✅ SUCCESS
**Errors**: 0
**Incidents**: 0
**Rollbacks**: 0
**Team Lead**: [Name]
```

---

## 📋 Common Commands During Deployment

```bash
# Check overall status
kubectl get all -n production

# Check pod status
kubectl get pods -n production

# View logs in real-time
kubectl logs -f deployment/nextgen-api -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'

# Describe a pod
kubectl describe pod [POD_NAME] -n production

# Execute command in pod
kubectl exec -it [POD_NAME] -n production -- bash

# Check resource usage
kubectl top nodes
kubectl top pods -n production

# Check scaling status
kubectl get hpa -n production

# Rollout history
kubectl rollout history deployment/nextgen-api -n production

# Get deployment details
kubectl get deployment nextgen-api -n production -o wide

# Check ingress
kubectl get ingress -n production

# Check services
kubectl get svc -n production
```

---

## ✅ نتیجه نهایی

**هنگام تکمیل استقرار:**

1. ✅ همه مراحل completed
2. ✅ تمام validations passed
3. ✅ سیستم stable
4. ✅ team confident
5. ✅ **Deployment SUCCESSFUL** 🎉

---

**چک‌لیست توسط**: Deployment Team  
**تاریخ**: 20 نوامبر 2025  
**وضعیت**: ✅ READY FOR DEPLOYMENT

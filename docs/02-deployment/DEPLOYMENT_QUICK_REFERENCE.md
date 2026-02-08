# ⚡ QUICK REFERENCE: Deployment Commands

**Ready Date**: November 20, 2025 | **Status**: ✅ READY

---

## 🚀 ONE-MINUTE DEPLOYMENT

```bash
# Copy and paste these commands to deploy immediately:

# 1. Verify cluster (30 seconds)
kubectl cluster-info
kubectl get nodes

# 2. Deploy (1-2 minutes)
helm install nextgen ./helm/nextgen \
  --namespace production \
  --create-namespace \
  --values ./helm/values-prod.yaml

# 3. Monitor (5 minutes)
kubectl get pods -n production --watch
kubectl logs -f deployment/nextgen-api -n production

# DONE! ✅
```

---

## 📋 DEPLOYMENT PHASES

### Phase 1: Canary 10% (5 min)
```bash
kubectl scale deployment/nextgen-api --replicas=1 -n production
# Monitor error rate < 0.1%, latency normal
# Decision: Continue? Yes → Phase 2
```

### Phase 2: Canary 25% (5 min)
```bash
kubectl scale deployment/nextgen-api --replicas=3 -n production
# Monitor metrics
# Decision: Continue? Yes → Phase 3
```

### Phase 3: Canary 50% (5 min)
```bash
kubectl scale deployment/nextgen-api --replicas=5 -n production
# Monitor metrics
# Decision: Continue? Yes → Phase 4
```

### Phase 4: Full Production 100% (5 min)
```bash
kubectl scale deployment/nextgen-api --replicas=10 -n production
# Monitor for 10 minutes
# Deployment complete! ✅
```

---

## 🔍 VALIDATION COMMANDS

### Health Check
```bash
curl https://api.nextgen.local/health
# Expected: {"status":"ok"}
```

### Database Connection
```bash
kubectl exec -it deployment/nextgen-api -n production -- \
  psql "postgresql://user:pass@postgres.db/nextgen" -c "SELECT version();"
```

### Cache Status
```bash
kubectl exec -it deployment/nextgen-api -n production -- \
  redis-cli -h redis.cache ping
```

### Monitoring Dashboard
```
Grafana: https://grafana.nextgen.local
Username: admin
Dashboard: Production → Overview
```

---

## ⚠️ EMERGENCY ROLLBACK

```bash
# If issues detected, immediately execute:
kubectl rollout undo deployment/nextgen-api -n production

# Verify rollback
kubectl rollout status deployment/nextgen-api -n production

# Scale down problematic version
kubectl patch deployment nextgen-api -n production \
  -p '{"spec":{"replicas":0}}'
```

---

## 📊 MONITORING CHECKLIST

During deployment, monitor these metrics:

```
✓ Error Rate:      < 0.1%          (Check every 1 min)
✓ Latency p99:     < 1000ms        (Check every 1 min)
✓ CPU Usage:       < 70%           (Check every 2 min)
✓ Memory Usage:    < 80%           (Check every 2 min)
✓ Pod Status:      All "Running"   (Check every 1 min)
✓ Restarts:        0 per pod       (Check every 2 min)
✓ DB Connections:  < 80 available  (Check every 2 min)
✓ Cache Hit Rate:  > 70%           (Check every 2 min)
```

---

## 🛠️ COMMON TASKS

### View Logs
```bash
# All pods
kubectl logs deployment/nextgen-api -n production -f

# Specific pod
kubectl logs POD_NAME -n production -f

# Previous crashed pod
kubectl logs POD_NAME -n production --previous
```

### Execute Command
```bash
kubectl exec -it deployment/nextgen-api -n production -- bash
```

### Describe Resources
```bash
kubectl describe pod POD_NAME -n production
kubectl describe deployment nextgen-api -n production
kubectl describe svc nextgen-api -n production
```

### Check Events
```bash
kubectl get events -n production --sort-by='.lastTimestamp'
```

### Resource Usage
```bash
kubectl top nodes
kubectl top pods -n production
```

### Scaling
```bash
# Manual scale
kubectl scale deployment/nextgen-api --replicas=5 -n production

# Check HPA status
kubectl get hpa -n production
kubectl describe hpa nextgen-api-hpa -n production
```

---

## 📞 QUICK CONTACTS

```
🚨 EMERGENCY:
   On-Call: @on-call (Slack)
   
👔 MANAGEMENT:
   Manager: @eng-manager (Slack)
   CTO: @cto (Slack)
   
💬 CHANNELS:
   Deployments: #deployments
   Incidents: #incidents
   Monitoring: #monitoring
```

---

## ✅ PRE-DEPLOYMENT CHECKLIST (Last 2 minutes)

```
☑ AKS cluster running
☑ Database accessible
☑ Redis cache available
☑ Secrets in Key Vault
☑ DNS updated
☑ SSL certificates valid
☑ Team in Slack channels
☑ Monitoring dashboards open
☑ Alert channels configured
☑ Rollback procedure reviewed
☑ Ready to deploy!
```

---

## 🎯 SUCCESS CRITERIA (After 30 minutes)

```
✅ All pods Running
✅ Error rate < 0.1%
✅ Latency normal
✅ No pod restarts
✅ Users accessing application
✅ No alert storms
✅ Database replication healthy
✅ Cache hit rate > 70%
✅ Deployment successful!
```

---

## 📚 DOCUMENTATION LINKS

```
Full Deployment Guide:
→ ops/RUNBOOKS_AND_PLAYBOOKS.md

Pre-Deployment Verification:
→ PRE_DEPLOYMENT_VERIFICATION.md

Deployment Checklist (Persian):
→ DEPLOYMENT_CHECKLIST_PERSIAN.md

Final Ready Summary (Persian):
→ FINAL_READY_SUMMARY_PERSIAN.md

This Quick Reference:
→ DEPLOYMENT_QUICK_REFERENCE.md

Architecture Diagrams:
→ docs/C4_ARCHITECTURE_DIAGRAMS.md

API Documentation:
→ contracts/api.openapi.yaml
```

---

## 🚀 START DEPLOYMENT

```bash
# Copy this entire block and run:

#!/bin/bash

echo "🚀 Starting NextGen Market Platform Deployment..."
echo ""

# Verify cluster
echo "1️⃣  Verifying cluster..."
kubectl cluster-info
kubectl get nodes

# Create namespace
echo ""
echo "2️⃣  Creating namespace..."
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -

# Deploy with Helm
echo ""
echo "3️⃣  Deploying application..."
helm install nextgen ./helm/nextgen \
  --namespace production \
  --values ./helm/values-prod.yaml

# Wait for deployment
echo ""
echo "4️⃣  Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod \
  -l app=nextgen-api \
  -n production \
  --timeout=300s

# Verify deployment
echo ""
echo "5️⃣  Verifying deployment..."
kubectl get all -n production

echo ""
echo "✅ Deployment complete!"
echo "🎯 Grafana: https://grafana.nextgen.local"
echo "📊 Prometheus: https://prometheus.nextgen.local"
echo ""
```

---

**Ready to deploy?** ✅ YES!  
**Any problems?** See docs links above  
**Need support?** Contact @on-call  

**Status**: 🟢 READY FOR DEPLOYMENT  
**Date**: November 20, 2025  
**Time**: NOW! 🚀

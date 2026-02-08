# 🔐 Network Policies - Zero-Trust Architecture

## Overview

Complete network segmentation and Zero-Trust model for AKS following Microsoft Azure best practices.

```
Zero-Trust Principle: Never trust, always verify
├─ All traffic denied by default
├─ Explicit allow rules for each flow
├─ Namespace isolation
├─ Service-to-service authentication
└─ Network policy enforcement
```

---

## 1. Default Deny Policy

### Block All Ingress & Egress

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production

spec:
  podSelector: {}  # Applies to all pods
  policyTypes:
  - Ingress
  - Egress
  
  ingress: []  # No ingress allowed
  egress: []   # No egress allowed
```

**Effect**:
- ❌ All incoming traffic denied
- ❌ All outgoing traffic denied
- ✅ Pods can only communicate if explicitly allowed

---

## 2. Allow DNS Egress

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: production

spec:
  podSelector: {}  # All pods
  policyTypes:
  - Egress
  
  egress:
  # Allow DNS queries to kube-dns
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

---

## 3. API Service - Ingress/Egress

### Inbound: Accept requests from Ingress & Load Balancer

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: nextgen-api-ingress
  namespace: production

spec:
  podSelector:
    matchLabels:
      app: nextgen-api
  
  policyTypes:
  - Ingress
  
  ingress:
  # From Ingress Controller
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  
  # From Load Balancer (Azure LB)
  - from:
    - podSelector: {}  # From any pod in cluster
    ports:
    - protocol: TCP
      port: 3000
```

### Outbound: Connect to Database & Cache

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: nextgen-api-egress
  namespace: production

spec:
  podSelector:
    matchLabels:
      app: nextgen-api
  
  policyTypes:
  - Egress
  
  egress:
  # DNS resolution
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
  
  # PostgreSQL
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  
  # Redis Cache
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  
  # External API calls (egress to internet)
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

---

## 4. Database (PostgreSQL) - Strict Access

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-network-policy
  namespace: production

spec:
  podSelector:
    matchLabels:
      app: postgres
  
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # Only from API pods
  - from:
    - podSelector:
        matchLabels:
          app: nextgen-api
    ports:
    - protocol: TCP
      port: 5432
  
  # From backup pod
  - from:
    - podSelector:
        matchLabels:
          app: backup-agent
    ports:
    - protocol: TCP
      port: 5432
  
  # From monitoring
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
      podSelector:
        matchLabels:
          app: prometheus
    ports:
    - protocol: TCP
      port: 9187  # postgres-exporter
  
  egress:
  # DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  
  # Database replication (other DB pods)
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

---

## 5. Cache (Redis) - Limited Access

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-network-policy
  namespace: production

spec:
  podSelector:
    matchLabels:
      app: redis
  
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # From API pods only
  - from:
    - podSelector:
        matchLabels:
          app: nextgen-api
    ports:
    - protocol: TCP
      port: 6379
  
  # From Redis cluster peers
  - from:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
    - protocol: TCP
      port: 16379  # Redis cluster bus
  
  egress:
  # DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  
  # Cluster communication
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
    - protocol: TCP
      port: 16379
```

---

## 6. Monitoring (Prometheus) - Metrics Collection

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prometheus-network-policy
  namespace: monitoring

spec:
  podSelector:
    matchLabels:
      app: prometheus
  
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # From Grafana
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
      podSelector:
        matchLabels:
          app: grafana
    ports:
    - protocol: TCP
      port: 9090
  
  # From AlertManager
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
      podSelector:
        matchLabels:
          app: alertmanager
    ports:
    - protocol: TCP
      port: 9090
  
  egress:
  # DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  
  # Scrape metrics from all pods
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 9090
    - protocol: TCP
      port: 9091
    - protocol: TCP
      port: 9187
    - protocol: TCP
      port: 8080
```

---

## 7. Ingress Controller - North-South Traffic

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ingress-nginx-policy
  namespace: ingress-nginx

spec:
  podSelector:
    matchLabels:
      app: ingress-nginx
  
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # From external clients (anywhere)
  - from:
    - ipBlock:
        cidr: 0.0.0.0/0  # Any external IP
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
  
  egress:
  # DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  
  # Forward to backend services
  - to:
    - podSelector: {}
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 8080
```

---

## 8. Cross-Namespace Communication

### Allow specific namespaces to communicate

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-cross-namespace
  namespace: production

spec:
  podSelector:
    matchLabels:
      app: nextgen-api
  
  policyTypes:
  - Ingress
  
  ingress:
  # From monitoring namespace
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
      podSelector:
        matchLabels:
          app: prometheus
    ports:
    - protocol: TCP
      port: 9090
```

---

## 9. IP-Based Rules (External Services)

### Access external APIs

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-api
  namespace: production

spec:
  podSelector:
    matchLabels:
      app: nextgen-api
  
  policyTypes:
  - Egress
  
  egress:
  # Allow to external APIs (specific IPs)
  - to:
    - ipBlock:
        cidr: 1.2.3.4/32  # External service IP
      except:
      - 1.2.3.5/32  # Except this IP
    ports:
    - protocol: TCP
      port: 443
```

---

## 10. Service Mesh Integration (Istio/Linkerd)

### Network Policy + Service Mesh

```yaml
# Istio PeerAuthentication for mTLS
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production

spec:
  mtls:
    mode: STRICT  # Enforce mTLS between all pods
  
  portLevelMtls:
    "9187":
      mode: DISABLE  # Prometheus metrics (no mTLS)

---
# Istio AuthorizationPolicy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-authz-policy
  namespace: production

spec:
  rules:
  # Allow requests from Ingress
  - from:
    - source:
        principals:
        - "cluster.local/ns/ingress-nginx/sa/nginx-ingress"
    to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/*"]
  
  # Allow database access
  - from:
    - source:
        principals:
        - "cluster.local/ns/production/sa/nextgen-api"
    to:
    - operation:
        ports: ["5432"]
```

---

## 11. Testing Network Policies

### Verify traffic flows

```bash
# Test connectivity from API to DB
kubectl run -it test-pod --image=ubuntu:latest -- bash
root@test-pod:~# apt-get update && apt-get install -y postgresql-client
root@test-pod:~# psql -h postgres.production.svc.cluster.local -U postgres -d nextgen

# Test DNS resolution
root@test-pod:~# nslookup postgres.production.svc.cluster.local

# Check allowed policies
kubectl get networkpolicies -n production
kubectl describe networkpolicy nextgen-api-ingress -n production
```

### Simulate policy violations

```bash
# Try to connect from unauthorized pod (should fail)
kubectl run -it rogue-pod \
  --image=ubuntu:latest \
  -n production \
  -- bash
root@rogue-pod:~# curl http://postgres.production.svc.cluster.local:5432
# Result: timeout or refused
```

---

## 12. Monitoring Network Policies

### Prometheus metrics

```promql
# Denied connections (if using Cilium)
cilium_drop_count_total

# Policy violations logged
count(rate(container_network_policy_violations_total[5m]))

# Successful connections
cilium_forward_count_total
```

### Logging denied traffic

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: log-denied-traffic
  namespace: production
  annotations:
    description: "Log all denied connections"

spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  
  # Empty rules = deny all + log
  ingress: []
  egress: []
```

---

## 13. Rollout Strategy

### Phase 1: Audit Mode (Week 1)

```bash
# Create default-deny in audit mode
# Monitor logs for violations
kubectl logs -n production -l app=nextgen-api | grep -i denied
```

### Phase 2: Warn Mode (Week 2)

```bash
# Apply policies without enforcement
# Document violations
# Update workloads
```

### Phase 3: Enforce Mode (Week 3+)

```bash
# Enable full enforcement
# Monitor pod restarts
# Respond to incidents
```

---

## 14. Best Practices

```
1. Start with default deny
   └─ Explicitly allow only needed traffic

2. Use namespaces for isolation
   └─ Separate security domains

3. Label pods correctly
   └─ Consistent labels for selectors

4. Document every rule
   └─ Why it exists, what it allows

5. Test before enforcing
   └─ Audit mode → warn → enforce

6. Monitor continuously
   └─ Alert on denied traffic

7. Use service mesh (optional but recommended)
   └─ Adds mTLS + better observability

8. Review policies regularly
   └─ Remove obsolete rules
   └─ Update for new services
```

---

## Complete Production Example

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: production-zero-trust
  namespace: production

spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  
  # Deny all by default
  ingress: []
  egress: []

---
# Allow DNS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production

spec:
  podSelector: {}
  policyTypes:
  - Egress
  
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53

---
# API to Database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-to-db
  namespace: production

spec:
  podSelector:
    matchLabels:
      app: nextgen-api
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

---

## Summary

```
✅ Default Deny: Block all traffic
✅ Explicit Allow: Only needed flows
✅ Namespace Isolation: Security domains
✅ Service-to-Service: mTLS with service mesh
✅ Monitoring: Detect violations
✅ Gradual Rollout: Audit → Warn → Enforce
```

**Status**: 🟢 Ready for production AKS

# 📊 Resource Governance - Limits, Requests, HPA, VPA

## Overview

Precise resource management for production AKS clusters with proper sizing, autoscaling, and cost optimization.

---

## 1. Resource Requests & Limits

### Definition

```yaml
resources:
  requests:      # Minimum guaranteed resources
    cpu: "500m"        # 0.5 CPU cores
    memory: "512Mi"    # 512 megabytes
    ephemeral-storage: "1Gi"
  
  limits:        # Maximum allowed resources
    cpu: "1000m"       # 1 CPU core
    memory: "1Gi"      # 1 gigabyte
    ephemeral-storage: "2Gi"
```

**requests**: Scheduler uses for node placement (reserved)  
**limits**: Kernel enforces (container killed if exceeded)

### CPU Units

```yaml
1000m = 1 CPU core = 1000 millicores
500m  = 0.5 CPU cores
100m  = 0.1 CPU cores (100 millicores)
```

### Memory Units

```yaml
1Gi = 1024 MiB (gibibyte)
512Mi = 512 MiB (mebibyte)
1G = 1000 MB (decimal, don't use for K8s)
```

---

## 2. Tier-Based Resource Sizing

### Production API Service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nextgen-api
  namespace: production
  labels:
    tier: api
    environment: production

spec:
  replicas: 3
  
  template:
    metadata:
      labels:
        app: nextgen-api
        tier: api
    
    spec:
      # Pod disruption budget
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - nextgen-api
              topologyKey: kubernetes.io/hostname
      
      containers:
      - name: api
        image: ghcr.io/nextgen-market/nextgen-market:v1.0.0
        
        resources:
          # Requests (guaranteed + schedulable)
          requests:
            cpu: "500m"          # Half a core
            memory: "512Mi"      # 512 MB
            ephemeral-storage: "1Gi"
          
          # Limits (maximum allowed)
          limits:
            cpu: "1000m"         # 1 core (100% if under load)
            memory: "1Gi"        # 1 GB (may be killed if exceeded)
            ephemeral-storage: "2Gi"
        
        # Probes for health
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 1
          failureThreshold: 2
```

### Database (PostgreSQL StatefulSet)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: production

spec:
  serviceName: postgres
  replicas: 3  # High availability
  
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        
        resources:
          requests:
            cpu: "1000m"          # 1 core
            memory: "2Gi"         # 2 GB
            ephemeral-storage: "5Gi"
          
          limits:
            cpu: "2000m"          # 2 cores
            memory: "4Gi"         # 4 GB
            ephemeral-storage: "10Gi"
        
        # Database-specific probes
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Cache (Redis StatefulSet)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: production

spec:
  serviceName: redis
  replicas: 3

  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        
        resources:
          requests:
            cpu: "250m"           # Quarter core
            memory: "256Mi"       # 256 MB
          
          limits:
            cpu: "500m"           # Half core
            memory: "512Mi"       # 512 MB
        
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
```

---

## 3. Resource Quotas (Namespace-Level)

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production

spec:
  hard:
    # CPU limits
    requests.cpu: "20"           # Total 20 cores
    limits.cpu: "40"             # Total 40 cores
    
    # Memory limits
    requests.memory: "40Gi"      # Total 40 GB
    limits.memory: "80Gi"        # Total 80 GB
    
    # Pod count
    pods: "100"                  # Max 100 pods
    
    # Persistent volume claims
    persistentvolumeclaims: "10"
    
    # Services
    services: "20"
    services.nodeports: "5"
    
    # Storage
    requests.storage: "500Gi"    # 500 GB total
    
  scopeSelector:
    matchExpressions:
    - operator: In
      scopeName: PriorityClass
      values:
      - high-priority
      - medium-priority

status:
  hard:
    limits.cpu: "40"
    limits.memory: "80Gi"
    persistentvolumeclaims: "10"
    pods: "100"
    requests.cpu: "20"
    requests.memory: "40Gi"
    requests.storage: "500Gi"
    services: "20"
    services.nodeports: "5"
  used:
    limits.cpu: "12"
    limits.memory: "24Gi"
    persistentvolumeclaims: "5"
    pods: "42"
    requests.cpu: "8"
    requests.memory: "16Gi"
    requests.storage: "150Gi"
    services: "8"
    services.nodeports: "2"
```

---

## 4. Limit Ranges (Per-Pod)

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: production-limits
  namespace: production

spec:
  limits:
  # Container defaults and limits
  - max:
      cpu: "2000m"
      memory: "4Gi"
      ephemeral-storage: "10Gi"
    min:
      cpu: "100m"
      memory: "128Mi"
      ephemeral-storage: "100Mi"
    default:
      cpu: "500m"
      memory: "512Mi"
      ephemeral-storage: "1Gi"
    defaultRequest:
      cpu: "250m"
      memory: "256Mi"
      ephemeral-storage: "500Mi"
    type: Container
  
  # Pod-level limits
  - max:
      cpu: "4000m"
      memory: "8Gi"
    min:
      cpu: "200m"
      memory: "256Mi"
    type: Pod
  
  # PVC size limits
  - max:
      storage: "100Gi"
    min:
      storage: "1Gi"
    type: PersistentVolumeClaim
```

---

## 5. Horizontal Pod Autoscaler (HPA)

### CPU-Based Scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nextgen-api-hpa
  namespace: production

spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nextgen-api
  
  # Scaling bounds
  minReplicas: 3
  maxReplicas: 10
  
  metrics:
  # Scale on CPU usage
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Target 70% CPU
  
  # Scale on memory usage
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80  # Target 80% memory
  
  # Behavior policies
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min
      policies:
      - type: Percent
        value: 50  # Scale down by 50%
        periodSeconds: 60
      - type: Pods
        value: 2  # Remove max 2 pods
        periodSeconds: 60
      selectPolicy: Min
    
    scaleUp:
      stabilizationWindowSeconds: 0  # Immediate scale up
      policies:
      - type: Percent
        value: 100  # Add 100% (double)
        periodSeconds: 30
      - type: Pods
        value: 4  # Add max 4 pods
        periodSeconds: 30
      selectPolicy: Max
```

### Custom Metrics Scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nextgen-api-advanced-hpa

spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nextgen-api
  
  minReplicas: 3
  maxReplicas: 20
  
  metrics:
  # CPU utilization
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  
  # Memory utilization
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  
  # Custom metric: Requests per second
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1k"  # 1000 req/s per pod
  
  # Custom metric: Queue depth
  - type: Pods
    pods:
      metric:
        name: queue_depth
      target:
        type: AverageValue
        averageValue: "30"  # 30 items per pod
```

---

## 6. Vertical Pod Autoscaler (VPA)

### Right-Sizing Recommendations

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: nextgen-api-vpa

spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nextgen-api
  
  # Update mode
  updatePolicy:
    updateMode: "Auto"  # Options: Off, Initial, Recreate, Auto
  
  resourcePolicy:
    containerPolicies:
    - containerName: api
      controlledResources:
      - cpu
      - memory
      
      # Allow scaling only within these bounds
      minAllowed:
        cpu: 100m
        memory: 128Mi
      
      maxAllowed:
        cpu: 2000m
        memory: 2Gi
      
      # Minimum increase before VPA takes action
      controlledValues: RequestsAndLimits
```

### Recommendation Output

```bash
$ kubectl get vpa nextgen-api-vpa --output yaml

status:
  recommendation:
    containerRecommendations:
    - containerName: api
      lowerBound:
        cpu: 400m
        memory: 384Mi
      target:
        cpu: 500m
        memory: 512Mi
      upperBound:
        cpu: 700m
        memory: 768Mi
```

---

## 7. Pod Disruption Budgets (PDB)

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: nextgen-api-pdb
  namespace: production

spec:
  minAvailable: 2  # Keep at least 2 pods running
  selector:
    matchLabels:
      app: nextgen-api
  
  unhealthyPodEvictionPolicy: IfHealthyBudget
```

### Alternative: Max Unavailable

```yaml
spec:
  maxUnavailable: 1  # Allow 1 pod down
  selector:
    matchLabels:
      app: nextgen-api
```

---

## 8. Priority Classes

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority

value: 1000
globalDefault: false
description: "High priority for critical services"

---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: medium-priority

value: 500
globalDefault: false
description: "Medium priority for standard services"

---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: low-priority

value: 100
globalDefault: true
description: "Low priority for batch jobs"
```

### Using Priority Classes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nextgen-api

spec:
  template:
    spec:
      priorityClassName: high-priority
      containers:
      - name: api
        image: nextgen-market:v1.0.0
```

---

## 9. Monitoring & Observability

### Prometheus Queries

```promql
# CPU utilization
sum(rate(container_cpu_usage_seconds_total{namespace="production"}[5m])) by (pod)

# Memory utilization
sum(container_memory_working_set_bytes{namespace="production"}) by (pod)

# Node capacity
sum(kube_node_labels{label_kubernetes_io_os="linux"}) by (node)

# Pod requests vs usage
container_spec_cpu_shares{namespace="production"} / 1024
container_memory_request_bytes{namespace="production"}
```

### Alerts

```yaml
- alert: PodMemoryUsageHigh
  expr: |
    (container_memory_working_set_bytes / container_spec_memory_limit_bytes) > 0.9
  for: 5m
  annotations:
    summary: "Pod {{ $labels.pod }} memory usage > 90%"

- alert: PodCPUThrottling
  expr: |
    rate(container_cpu_cfs_throttled_seconds_total[5m]) > 0.1
  annotations:
    summary: "Pod {{ $labels.pod }} CPU throttled"

- alert: HPA ScalingLimit
  expr: |
    kube_hpa_status_desired_replicas == kube_hpa_status_max_replicas
  for: 10m
  annotations:
    summary: "HPA {{ $labels.hpa }} at max replicas"
```

---

## 10. Sizing Matrix

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|------------|-----------|-----------------|------------|
| API Pod | 500m | 1000m | 512Mi | 1Gi |
| DB Pod | 1000m | 2000m | 2Gi | 4Gi |
| Cache Pod | 250m | 500m | 256Mi | 512Mi |
| Nginx Ingress | 100m | 500m | 128Mi | 512Mi |
| Prometheus | 500m | 2000m | 1Gi | 2Gi |
| Grafana | 100m | 500m | 256Mi | 512Mi |

---

## Implementation Checklist

```
☐ Set resource requests for all containers
☐ Set resource limits (typically 2x requests)
☐ Create ResourceQuota per namespace
☐ Create LimitRange per namespace
☐ Configure HPA (min 2, max based on capacity)
☐ Deploy VPA in recommendation mode
☐ Create PDB for critical services
☐ Define PriorityClasses
☐ Set up monitoring (Prometheus)
☐ Configure alerts (AlertManager)
☐ Test scaling behavior
☐ Document sizing assumptions
```

---

## Summary

```
Requests:  Scheduler uses for placement (reserved)
Limits:    Kernel enforces (container killed if exceeded)
HPA:       Auto-scale based on metrics (CPU, memory, custom)
VPA:       Right-sizing recommendations
PDB:       Protect from voluntary disruptions
Quotas:    Namespace-level resource limits
```

✅ Ready for production AKS deployment

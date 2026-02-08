# 🔒 Pod Security Standards - Baseline to Restricted

## Overview

Progressive security posture for Kubernetes workloads following AKS best practices.

```
Level 1: BASELINE (Default - Permissive)
  └─ Allows known privilege escalations

Level 2: RESTRICTED (Tight - Recommended for production)
  └─ Enforces current best practices
  └─ May break some legacy workloads

Level 3: CUSTOM (Fine-grained - Per-workload)
  └─ Tailored policies per namespace/pod
```

---

## Pod Security Standards Levels

### Level 1: Baseline

**Use Case**: Development, permissive environments

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: baseline
spec:
  # Privileged access allowed
  privileged: true
  
  # Host networking allowed
  hostNetwork: true
  hostIPC: true
  hostPID: true
  
  # Capabilities allowed
  allowPrivilegeEscalation: true
  
  # SELinux not required
  seLinux:
    rule: RunAsAny
  
  # RunAsUser not required
  runAsUser:
    rule: RunAsAny
  
  # Root filesystem can be writable
  readOnlyRootFilesystem: false
  
  # All volumes allowed
  volumes:
    - '*'
```

**Allowed**:
- Privileged containers
- Host access (network, IPC, PID)
- Capability escalation
- Any user/group
- Writable root filesystem
- Any volume type

**Risk Level**: 🔴 HIGH

---

### Level 2: Restricted (PRODUCTION)

**Use Case**: Production, security-sensitive environments

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  # NO privileged access
  privileged: false
  
  # NO host access
  hostNetwork: false
  hostIPC: false
  hostPID: false
  
  # NO privilege escalation
  allowPrivilegeEscalation: false
  
  # Drop dangerous capabilities
  requiredDropCapabilities:
    - ALL
  
  # Add only necessary capabilities
  allowedCapabilities:
    - NET_BIND_SERVICE
  
  # Force non-root
  runAsUser:
    rule: MustRunAsNonRoot
  
  # SELinux enforced
  seLinux:
    rule: MustRunAs
    seLinuxOptions:
      level: "s0:c123,c456"
  
  # Read-only root filesystem
  readOnlyRootFilesystem: true
  
  # Restricted volumes only
  volumes:
    - configMap
    - emptyDir
    - projected
    - secret
    - downwardAPI
    - persistentVolumeClaim
```

**Restrictions**:
- NO privileged containers
- NO host access
- NO privilege escalation
- NO root user
- Read-only root filesystem
- Limited volume types

**Risk Level**: 🟢 LOW

---

## Pod Security Standards Manifest

### Namespace-Level Enforcement

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
spec:
  # Namespace-specific pod security policy
```

**Labels Explained**:

```yaml
pod-security.kubernetes.io/enforce: restricted
  └─ Enforce restricted policy (fail if violated)

pod-security.kubernetes.io/enforce-version: latest
  └─ Use latest policy version

pod-security.kubernetes.io/audit: restricted
  └─ Audit mode (log violations, allow)

pod-security.kubernetes.io/warn: restricted
  └─ Warn mode (show warnings, allow)
```

### Production Namespace Example

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nextgen-prod
  labels:
    # Enforce restricted policy
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    
    # Audit violations
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
    
    # Warn about violations
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
    
    # Monitoring & observability labels
    monitoring: enabled
    backup: daily
  annotations:
    description: "Production namespace with restricted pod security"
    created-by: "platform-team"

spec:
  # Finalizers for graceful deletion
  finalizers:
    - kubernetes
```

---

## Pod Specifications

### Restricted Pod Example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nextgen-api-prod
  namespace: nextgen-prod
  labels:
    app: nextgen-api
    environment: production
    security-level: restricted

spec:
  # Service account with minimal permissions
  serviceAccountName: nextgen-api
  automountServiceAccountToken: true
  
  # Security context for the pod
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
    seLinuxOptions:
      level: "s0:c123,c456"
  
  containers:
  - name: api
    image: ghcr.io/nextgen-market/nextgen-market:v1.0.0
    imagePullPolicy: IfNotPresent
    
    # Security context for container
    securityContext:
      allowPrivilegeEscalation: false
      privileged: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 1000
      capabilities:
        drop:
          - ALL
        add:
          - NET_BIND_SERVICE
      seccompProfile:
        type: RuntimeDefault
    
    # Ports (no privileged ports)
    ports:
    - name: http
      containerPort: 3000
      protocol: TCP
    
    # Environment variables
    env:
    - name: NODE_ENV
      value: "production"
    - name: LOG_LEVEL
      value: "info"
    
    # Resource limits (see Resource Governance)
    resources:
      requests:
        memory: "512Mi"
        cpu: "500m"
      limits:
        memory: "1Gi"
        cpu: "1000m"
    
    # Liveness probe
    livenessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    
    # Readiness probe
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 1
      failureThreshold: 3
    
    # Volume mounts (read-only where possible)
    volumeMounts:
    - name: config
      mountPath: /app/config
      readOnly: true
    - name: cache
      mountPath: /app/cache
      readOnly: false
    - name: logs
      mountPath: /app/logs
  
  # Volumes (restricted types only)
  volumes:
  - name: config
    configMap:
      name: nextgen-api-config
      defaultMode: 0444
  
  - name: cache
    emptyDir:
      sizeLimit: 1Gi
  
  - name: logs
    emptyDir:
      sizeLimit: 500Mi
  
  # DNS policy for security
  dnsPolicy: ClusterFirst
  
  # Termination grace period
  terminationGracePeriodSeconds: 30
```

---

## Graduated Rollout Strategy

### Phase 1: Audit Mode (Week 1)

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nextgen-prod
  labels:
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
  annotations:
    rollout-phase: "1-audit"

# Action: Monitor violations without blocking
# Expected: Warnings in logs, no pod rejections
# Duration: 1 week
```

**Monitoring**:
```bash
# View audit events
kubectl get events -n nextgen-prod --sort-by='.lastTimestamp'

# Check warnings
kubectl logs -n kube-system deployment/pod-security-policy-audit
```

### Phase 2: Warn Mode (Week 2)

```yaml
pod-security.kubernetes.io/warn: restricted
# Users see warnings but pods run
```

### Phase 3: Enforce Mode (Week 3+)

```yaml
pod-security.kubernetes.io/enforce: restricted
# Policy violations block pod creation
```

---

## Migration Checklist

```
✓ Audit existing workloads
✓ Identify policy violations
✓ Plan remediation
✓ Update pod specifications
✓ Test in staging
✓ Gradual rollout to production
✓ Monitor for incidents
✓ Document exceptions
```

---

## Exemptions & Exceptions

**When to use exceptions**:
- Third-party apps (Prometheus, Grafana)
- System components (DaemonSets)
- Legacy workloads (temporary)

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
  annotations:
    exception-reason: "Prometheus requires host access for node metrics"
    exception-owner: "platform-team"
    exception-expires: "2026-01-19"
```

---

## Verification

### Check Current Policy

```bash
# Get namespace labels
kubectl get ns nextgen-prod --show-labels

# Check pod compliance
kubectl get pods -n nextgen-prod \
  --output=jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}'
```

### Audit Violations

```bash
# View policy violations (audit logs)
kubectl get events -n nextgen-prod \
  --field-selector reason=PodSecurityPolicyViolation

# Detailed audit log
kubectl logs -n kube-system \
  -l component=kubelet \
  --tail=100 | grep -i "security"
```

### Enforce Policy

```bash
# Test enforcement
kubectl apply -f pod-insecure.yaml -n nextgen-prod

# Expected: Error - violates pod security policy
error: pods "insecure-pod" is forbidden: violates PodSecurityPolicy "restricted"
```

---

## Best Practices

1. **Always use read-only root filesystem**
   - Reduces attack surface
   - Forces explicit volume mounting

2. **Never run as root**
   - Use numeric UIDs (1000+)
   - Set fsGroup for permissions

3. **Drop all capabilities**
   - Add back only if needed
   - NET_BIND_SERVICE for port 3000

4. **Use security contexts**
   - Pod-level + Container-level
   - seccompProfile for syscall filtering

5. **Audit before enforcing**
   - 1 week audit mode
   - 1 week warn mode
   - Then enforce

---

## Summary

```
Baseline:    Permissive, development only
Restricted: Production-grade security
Custom:     Per-workload fine-tuning

Rollout:    Audit → Warn → Enforce (3 weeks)
Status:     ✅ Ready for production
```

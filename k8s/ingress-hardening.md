# 🔐 Ingress Hardening - TLS, HSTS, Rate Limiting, WAF

## Overview

Enterprise-grade ingress configuration with TLS 1.2+, HSTS headers, rate limiting, and WAF protection.

---

## 1. TLS/SSL Configuration

### TLS 1.2+ Certificate

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: nextgen-tls
  namespace: ingress-nginx

spec:
  secretName: nextgen-tls-secret
  
  duration: 2160h  # 90 days
  renewBefore: 720h  # Renew 30 days before expiry
  
  commonName: api.nextgen.local
  dnsNames:
  - api.nextgen.local
  - "*.nextgen.local"
  
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  
  usages:
  - digital signature
  - key encipherment
  - server auth
```

### Cluster Issuer

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod

spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: devops@nextgen.local
    
    privateKeySecretRef:
      name: letsencrypt-prod-key
    
    solvers:
    - http01:
        ingress:
          class: nginx
    
    - dns01:
        azuredns:
          clientID: ${AZURE_CLIENT_ID}
          clientSecretSecretRef:
            name: azuredns-config
            key: client-secret
          subscriptionID: ${AZURE_SUBSCRIPTION_ID}
          tenantID: ${AZURE_TENANT_ID}
          resourceGroupName: nextgen-dns
          hostedZoneName: nextgen.local
```

---

## 2. Hardened Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nextgen-ingress
  namespace: production
  
  annotations:
    # TLS Configuration
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
    
    # Security Headers
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload";
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
      more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
      more_set_headers "Permissions-Policy: geolocation=(), microphone=(), camera=()";
      more_set_headers "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'";
    
    # Rate Limiting
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-connections: "10"
    nginx.ingress.kubernetes.io/limit-whitelist: "10.0.0.0/8,172.16.0.0/12"
    
    # WAF & Protection
    nginx.ingress.kubernetes.io/enable-modsecurity: "true"
    nginx.ingress.kubernetes.io/enable-owasp-core-rules: "true"
    
    # Request Validation
    nginx.ingress.kubernetes.io/client-max-body-size: "1m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "5"

spec:
  ingressClassName: nginx
  
  tls:
  - hosts:
    - api.nextgen.local
    - "*.nextgen.local"
    secretName: nextgen-tls-secret
  
  rules:
  - host: api.nextgen.local
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: nextgen-api
            port:
              number: 3000
      
      - path: /health
        pathType: Exact
        backend:
          service:
            name: nextgen-api
            port:
              number: 3000
```

---

## 3. HSTS (HTTP Strict Transport Security)

```yaml
# HSTS Header Configuration
annotations:
  nginx.ingress.kubernetes.io/configuration-snippet: |
    more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload";
```

**HSTS Parameters**:

```
max-age=31536000
  └─ Cache duration (1 year in seconds)

includeSubDomains
  └─ Apply to all subdomains

preload
  └─ Add to HSTS preload list
  └─ Used by browser vendors
```

**Effect**:
- ✅ Browser caches and enforces HTTPS
- ✅ Prevents MITM attacks
- ✅ No fallback to HTTP

---

## 4. Rate Limiting

### Simple Rate Limiting

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    # 100 requests per second
    nginx.ingress.kubernetes.io/limit-rps: "100"
    
    # 10 concurrent connections per IP
    nginx.ingress.kubernetes.io/limit-connections: "10"
    
    # Whitelist internal IPs
    nginx.ingress.kubernetes.io/limit-whitelist: "10.0.0.0/8,172.16.0.0/12"
    
    # Rate limit window
    nginx.ingress.kubernetes.io/limit-req: "10"
    nginx.ingress.kubernetes.io/limit-req-status-code: "429"
```

### Advanced Rate Limiting (ConfigMap)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-ratelimit-config
  namespace: ingress-nginx

data:
  # Global rate limit: 100 req/s
  limit-rps: "100"
  
  # Per-client rate limit: 10 req/s
  limit-req: "10"
  
  # Burst size: Allow up to 20 requests
  limit-req-status-code: "429"
  
  # Connection limit: 10 per IP
  limit-connections: "10"
  
  # Zone size: 10MB for tracking
  limit-req-zones: "{ \"key\": \"$binary_remote_addr\", \"zone\": \"api\", \"size\": \"10m\", \"rate\": \"10r/s\" }"
```

### Per-Path Rate Limiting

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rate-limited-api
  annotations:
    nginx.ingress.kubernetes.io/configuration-snippet: |
      # Strict rate limit for auth endpoint
      location /api/auth/login {
        limit_req zone=auth burst=5 nodelay;
        limit_req_status 429;
      }
      
      # Standard rate limit for API
      location /api {
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
      }
```

---

## 5. ModSecurity WAF Rules

### Enable ModSecurity

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-waf-config
  namespace: ingress-nginx

data:
  enable-modsecurity: "true"
  enable-owasp-core-rules: "true"
  modsecurity-snippet: |
    SecRuleEngine On
    SecRequestBodyAccess On
    SecResponseBodyAccess Off
    
    # File upload restrictions
    SecUploadDir /var/cache/modsecurity
    SecUploadKeepFiles Off
    SecUploadFileLimit 1048576
    
    # Request size limits
    SecRequestBodyLimit 1048576
    SecRequestBodyNoAction Off
    SecRequestBodyLimitAction ProcessPartial
    
    # Temporary files
    SecTmpDir /var/run/modsecurity
```

### OWASP Core Rules

```yaml
# Automatic OWASP ModSecurity Core Rule Set (CRS)
annotations:
  nginx.ingress.kubernetes.io/enable-owasp-core-rules: "true"
```

**Covers**:
- SQL Injection
- Cross-Site Scripting (XSS)
- Local File Inclusion (LFI)
- Remote File Inclusion (RFI)
- PHP Injection
- Cross-Site Request Forgery (CSRF)
- Session Fixation
- Scanner Detection
- HTTP Protocol Attacks
- Trojan Detection

### Custom WAF Rules

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: modsecurity-rules
  namespace: ingress-nginx

data:
  custom-rules: |
    # Block common web shells
    SecRule REQUEST_URI "@rx (?:shell|admin\.php|wp-admin)" \
      "id:1001,phase:2,deny,log,status:403"
    
    # Block SQL injection patterns
    SecRule REQUEST_HEADERS|ARGS|REQUEST_BODY \
      "@rx (?:union|select|insert|update|delete|drop|exec|script)" \
      "id:1002,phase:2,chain,log,msg:'SQL Injection Detected'"
      SecRule REQUEST_HEADERS|ARGS "@rx (?:;|'|\")" "setvar:tx.suspicious_req=1"
    
    # Block XSS patterns
    SecRule REQUEST_HEADERS|ARGS|REQUEST_BODY \
      "@rx <script[^>]*>|javascript:|onerror=|onclick=" \
      "id:1003,phase:2,deny,log,status:403,msg:'XSS Detected'"
    
    # Block path traversal
    SecRule REQUEST_URI "@rx \.\./|\.\.%2f|..\\|..%5c" \
      "id:1004,phase:2,deny,log,status:403,msg:'Path Traversal Detected'"
    
    # Rate limit on login failures
    SecRule REQUEST_URI "@rx /api/auth/login" "id:1005,phase:2,chain"
      SecRule REQUEST_METHOD "@rx POST" "chain"
        SecRule RESPONSE_STATUS "@rx 401" "setvar:ip.login_failures=+1,expirevar:ip.login_failures=300"
    
    # Block if too many login failures
    SecRule IP:LOGIN_FAILURES "@gt 5" "id:1006,phase:2,deny,log,status:403,msg:'Too many login attempts'"
```

---

## 6. Security Headers

### Complete Header Set

```yaml
annotations:
  nginx.ingress.kubernetes.io/configuration-snippet: |
    # HSTS - Force HTTPS
    more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload";
    
    # Clickjacking protection
    more_set_headers "X-Frame-Options: DENY";
    
    # Prevent MIME sniffing
    more_set_headers "X-Content-Type-Options: nosniff";
    
    # XSS protection (legacy)
    more_set_headers "X-XSS-Protection: 1; mode=block";
    
    # Referrer policy
    more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
    
    # Permissions policy (formerly Feature Policy)
    more_set_headers "Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()";
    
    # Content Security Policy
    more_set_headers "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'";
    
    # Remove server information
    more_clear_headers "Server";
    more_clear_headers "X-Powered-By";
    
    # CORS headers (if needed)
    more_set_headers "Access-Control-Allow-Origin: https://trusted-domain.com";
    more_set_headers "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS";
    more_set_headers "Access-Control-Allow-Headers: Content-Type, Authorization";
    more_set_headers "Access-Control-Max-Age: 86400";
```

---

## 7. Request Validation

```yaml
annotations:
  # Request size limits
  nginx.ingress.kubernetes.io/client-max-body-size: "1m"
  
  # Connection timeouts
  nginx.ingress.kubernetes.io/proxy-connect-timeout: "5"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "30"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "30"
  
  # Buffering
  nginx.ingress.kubernetes.io/proxy-buffering: "on"
  nginx.ingress.kubernetes.io/proxy-buffer-size: "4k"
  nginx.ingress.kubernetes.io/proxy-buffers: "8 4k"
  
  # Method restrictions
  nginx.ingress.kubernetes.io/configuration-snippet: |
    if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|OPTIONS)$) {
      return 405;
    }
```

---

## 8. Complete Hardened Ingress Example

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nextgen-hardened-ingress
  namespace: production
  
  annotations:
    # Certificate Management
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    
    # TLS Configuration
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256"
    nginx.ingress.kubernetes.io/ssl-session-timeout: "10m"
    nginx.ingress.kubernetes.io/ssl-session-cache: "shared:SSL:10m"
    
    # Security Headers
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload";
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "Content-Security-Policy: default-src 'self'";
      more_clear_headers "Server";
    
    # Rate Limiting
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-connections: "10"
    
    # WAF & Protection
    nginx.ingress.kubernetes.io/enable-modsecurity: "true"
    nginx.ingress.kubernetes.io/enable-owasp-core-rules: "true"
    
    # Request Validation
    nginx.ingress.kubernetes.io/client-max-body-size: "1m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "5"

spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.nextgen.local
    secretName: nextgen-tls-secret
  
  rules:
  - host: api.nextgen.local
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: nextgen-api
            port:
              number: 3000
```

---

## 9. Testing Security Headers

```bash
# Check TLS version
openssl s_client -connect api.nextgen.local:443 -tls1_2

# Verify security headers
curl -I https://api.nextgen.local/api/health | grep -E "(Strict-Transport|X-Frame|X-Content|CSP)"

# Check SSL labs score
# https://www.ssllabs.com/ssltest/analyze.html?d=api.nextgen.local

# Test rate limiting
for i in {1..150}; do curl -s https://api.nextgen.local/api/health; done

# Check WAF blocking
curl -X POST https://api.nextgen.local/api/health \
  -H "Content-Type: application/json" \
  -d '{"payload": "<script>alert(1)</script>"}'
# Expected: 403 Forbidden
```

---

## 10. Monitoring

### Prometheus Metrics

```promql
# Request rate
sum(rate(nginx_ingress_controller_requests[5m])) by (status)

# TLS version distribution
sum(rate(nginx_ingress_controller_ssl_tls_version[5m])) by (ssl_version)

# Blocked requests (WAF)
sum(rate(nginx_ingress_controller_blocked_requests[5m]))

# Rate limited connections
sum(rate(nginx_ingress_controller_limiting_requests_total[5m]))
```

### Alerts

```yaml
- alert: HighRejectionRate
  expr: |
    (sum(rate(nginx_ingress_controller_requests{status=~"4..|5.."}[5m])) / 
     sum(rate(nginx_ingress_controller_requests[5m]))) > 0.05
  for: 5m
  annotations:
    summary: "High rejection rate detected"

- alert: TLS1xUsage
  expr: |
    sum(rate(nginx_ingress_controller_ssl_tls_version{ssl_version="TLSv1.0"}[5m])) > 0
  annotations:
    summary: "TLS 1.0 usage detected - should be TLS 1.2+"
```

---

## 11. Azure WAF Integration

```yaml
# Azure Application Gateway WAF policies
apiVersion: azure.microsoft.com/v1
kind: WAFPolicy
metadata:
  name: nextgen-waf-policy

spec:
  managedRules:
    managedRuleSets:
    - ruleSetType: OWASP
      ruleSetVersion: "3.1"
      ruleGroupOverrides:
      - ruleGroupName: PHP
        rules:
        - ruleId: "933100"
          action: Log
          state: Enabled
  
  customRules:
  - name: GeoblockRule
    priority: 1
    action: Block
    matchConditions:
    - matchVariables:
      - variableName: GeoLocation
      operator: NotEqual
      negationConditional: true
      matchValues:
      - US
      - CA
      - GB
  
  - name: RateLimitRule
    priority: 2
    action: Block
    matchConditions:
    - matchVariables:
      - variableName: RemoteAddr
      operator: Any
      matchValues: []
    rateLimit:
      threshold: 2000
      window: 5
```

---

## Summary

```
✅ TLS 1.2+: Modern encryption
✅ HSTS: Force HTTPS enforcement
✅ Rate Limiting: DDoS mitigation
✅ WAF: OWASP protection
✅ Security Headers: Multi-layer defense
✅ Request Validation: Input protection
```

**Status**: 🟢 Production-ready ingress hardening

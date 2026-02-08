# 🔐 Vault Bootstrap & Secrets Rotation Guide

This document outlines the procedures for bootstrapping HashiCorp Vault for the NextGen Marketplace and managing secret rotation.

## 1. Prerequisites

- Vault cluster initialized and unsealed.
- `vault` CLI installed and authenticated as root/admin.
- Kubernetes cluster running.

## 2. Enable Kubernetes Authentication

Connect Vault to the Kubernetes cluster to allow Pods to authenticate via Service Accounts.

```bash
vault auth enable kubernetes

vault write auth/kubernetes/config \
    kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"
```

## 3. Create Policies

Define a strict policy that only allows reading specific secrets for the NextGen app.

```bash
vault policy write nextgen-policy - <<EOF
path "nextgen/data/*" {
  capabilities = ["read"]
}
EOF
```

## 4. Create Roles

Bind the Kubernetes Service Account (`nextgen-api`) to the Vault Policy.

```bash
vault write auth/kubernetes/role/nextgen-api \
    bound_service_account_names=nextgen-api \
    bound_service_account_namespaces=nextgen \
    policies=nextgen-policy \
    ttl=1h
```

## 5. Bootstrap Initial Secrets (One-Time Setup)

**⚠️ WARNING:** Execute this only from a secure admin terminal. Never commit these commands to Git.

```bash
# Database Secrets
vault kv put nextgen/database \
    username="nextgen_user" \
    password="$(openssl rand -base64 32)" \
    host="postgres-service" \
    port="5432" \
    database="nextgen_db"

# Redis Secrets
vault kv put nextgen/redis \
    password="$(openssl rand -base64 32)" \
    host="redis-service" \
    port="6379"

# JWT Secrets
vault kv put nextgen/jwt \
    secret="$(openssl rand -base64 64)" \
    refresh_secret="$(openssl rand -base64 64)"
```

## 6. Verification

To verify the setup, exec into a running pod and check if secrets are mounted:

```bash
kubectl exec -it -n nextgen deploy/api -- cat /vault/secrets/database.env
# Output should be: export DATABASE_URL="postgresql://..."
```
#!/bin/bash
set -e

# Enable Transit engine
vault secrets enable transit

# Create JWT signing key
vault write -f transit/keys/jwt-signing \
  type=aes256-gcm96 \
  exportable=false \
  allow_plaintext_backup=false \
  deletion_allowed=false

# Create policy
vault policy write jwt-transit - <<EOF
path "transit/sign/jwt-signing" {
  capabilities = ["create", "update"]
}
path "transit/verify/jwt-signing" {
  capabilities = ["create", "update"]
}
path "transit/keys/jwt-signing" {
  capabilities = ["read"]
}
path "transit/keys/jwt-signing/rotate" {
  capabilities = ["update"]
}
EOF

echo "✅ Vault Transit engine configured for JWT signing"
#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Generate htpasswd for Nginx Basic Auth
# ═══════════════════════════════════════════════════════════════════════════
# Usage: bash infra/nginx/generate-htpasswd.sh <username> <password>
# ═══════════════════════════════════════════════════════════════════════════

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 admin MySecurePassword123"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

# Generate htpasswd entry (using OpenSSL)
ENCRYPTED=$(openssl passwd -apr1 "$PASSWORD")

# Create htpasswd file
echo "$USERNAME:$ENCRYPTED" > infra/nginx/htpasswd

echo "✅ htpasswd file created successfully"
echo "📍 Location: infra/nginx/htpasswd"
echo "👤 Username: $USERNAME"
echo ""
echo "⚠️  Keep this file secure and never commit to Git!"

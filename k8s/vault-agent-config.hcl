# ═══════════════════════════════════════════════════════════════════════════
# HashiCorp Vault Agent Configuration
# ═══════════════════════════════════════════════════════════════════════════
# This configuration handles:
# 1. Auto-Authentication with Kubernetes Service Account
# 2. Rendering secrets to a shared volume
# 3. Managing the lifecycle of the Vault token
# ═══════════════════════════════════════════════════════════════════════════

pid_file = "/home/vault/pidfile"
exit_after_auth = false

auto_auth {
  method "kubernetes" {
    mount_path = "auth/kubernetes"
    config = {
      role = "nextgen-api"
      token_path = "/var/run/secrets/kubernetes.io/serviceaccount/token"
    }
  }

  sink "file" {
    config = {
      path = "/home/vault/.vault-token"
    }
  }
}

# Template: Database Credentials
# Renders a shell-sourceable file for the application entrypoint
template {
  contents = <<EOH
{{- with secret "nextgen/data/database" -}}
export DATABASE_URL="postgresql://{{ .Data.data.username }}:{{ .Data.data.password }}@{{ .Data.data.host }}:{{ .Data.data.port }}/{{ .Data.data.database }}"
{{- end }}
EOH
  destination = "/vault/secrets/database.env"
}

# Template: Redis Credentials
template {
  contents = <<EOH
{{- with secret "nextgen/data/redis" -}}
export REDIS_URL="redis://:{{ .Data.data.password }}@{{ .Data.data.host }}:{{ .Data.data.port }}"
{{- end }}
EOH
  destination = "/vault/secrets/redis.env"
}

# Template: JWT Secrets
template {
  source      = "/vault/config/jwt.tpl" # Can also use external file
  destination = "/vault/secrets/jwt.env"
}
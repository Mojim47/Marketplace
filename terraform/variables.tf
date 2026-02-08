# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Terraform Variables
# ═══════════════════════════════════════════════════════════════════════════
# Secure variable definitions with proper validation and sensitivity

# Infrastructure Variables
variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.hcloud_token) > 20
    error_message = "Hetzner Cloud token must be valid."
  }
}

variable "deployer_public_key" {
  description = "SSH public key for deployment access"
  type        = string
  validation {
    condition     = can(regex("^ssh-(rsa|ed25519|ecdsa)", var.deployer_public_key))
    error_message = "Must be a valid SSH public key."
  }
}

variable "deployer_private_key_path" {
  description = "Path to SSH private key for deployment"
  type        = string
  sensitive   = true
}

# Database Variables
variable "db_user" {
  description = "Database username"
  type        = string
  default     = "nextgen_app"
  validation {
    condition     = length(var.db_user) >= 3
    error_message = "Database username must be at least 3 characters."
  }
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.db_password) >= 16
    error_message = "Database password must be at least 16 characters."
  }
}

# Redis Variables
variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.redis_password) >= 16
    error_message = "Redis password must be at least 16 characters."
  }
}

# Application Security Variables
variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "JWT secret must be at least 32 characters."
  }
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token secret"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.jwt_refresh_secret) >= 32
    error_message = "JWT refresh secret must be at least 32 characters."
  }
}

# PGBouncer Variables
variable "pgbouncer_admin_password" {
  description = "PGBouncer admin password"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.pgbouncer_admin_password) >= 16
    error_message = "PGBouncer admin password must be at least 16 characters."
  }
}

variable "pgbouncer_stats_password" {
  description = "PGBouncer stats password"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.pgbouncer_stats_password) >= 16
    error_message = "PGBouncer stats password must be at least 16 characters."
  }
}

variable "pgbouncer_pool_size" {
  description = "PGBouncer connection pool size"
  type        = number
  default     = 25
  validation {
    condition     = var.pgbouncer_pool_size >= 5 && var.pgbouncer_pool_size <= 100
    error_message = "Pool size must be between 5 and 100."
  }
}

# External Service Variables
variable "kavenegar_api_key" {
  description = "Kavenegar SMS API key"
  type        = string
  sensitive   = true
}

variable "zarinpal_merchant_id" {
  description = "ZarinPal merchant ID"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.zarinpal_merchant_id))
    error_message = "ZarinPal merchant ID must be a valid UUID."
  }
}

variable "moodian_client_id" {
  description = "Moodian client ID"
  type        = string
  sensitive   = true
}

variable "moodian_private_key" {
  description = "Moodian private key"
  type        = string
  sensitive   = true
}

# Environment Configuration
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "nextgen-market.ir"
  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.domain_name))
    error_message = "Must be a valid domain name."
  }
}

# Monitoring Variables
variable "enable_monitoring" {
  description = "Enable Prometheus and Grafana monitoring"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable centralized logging"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 7 and 365 days."
  }
}
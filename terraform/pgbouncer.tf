# ═══════════════════════════════════════════════════════════════════════════
# PGBOUNCER TERRAFORM CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Connection pooling with transaction-level pooling
# Target: Handle 10k QPS with minimal connection overhead
# Pool Mode: Transaction (optimal for high-throughput applications)
# ═══════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# ───────────────────────────────────────────────────────────────────────────
# Variables
# ───────────────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "database_url" {
  description = "Primary database URL"
  type        = string
  sensitive   = true
}

variable "database_read_replica_urls" {
  description = "Read replica database URLs"
  type        = list(string)
  default     = []
  sensitive   = true
}

variable "pgbouncer_pool_size" {
  description = "Maximum connections per pool"
  type        = number
  default     = 100
}

variable "pgbouncer_max_client_conn" {
  description = "Maximum client connections"
  type        = number
  default     = 1000
}

# ───────────────────────────────────────────────────────────────────────────
# PgBouncer ConfigMap
# ───────────────────────────────────────────────────────────────────────────

resource "kubernetes_config_map" "pgbouncer_config" {
  metadata {
    name      = "pgbouncer-config"
    namespace = "nextgen"
    labels = {
      app     = "pgbouncer"
      env     = var.environment
      version = "1.21.0"
    }
  }

  data = {
    "pgbouncer.ini" = templatefile("${path.module}/pgbouncer.ini.tpl", {
      pool_mode           = "transaction"
      max_client_conn     = var.pgbouncer_max_client_conn
      default_pool_size   = var.pgbouncer_pool_size
      reserve_pool_size   = 10
      reserve_pool_timeout = 5
      max_db_connections  = var.pgbouncer_pool_size * 2
      listen_port         = 5432
      auth_type          = "md5"
      auth_file          = "/etc/pgbouncer/userlist.txt"
      admin_users        = "pgbouncer_admin"
      stats_users        = "pgbouncer_stats"
      log_connections    = 1
      log_disconnections = 1
      log_pooler_errors  = 1
      server_reset_query = "DISCARD ALL"
      server_check_query = "SELECT 1"
      server_check_delay = 30
      query_timeout      = 30
      query_wait_timeout = 120
      client_idle_timeout = 0
      server_idle_timeout = 600
      server_lifetime     = 3600
      server_connect_timeout = 15
      client_login_timeout = 60
    })

    "databases.ini" = templatefile("${path.module}/databases.ini.tpl", {
      primary_db_url = var.database_url
      read_replica_urls = var.database_read_replica_urls
    })

    "userlist.txt" = templatefile("${path.module}/userlist.txt.tpl", {
      # Users will be populated from Kubernetes secrets
    })
  }
}

# ───────────────────────────────────────────────────────────────────────────
# PgBouncer Secret
# ───────────────────────────────────────────────────────────────────────────

resource "kubernetes_secret" "pgbouncer_auth" {
  metadata {
    name      = "pgbouncer-auth"
    namespace = "nextgen"
    labels = {
      app = "pgbouncer"
      env = var.environment
    }
  }

  type = "Opaque"

  data = {
    # These should be populated from your secret management system
    "admin_password" = base64encode(var.pgbouncer_admin_password)
    "stats_password" = base64encode(var.pgbouncer_stats_password)
    "db_password"    = base64encode(var.db_password)
  }
}

# ───────────────────────────────────────────────────────────────────────────
# PgBouncer Deployment
# ───────────────────────────────────────────────────────────────────────────

resource "kubernetes_deployment" "pgbouncer" {
  metadata {
    name      = "pgbouncer"
    namespace = "nextgen"
    labels = {
      app     = "pgbouncer"
      env     = var.environment
      version = "1.21.0"
    }
  }

  spec {
    replicas = 3 # High availability

    selector {
      match_labels = {
        app = "pgbouncer"
      }
    }

    template {
      metadata {
        labels = {
          app     = "pgbouncer"
          env     = var.environment
          version = "1.21.0"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "9127"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        service_account_name = "pgbouncer"
        
        # Security context
        security_context {
          run_as_non_root = true
          run_as_user     = 999
          fs_group        = 999
        }

        # Init container to prepare configuration
        init_container {
          name  = "config-init"
          image = "busybox:1.36"
          
          command = ["/bin/sh", "-c"]
          args = [
            <<-EOT
            # Create userlist.txt with actual passwords
            echo "pgbouncer_admin:md5$(echo -n 'CHANGE_ME_ADMIN_PASSWORD' | md5sum | cut -d' ' -f1)" > /tmp/userlist.txt
            echo "pgbouncer_stats:md5$(echo -n 'CHANGE_ME_STATS_PASSWORD' | md5sum | cut -d' ' -f1)" >> /tmp/userlist.txt
            echo "nextgen_prod_user:md5$(echo -n '$DB_PASSWORD' | md5sum | cut -d' ' -f1)" >> /tmp/userlist.txt
            cp /tmp/userlist.txt /etc/pgbouncer/userlist.txt
            chmod 600 /etc/pgbouncer/userlist.txt
            EOT
          ]

          env {
            name = "DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = "pgbouncer-auth"
                key  = "db_password"
              }
            }
          }

          volume_mount {
            name       = "pgbouncer-config"
            mount_path = "/etc/pgbouncer"
          }

          security_context {
            run_as_user = 999
            run_as_group = 999
          }
        }

        # Main PgBouncer container
        container {
          name  = "pgbouncer"
          image = "pgbouncer/pgbouncer:1.21.0"

          port {
            name           = "pgbouncer"
            container_port = 5432
            protocol       = "TCP"
          }

          port {
            name           = "metrics"
            container_port = 9127
            protocol       = "TCP"
          }

          # Environment variables
          env {
            name  = "DATABASES_HOST"
            value = "postgres.nextgen.svc.cluster.local"
          }

          env {
            name  = "DATABASES_PORT"
            value = "5432"
          }

          env {
            name  = "DATABASES_USER"
            value = "nextgen_prod_user"
          }

          env {
            name = "DATABASES_PASSWORD"
            value_from {
              secret_key_ref {
                name = "pgbouncer-auth"
                key  = "db_password"
              }
            }
          }

          env {
            name  = "POOL_MODE"
            value = "transaction"
          }

          env {
            name  = "MAX_CLIENT_CONN"
            value = tostring(var.pgbouncer_max_client_conn)
          }

          env {
            name  = "DEFAULT_POOL_SIZE"
            value = tostring(var.pgbouncer_pool_size)
          }

          # Resource limits
          resources {
            requests = {
              memory = "256Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "512Mi"
              cpu    = "500m"
            }
          }

          # Health checks
          liveness_probe {
            tcp_socket {
              port = 5432
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            tcp_socket {
              port = 5432
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 2
          }

          # Volume mounts
          volume_mount {
            name       = "pgbouncer-config"
            mount_path = "/etc/pgbouncer"
            read_only  = true
          }

          # Security context
          security_context {
            run_as_non_root                = true
            run_as_user                    = 999
            allow_privilege_escalation     = false
            read_only_root_filesystem      = true
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        # Metrics exporter sidecar
        container {
          name  = "pgbouncer-exporter"
          image = "prometheuscommunity/pgbouncer-exporter:v0.7.0"

          port {
            name           = "metrics"
            container_port = 9127
            protocol       = "TCP"
          }

          env {
            name  = "PGBOUNCER_EXPORTER_HOST"
            value = "localhost"
          }

          env {
            name  = "PGBOUNCER_EXPORTER_PORT"
            value = "5432"
          }

          env {
            name  = "PGBOUNCER_EXPORTER_USER"
            value = "pgbouncer_stats"
          }

          env {
            name = "PGBOUNCER_EXPORTER_PASSWORD"
            value_from {
              secret_key_ref {
                name = "pgbouncer-auth"
                key  = "stats_password"
              }
            }
          }

          resources {
            requests = {
              memory = "64Mi"
              cpu    = "50m"
            }
            limits = {
              memory = "128Mi"
              cpu    = "100m"
            }
          }

          security_context {
            run_as_non_root                = true
            run_as_user                    = 65534
            allow_privilege_escalation     = false
            read_only_root_filesystem      = true
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        # Volumes
        volume {
          name = "pgbouncer-config"
          config_map {
            name = kubernetes_config_map.pgbouncer_config.metadata[0].name
          }
        }

        # Pod anti-affinity for high availability
        affinity {
          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              pod_affinity_term {
                label_selector {
                  match_expressions {
                    key      = "app"
                    operator = "In"
                    values   = ["pgbouncer"]
                  }
                }
                topology_key = "kubernetes.io/hostname"
              }
            }
          }
        }

        # Tolerations for dedicated nodes (optional)
        toleration {
          key      = "database"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }
      }
    }
  }
}

# ───────────────────────────────────────────────────────────────────────────
# PgBouncer Service
# ───────────────────────────────────────────────────────────────────────────

resource "kubernetes_service" "pgbouncer" {
  metadata {
    name      = "pgbouncer"
    namespace = "nextgen"
    labels = {
      app = "pgbouncer"
      env = var.environment
    }
    annotations = {
      "service.beta.kubernetes.io/aws-load-balancer-type" = "nlb"
      "service.beta.kubernetes.io/aws-load-balancer-internal" = "true"
    }
  }

  spec {
    selector = {
      app = "pgbouncer"
    }

    type             = "LoadBalancer"
    session_affinity = "ClientIP"

    port {
      name        = "pgbouncer"
      port        = 5432
      target_port = 5432
      protocol    = "TCP"
    }

    port {
      name        = "metrics"
      port        = 9127
      target_port = 9127
      protocol    = "TCP"
    }
  }
}

# ───────────────────────────────────────────────────────────────────────────
# Service Account & RBAC
# ───────────────────────────────────────────────────────────────────────────

resource "kubernetes_service_account" "pgbouncer" {
  metadata {
    name      = "pgbouncer"
    namespace = "nextgen"
    labels = {
      app = "pgbouncer"
    }
  }
}

# ───────────────────────────────────────────────────────────────────────────
# ServiceMonitor for Prometheus
# ───────────────────────────────────────────────────────────────────────────

resource "kubernetes_manifest" "pgbouncer_servicemonitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "pgbouncer"
      namespace = "nextgen"
      labels = {
        app = "pgbouncer"
      }
    }
    spec = {
      selector = {
        matchLabels = {
          app = "pgbouncer"
        }
      }
      endpoints = [
        {
          port     = "metrics"
          interval = "30s"
          path     = "/metrics"
        }
      ]
    }
  }
}

# ───────────────────────────────────────────────────────────────────────────
# Outputs
# ───────────────────────────────────────────────────────────────────────────

output "pgbouncer_service_name" {
  description = "PgBouncer service name"
  value       = kubernetes_service.pgbouncer.metadata[0].name
}

output "pgbouncer_connection_string" {
  description = "PgBouncer connection string template"
  value       = "postgresql://username:password@${kubernetes_service.pgbouncer.metadata[0].name}.${kubernetes_service.pgbouncer.metadata[0].namespace}.svc.cluster.local:5432/dbname"
  sensitive   = true
}

output "pgbouncer_metrics_endpoint" {
  description = "PgBouncer metrics endpoint"
  value       = "http://${kubernetes_service.pgbouncer.metadata[0].name}.${kubernetes_service.pgbouncer.metadata[0].namespace}.svc.cluster.local:9127/metrics"
}
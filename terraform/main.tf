terraform {
  required_version = ">= 1.5"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.43"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

# ─────────────────────────────────────────────
# PRIMARY SERVER (cx11 - $5/mo)
# ─────────────────────────────────────────────
resource "hcloud_server" "nextgen_primary" {
  name             = "${var.environment}-api-primary"
  image            = "ubuntu-22.04"
  server_type      = "cx11"
  location         = var.hcloud_location
  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
  ssh_keys = [hcloud_ssh_key.deployer.id]
  
  labels = {
    environment = var.environment
    role        = "primary"
    managed_by  = "terraform"
  }

  depends_on = [hcloud_ssh_key.deployer]
}

# ─────────────────────────────────────────────
# PERSISTENT VOLUMES
# ─────────────────────────────────────────────
resource "hcloud_volume" "postgres_data" {
  name              = "${var.environment}-postgres-data"
  size              = 20
  server_id         = hcloud_server.nextgen_primary.id
  automount         = true
  linux_device_name = "/dev/disk/by-id/scsi-0HC_Volume_*"
  
  labels = {
    purpose = "database"
  }
}

resource "hcloud_volume" "redis_data" {
  name              = "${var.environment}-redis-data"
  size              = 10
  server_id         = hcloud_server.nextgen_primary.id
  automount         = true
  linux_device_name = "/dev/disk/by-id/scsi-0HC_Volume_*"
  
  labels = {
    purpose = "cache"
  }
}

# ─────────────────────────────────────────────
# FLOATING IP (for DNS)
# ─────────────────────────────────────────────
resource "hcloud_floating_ip" "api" {
  type          = "ipv4"
  server_id     = hcloud_server.nextgen_primary.id
  name          = "${var.environment}-api-floating-ip"
  home_location = var.hcloud_location
  
  labels = {
    service = "api"
  }
}

# ─────────────────────────────────────────────
# SSH KEY FOR DEPLOYMENT
# ─────────────────────────────────────────────
resource "hcloud_ssh_key" "deployer" {
  name       = "${var.environment}-deployer-key"
  public_key = var.deployer_public_key
  
  labels = {
    purpose = "automation"
  }
}

# ─────────────────────────────────────────────
# REMOTE EXEC: K3s Installation
# ─────────────────────────────────────────────
resource "null_resource" "k3s_installation" {
  triggers = {
    server_id = hcloud_server.nextgen_primary.id
  }

  provisioner "remote-exec" {
    inline = [
      "#!/bin/bash",
      "set -e",
      "echo '=== K3s Installation Started ==='",
      "curl -sfL https://get.k3s.io | K3S_KUBECONFIG_MODE=644 INSTALL_K3S_SKIP_DOWNLOAD=false sh - > /tmp/k3s_install.log 2>&1 || (cat /tmp/k3s_install.log && exit 1)",
      "sleep 10",
      "echo '=== Waiting for K3s to be ready ==='",
      "until kubectl get nodes; do sleep 2; done",
      "echo '=== K3s ready ==='",
      "kubectl version",
    ]

    connection {
      type        = "ssh"
      user        = "root"
      private_key = var.deployer_private_key
      host        = hcloud_server.nextgen_primary.public_net[0].ipv4.ip
      timeout     = "10m"
    }
  }

  depends_on = [hcloud_server.nextgen_primary, hcloud_volume.postgres_data, hcloud_volume.redis_data]
}

# ─────────────────────────────────────────────
# FETCH KUBECONFIG
# ─────────────────────────────────────────────
resource "null_resource" "fetch_kubeconfig" {
  provisioner "local-exec" {
    command = "mkdir -p ${path.module}/../k8s && scp -o StrictHostKeyChecking=no -i ${var.deployer_private_key_path} root@${hcloud_server.nextgen_primary.public_net[0].ipv4.ip}:/etc/rancher/k3s/k3s.yaml ${path.module}/../k8s/kubeconfig.yml"
  }

  depends_on = [null_resource.k3s_installation]
}

# ─────────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────────
output "server_ip" {
  value       = hcloud_server.nextgen_primary.public_net[0].ipv4.ip
  description = "Public IP of the Kubernetes server"
}

output "floating_ip" {
  value       = hcloud_floating_ip.api.ip_address
  description = "Floating IP for DNS (point your domain here)"
}

output "kubeconfig_path" {
  value       = "${path.module}/../k8s/kubeconfig.yml"
  description = "Path to kubeconfig file"
}

output "monthly_cost_estimate" {
  value = "$6.83 USD/month"
}

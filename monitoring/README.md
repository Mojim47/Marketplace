# Monitoring Stack Deployment Guide for Kubernetes

This guide outlines the steps to deploy the Prometheus, Grafana, Alertmanager (via `kube-prometheus-stack`), and Loki with Promtail (via `loki-stack`) monitoring solutions onto your Kubernetes cluster using Helm.

---

## Prerequisites

1.  **Helm 3+** installed on your local machine.
2.  **`kubectl`** configured to connect to your Kubernetes cluster.
3.  **Cert-Manager** installed in your cluster (for Ingress TLS certificates).
4.  A **LoadBalancer or Ingress Controller** (like NGINX Ingress Controller) installed and configured in your cluster.
5.  **DNS records** configured for your Grafana instance (e.g., `grafana.example.com`).

---

## 1. Add Helm Repositories

First, add the necessary Helm repositories:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

---

## 2. Deploy kube-prometheus-stack (Prometheus, Grafana, Alertmanager)

This chart deploys Prometheus, the Prometheus Operator, Grafana, and Alertmanager.

**Important:** Before deploying, ensure you have reviewed and updated the `monitoring/prometheus-values.yaml` file, especially the `ACTION REQUIRED` sections for:
*   `grafana.adminPassword` (CHANGE THIS!)
*   `grafana.ingress.hosts`
*   `prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName` and `storage`.
*   Alertmanager configuration (`SLACK_WEBHOOK_URL`, `PAGERDUTY_SERVICE_KEY`).

```bash
helm upgrade --install prometheus-operator prometheus-community/kube-prometheus-stack \
  --namespace nextgen \
  --create-namespace \
  -f monitoring/prometheus-values.yaml \
  --version <chart_version> # 🔴 ACTION REQUIRED: Specify a stable chart version (e.g., 45.x.x)
```

**Note on Grafana Admin Password:**
It is highly recommended to manage `grafana.adminPassword` using a Kubernetes Secret instead of hardcoding it in `values.yaml`.
You can create a secret:
`kubectl create secret generic grafana-admin-secret --from-literal=admin-password='YOUR_SUPER_STRONG_PASSWORD' -n nextgen`
Then in `prometheus-values.yaml`, use:
`grafana.adminPasswordFromSecret: grafana-admin-secret`
`grafana.adminPasswordKey: admin-password`

---

## 3. Deploy Loki Stack (Loki, Promtail)

This chart deploys Loki for log aggregation and Promtail to collect logs from your Kubernetes pods.

**Important:** Review and update `monitoring/loki-values.yaml`, especially the `ACTION REQUIRED` sections for storage and retention settings, which depend on your log volume and desired retention period. For production, consider using cloud storage (e.g., S3, GCS) for Loki.

```bash
helm upgrade --install loki grafana/loki-stack \
  --namespace nextgen \
  -f monitoring/loki-values.yaml \
  --version <chart_version> # 🔴 ACTION REQUIRED: Specify a stable chart version (e.g., 2.x.x)
```

---

## 4. Verify Deployment

After deployment, you can check the status of the pods:

```bash
kubectl get pods -n nextgen -l release=prometheus-operator
kubectl get pods -n nextgen -l release=loki
```

You should be able to access Grafana at the Ingress host you configured (e.g., `https://grafana.example.com`). Log in with `admin` and the password you set. You should see the "NextGen API Overview" dashboard automatically imported.

---

**Next Steps:**

*   **Configure DNS and TLS** for your Grafana Ingress.
*   **Create Alertmanager secrets** for Slack webhook URLs and PagerDuty service keys.
*   **Customize dashboards** and alert rules to fit your specific needs.
*   **Review Loki storage configuration** for production-grade persistence (e.g., using S3/GCS).
*   **Integrate tracing with Jaeger/Tempo** (already present in the `api-stack.yml` ConfigMap for `JAEGER_ENDPOINT`).

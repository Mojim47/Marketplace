#!/usr/bin/env ts-node

// ═══════════════════════════════════════════════════════════════════════════
// Monitoring Setup Script - Complete Monitoring Stack Deployment
// ═══════════════════════════════════════════════════════════════════════════

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface MonitoringConfig {
  grafanaPassword: string;
  prometheusRetention: string;
  alertmanagerWebhook: string;
  enableEmailAlerts: boolean;
  emailConfig?: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    toEmail: string;
  };
}

class MonitoringSetup {
  private config: MonitoringConfig;

  constructor() {
    this.config = {
      grafanaPassword: process.env.GRAFANA_PASSWORD || 'admin123',
      prometheusRetention: process.env.PROMETHEUS_RETENTION || '30d',
      alertmanagerWebhook: process.env.ALERTMANAGER_WEBHOOK || 'http://localhost:5001/webhook',
      enableEmailAlerts: process.env.ENABLE_EMAIL_ALERTS === 'true',
      emailConfig:
        process.env.ENABLE_EMAIL_ALERTS === 'true'
          ? {
              smtpHost: process.env.SMTP_HOST || 'localhost',
              smtpPort: Number.parseInt(process.env.SMTP_PORT || '587'),
              smtpUser: process.env.SMTP_USER || '',
              smtpPassword: process.env.SMTP_PASSWORD || '',
              fromEmail: process.env.FROM_EMAIL || 'alerts@nextgen-marketplace.com',
              toEmail: process.env.TO_EMAIL || 'admin@nextgen-marketplace.com',
            }
          : undefined,
    };
  }

  async setup(): Promise<void> {
    try {
      // Step 1: Create monitoring directories
      await this.createDirectories();

      // Step 2: Generate configuration files
      await this.generateConfigs();

      // Step 3: Start monitoring services
      await this.startServices();

      // Step 4: Wait for services to be ready
      await this.waitForServices();

      // Step 5: Import Grafana dashboards
      await this.importDashboards();

      // Step 6: Validate setup
      await this.validateSetup();
    } catch (error) {
      console.error('❌ Monitoring setup failed:', error);
      process.exit(1);
    }
  }

  private async createDirectories(): Promise<void> {
    const dirs = [
      'monitoring/grafana/provisioning/dashboards',
      'monitoring/grafana/provisioning/datasources',
      'monitoring/prometheus',
      'monitoring/alertmanager',
      'monitoring/data/prometheus',
      'monitoring/data/grafana',
      'monitoring/data/alertmanager',
    ];

    dirs.forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  private async generateConfigs(): Promise<void> {
    // Generate AlertManager config with email if enabled
    if (this.config.enableEmailAlerts && this.config.emailConfig) {
      const alertmanagerConfig = this.generateAlertManagerConfigWithEmail();
      writeFileSync('monitoring/alertmanager/alertmanager.yml', alertmanagerConfig);
    }

    // Generate environment file
    const envConfig = this.generateEnvConfig();
    writeFileSync('monitoring/.env', envConfig);
  }

  private async startServices(): Promise<void> {
    try {
      // Create network if it doesn't exist
      try {
        execSync('docker network create nextgen-network', { stdio: 'pipe' });
      } catch (_error) {
        // Network might already exist
      }

      // Start monitoring stack
      execSync('docker-compose -f docker-compose.monitoring.yml up -d', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (error) {
      throw new Error(`Failed to start services: ${error}`);
    }
  }

  private async waitForServices(): Promise<void> {
    const services = [
      { name: 'Prometheus', url: 'http://localhost:9090/-/ready', timeout: 60000 },
      { name: 'Grafana', url: 'http://localhost:3000/api/health', timeout: 60000 },
      { name: 'AlertManager', url: 'http://localhost:9093/-/ready', timeout: 30000 },
    ];

    for (const service of services) {
      await this.waitForService(service.name, service.url, service.timeout);
    }
  }

  private async waitForService(name: string, url: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch (_error) {
        // Service not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`${name} failed to start within ${timeout}ms`);
  }

  private async importDashboards(): Promise<void> {
    // Wait a bit more for Grafana to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const dashboards = [
      'nextgen-main-dashboard.json',
      'nextgen-performance-dashboard.json',
      'nextgen-security-dashboard.json',
      'nextgen-clickhouse-dashboard.json',
    ];

    for (const dashboard of dashboards) {
      try {
        const dashboardPath = join('monitoring/grafana/dashboards', dashboard);
        if (existsSync(dashboardPath)) {
          // Import dashboard via Grafana API
          await this.importDashboard(dashboardPath);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to import ${dashboard}: ${error.message}`);
      }
    }
  }

  private async importDashboard(_dashboardPath: string): Promise<void> {}

  private async validateSetup(): Promise<void> {
    const checks = [
      { name: 'Prometheus targets', check: () => this.checkPrometheusTargets() },
      { name: 'Grafana datasources', check: () => this.checkGrafanaDatasources() },
      { name: 'AlertManager config', check: () => this.checkAlertManagerConfig() },
    ];

    for (const { name, check } of checks) {
      try {
        await check();
      } catch (error) {
        console.warn(`   ⚠️ ${name} issue: ${error.message}`);
      }
    }
  }

  private async checkPrometheusTargets(): Promise<void> {
    const response = await fetch('http://localhost:9090/api/v1/targets');
    if (!response.ok) {
      throw new Error('Prometheus targets API not accessible');
    }

    const data = await response.json();
    const activeTargets = data.data.activeTargets.filter((t: any) => t.health === 'up').length;

    if (activeTargets === 0) {
      throw new Error('No active Prometheus targets found');
    }
  }

  private async checkGrafanaDatasources(): Promise<void> {
    const response = await fetch('http://admin:admin123@localhost:3000/api/datasources');
    if (!response.ok) {
      throw new Error('Grafana datasources API not accessible');
    }

    const datasources = await response.json();
    if (datasources.length === 0) {
      throw new Error('No Grafana datasources configured');
    }
  }

  private async checkAlertManagerConfig(): Promise<void> {
    const response = await fetch('http://localhost:9093/api/v1/status/config');
    if (!response.ok) {
      throw new Error('AlertManager config API not accessible');
    }
  }

  private generateAlertManagerConfigWithEmail(): string {
    const { emailConfig } = this.config;

    return `
global:
  smtp_smarthost: '${emailConfig?.smtpHost}:${emailConfig?.smtpPort}'
  smtp_from: '${emailConfig?.fromEmail}'
  smtp_auth_username: '${emailConfig?.smtpUser}'
  smtp_auth_password: '${emailConfig?.smtpPassword}'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 5s
      repeat_interval: 5m
    - match:
        severity: warning
      receiver: 'warning-alerts'
      repeat_interval: 30m

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: '${this.config.alertmanagerWebhook}'

  - name: 'critical-alerts'
    webhook_configs:
      - url: '${this.config.alertmanagerWebhook}/critical'
        send_resolved: true
    email_configs:
      - to: '${emailConfig?.toEmail}'
        subject: 'CRITICAL: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Severity: {{ .Labels.severity }}
          Time: {{ .StartsAt }}
          {{ end }}

  - name: 'warning-alerts'
    webhook_configs:
      - url: '${this.config.alertmanagerWebhook}/warning'
        send_resolved: true
    email_configs:
      - to: '${emailConfig?.toEmail}'
        subject: 'WARNING: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
`.trim();
  }

  private generateEnvConfig(): string {
    return `
# NextGen Monitoring Configuration
GRAFANA_PASSWORD=${this.config.grafanaPassword}
PROMETHEUS_RETENTION=${this.config.prometheusRetention}
ALERTMANAGER_WEBHOOK=${this.config.alertmanagerWebhook}
ENABLE_EMAIL_ALERTS=${this.config.enableEmailAlerts}

# Email Configuration (if enabled)
${
  this.config.emailConfig
    ? `
SMTP_HOST=${this.config.emailConfig.smtpHost}
SMTP_PORT=${this.config.emailConfig.smtpPort}
SMTP_USER=${this.config.emailConfig.smtpUser}
SMTP_PASSWORD=${this.config.emailConfig.smtpPassword}
FROM_EMAIL=${this.config.emailConfig.fromEmail}
TO_EMAIL=${this.config.emailConfig.toEmail}
`
    : '# Email alerts disabled'
}
`.trim();
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new MonitoringSetup();
  setup.setup().catch(console.error);
}

export { MonitoringSetup };

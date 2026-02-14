#!/usr/bin/env ts-node

// ═══════════════════════════════════════════════════════════════════════════
// Monitoring Validation Script - Complete Health Check
// ═══════════════════════════════════════════════════════════════════════════

import { execSync } from 'node:child_process';

interface ValidationResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: string;
  metrics?: any;
}

class MonitoringValidator {
  private results: ValidationResult[] = [];

  async validate(): Promise<void> {
    const validations = [
      { name: 'Docker Services', check: () => this.checkDockerServices() },
      { name: 'Prometheus', check: () => this.checkPrometheus() },
      { name: 'Grafana', check: () => this.checkGrafana() },
      { name: 'AlertManager', check: () => this.checkAlertManager() },
      { name: 'Node Exporter', check: () => this.checkNodeExporter() },
      { name: 'PostgreSQL Exporter', check: () => this.checkPostgresExporter() },
      { name: 'KeyDB Exporter', check: () => this.checkKeyDBExporter() },
      { name: 'ClickHouse Exporter', check: () => this.checkClickHouseExporter() },
      { name: 'API Metrics', check: () => this.checkAPIMetrics() },
      { name: 'Alert Rules', check: () => this.checkAlertRules() },
      { name: 'Dashboards', check: () => this.checkDashboards() },
    ];

    for (const validation of validations) {
      try {
        const result = await validation.check();
        this.results.push(result);
        this.logResult(result);
      } catch (error) {
        const result: ValidationResult = {
          service: validation.name,
          status: 'unhealthy',
          responseTime: 0,
          details: error.message,
        };
        this.results.push(result);
        this.logResult(result);
      }
    }

    this.printSummary();
  }

  private async checkDockerServices(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const output = execSync('docker-compose -f docker-compose.monitoring.yml ps --format json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const services = JSON.parse(`[${output.trim().split('\n').join(',')}]`);
      const runningServices = services.filter((s: any) => s.State === 'running');
      const totalServices = services.length;

      const responseTime = Date.now() - startTime;
      const status =
        runningServices.length === totalServices
          ? 'healthy'
          : runningServices.length > 0
            ? 'degraded'
            : 'unhealthy';

      return {
        service: 'Docker Services',
        status,
        responseTime,
        details: `${runningServices.length}/${totalServices} services running`,
        metrics: { running: runningServices.length, total: totalServices },
      };
    } catch (error) {
      throw new Error(`Docker services check failed: ${error.message}`);
    }
  }

  private async checkPrometheus(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Check health
      const healthResponse = await fetch('http://localhost:9090/-/healthy');
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }

      // Check targets
      const targetsResponse = await fetch('http://localhost:9090/api/v1/targets');
      const targetsData = await targetsResponse.json();

      const activeTargets = targetsData.data.activeTargets.filter((t: any) => t.health === 'up');
      const totalTargets = targetsData.data.activeTargets.length;

      const responseTime = Date.now() - startTime;
      const status =
        activeTargets.length === totalTargets
          ? 'healthy'
          : activeTargets.length > 0
            ? 'degraded'
            : 'unhealthy';

      return {
        service: 'Prometheus',
        status,
        responseTime,
        details: `${activeTargets.length}/${totalTargets} targets healthy`,
        metrics: { activeTargets: activeTargets.length, totalTargets },
      };
    } catch (error) {
      throw new Error(`Prometheus check failed: ${error.message}`);
    }
  }

  private async checkGrafana(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Check health
      const healthResponse = await fetch('http://localhost:3000/api/health');
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }

      // Check datasources
      const dsResponse = await fetch('http://admin:admin123@localhost:3000/api/datasources');
      const datasources = await dsResponse.json();

      const responseTime = Date.now() - startTime;
      const status = datasources.length > 0 ? 'healthy' : 'degraded';

      return {
        service: 'Grafana',
        status,
        responseTime,
        details: `${datasources.length} datasources configured`,
        metrics: { datasources: datasources.length },
      };
    } catch (error) {
      throw new Error(`Grafana check failed: ${error.message}`);
    }
  }

  private async checkAlertManager(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch('http://localhost:9093/-/healthy');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      // Check config
      const configResponse = await fetch('http://localhost:9093/api/v1/status/config');
      const configData = await configResponse.json();

      const responseTime = Date.now() - startTime;
      const status = configData.status === 'success' ? 'healthy' : 'degraded';

      return {
        service: 'AlertManager',
        status,
        responseTime,
        details: 'Configuration loaded successfully',
      };
    } catch (error) {
      throw new Error(`AlertManager check failed: ${error.message}`);
    }
  }

  private async checkNodeExporter(): Promise<ValidationResult> {
    return this.checkExporter('Node Exporter', 'http://localhost:9100/metrics');
  }

  private async checkPostgresExporter(): Promise<ValidationResult> {
    return this.checkExporter('PostgreSQL Exporter', 'http://localhost:9187/metrics');
  }

  private async checkKeyDBExporter(): Promise<ValidationResult> {
    return this.checkExporter('KeyDB Exporter', 'http://localhost:9121/metrics');
  }

  private async checkClickHouseExporter(): Promise<ValidationResult> {
    return this.checkExporter('ClickHouse Exporter', 'http://localhost:9116/metrics');
  }

  private async checkExporter(name: string, url: string): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Metrics endpoint failed: ${response.status}`);
      }

      const metrics = await response.text();
      const metricCount = metrics
        .split('\n')
        .filter((line) => line.startsWith('#') === false && line.trim() !== '').length;

      const responseTime = Date.now() - startTime;
      const status = metricCount > 0 ? 'healthy' : 'degraded';

      return {
        service: name,
        status,
        responseTime,
        details: `${metricCount} metrics exposed`,
        metrics: { metricCount },
      };
    } catch (error) {
      throw new Error(`${name} check failed: ${error.message}`);
    }
  }

  private async checkAPIMetrics(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Check if API is running and exposing metrics
      const response = await fetch('http://localhost:3001/health/metrics');
      if (!response.ok) {
        throw new Error(`API metrics endpoint failed: ${response.status}`);
      }

      const metrics = await response.text();
      const metricCount = metrics
        .split('\n')
        .filter((line) => line.startsWith('#') === false && line.trim() !== '').length;

      const responseTime = Date.now() - startTime;
      const status = metricCount > 0 ? 'healthy' : 'degraded';

      return {
        service: 'API Metrics',
        status,
        responseTime,
        details: `${metricCount} application metrics exposed`,
        metrics: { metricCount },
      };
    } catch (_error) {
      // API might not be running, which is OK for monitoring validation
      return {
        service: 'API Metrics',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        details: 'API not running (start with: pnpm dev:api)',
      };
    }
  }

  private async checkAlertRules(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch('http://localhost:9090/api/v1/rules');
      const data = await response.json();

      const ruleGroups = data.data.groups || [];
      const totalRules = ruleGroups.reduce(
        (sum: number, group: any) => sum + group.rules.length,
        0
      );

      const responseTime = Date.now() - startTime;
      const status = totalRules > 0 ? 'healthy' : 'degraded';

      return {
        service: 'Alert Rules',
        status,
        responseTime,
        details: `${totalRules} alert rules loaded`,
        metrics: { ruleGroups: ruleGroups.length, totalRules },
      };
    } catch (error) {
      throw new Error(`Alert rules check failed: ${error.message}`);
    }
  }

  private async checkDashboards(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch('http://admin:admin123@localhost:3000/api/search?type=dash-db');
      const dashboards = await response.json();

      const responseTime = Date.now() - startTime;
      const status = dashboards.length > 0 ? 'healthy' : 'degraded';

      return {
        service: 'Dashboards',
        status,
        responseTime,
        details: `${dashboards.length} dashboards available`,
        metrics: { dashboardCount: dashboards.length },
      };
    } catch (error) {
      throw new Error(`Dashboards check failed: ${error.message}`);
    }
  }

  private logResult(result: ValidationResult): void {
    const _statusIcon = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
    }[result.status];

    const _responseTime =
      result.responseTime < 1000
        ? `${result.responseTime}ms`
        : `${(result.responseTime / 1000).toFixed(2)}s`;
  }

  private printSummary(): void {
    const _healthy = this.results.filter((r) => r.status === 'healthy').length;
    const degraded = this.results.filter((r) => r.status === 'degraded').length;
    const unhealthy = this.results.filter((r) => r.status === 'unhealthy').length;
    const _total = this.results.length;

    const overallStatus = unhealthy > 0 ? 'UNHEALTHY' : degraded > 0 ? 'DEGRADED' : 'HEALTHY';

    if (overallStatus === 'HEALTHY') {
    } else if (degraded > 0) {
    }

    // Exit with appropriate code
    process.exit(unhealthy > 0 ? 1 : 0);
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MonitoringValidator();
  validator.validate().catch(console.error);
}

export { MonitoringValidator };

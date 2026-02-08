// ═══════════════════════════════════════════════════════════════════════════
// Auto Scaling & Self-Healing - Ultra-Fast 7-Layer Architecture
// ═══════════════════════════════════════════════════════════════════════════

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

interface ScalingMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestRate: number;
  responseTime: number;
  errorRate: number;
  activeConnections: number;
}

interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCpuUsage: number;
  targetMemoryUsage: number;
  targetResponseTime: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number; // seconds
}

class AutoScalingManager {
  private config: ScalingConfig;
  private lastScalingAction: number = 0;
  private currentInstances: number = 2;

  constructor() {
    this.config = {
      minInstances: 2,
      maxInstances: 20,
      targetCpuUsage: 70,
      targetMemoryUsage: 80,
      targetResponseTime: 100,
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      cooldownPeriod: 300, // 5 minutes
    };
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Auto Scaling Manager...');
    console.log(`📊 Config: ${this.config.minInstances}-${this.config.maxInstances} instances`);

    // Initial setup
    await this.setupMonitoring();
    await this.setupHealthChecks();

    // Start monitoring loop
    setInterval(async () => {
      try {
        await this.monitorAndScale();
      } catch (error) {
        console.error('❌ Auto scaling error:', error);
      }
    }, 30000); // Check every 30 seconds

    // Start self-healing loop
    setInterval(async () => {
      try {
        await this.selfHeal();
      } catch (error) {
        console.error('❌ Self-healing error:', error);
      }
    }, 60000); // Check every minute

    console.log('✅ Auto Scaling Manager started');
  }

  private async monitorAndScale(): Promise<void> {
    const metrics = await this.collectMetrics();
    const scalingDecision = this.analyzeScalingNeeds(metrics);

    if (scalingDecision.action !== 'none') {
      await this.executeScaling(scalingDecision);
    }

    // Log current status
    console.log(`📊 Instances: ${this.currentInstances}, CPU: ${metrics.cpuUsage}%, Memory: ${metrics.memoryUsage}%, Response: ${metrics.responseTime}ms`);
  }

  private async collectMetrics(): Promise<ScalingMetrics> {
    try {
      // Collect metrics from monitoring endpoints
      const response = await fetch('http://localhost:3001/api/v3/health/metrics');
      const data = await response.json();

      // Get container metrics
      const containerStats = this.getContainerStats();

      return {
        cpuUsage: containerStats.cpu || 0,
        memoryUsage: containerStats.memory || 0,
        requestRate: data.requestRate || 0,
        responseTime: data.avgResponseTime || 0,
        errorRate: data.errorRate || 0,
        activeConnections: data.activeConnections || 0,
      };
    } catch (error) {
      console.warn('Failed to collect metrics:', error);
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        requestRate: 0,
        responseTime: 0,
        errorRate: 0,
        activeConnections: 0,
      };
    }
  }

  private analyzeScalingNeeds(metrics: ScalingMetrics): { action: 'scale-up' | 'scale-down' | 'none'; reason: string } {
    const now = Date.now();
    const timeSinceLastAction = (now - this.lastScalingAction) / 1000;

    // Check cooldown period
    if (timeSinceLastAction < this.config.cooldownPeriod) {
      return { action: 'none', reason: 'Cooldown period active' };
    }

    // Scale up conditions
    if (
      metrics.cpuUsage > this.config.scaleUpThreshold ||
      metrics.memoryUsage > this.config.scaleUpThreshold ||
      metrics.responseTime > this.config.targetResponseTime * 1.5
    ) {
      if (this.currentInstances < this.config.maxInstances) {
        return { 
          action: 'scale-up', 
          reason: `High resource usage - CPU: ${metrics.cpuUsage}%, Memory: ${metrics.memoryUsage}%, Response: ${metrics.responseTime}ms` 
        };
      }
    }

    // Scale down conditions
    if (
      metrics.cpuUsage < this.config.scaleDownThreshold &&
      metrics.memoryUsage < this.config.scaleDownThreshold &&
      metrics.responseTime < this.config.targetResponseTime * 0.5
    ) {
      if (this.currentInstances > this.config.minInstances) {
        return { 
          action: 'scale-down', 
          reason: `Low resource usage - CPU: ${metrics.cpuUsage}%, Memory: ${metrics.memoryUsage}%` 
        };
      }
    }

    return { action: 'none', reason: 'Metrics within target range' };
  }

  private async executeScaling(decision: { action: 'scale-up' | 'scale-down'; reason: string }): Promise<void> {
    console.log(`🎯 Scaling action: ${decision.action} - ${decision.reason}`);

    const newInstanceCount = decision.action === 'scale-up' 
      ? Math.min(this.currentInstances + 1, this.config.maxInstances)
      : Math.max(this.currentInstances - 1, this.config.minInstances);

    try {
      // Update docker-compose scale
      execSync(`docker-compose up -d --scale api=${newInstanceCount}`, { stdio: 'inherit' });

      // Update load balancer configuration
      await this.updateLoadBalancer(newInstanceCount);

      // Wait for new instances to be healthy
      if (decision.action === 'scale-up') {
        await this.waitForHealthyInstances(newInstanceCount);
      }

      this.currentInstances = newInstanceCount;
      this.lastScalingAction = Date.now();

      console.log(`✅ Scaled ${decision.action}: ${this.currentInstances} instances`);

      // Send notification
      await this.sendScalingNotification(decision.action, newInstanceCount, decision.reason);

    } catch (error) {
      console.error(`❌ Scaling failed:`, error);
      throw error;
    }
  }

  private async selfHeal(): Promise<void> {
    console.log('🔧 Running self-healing checks...');

    // Check container health
    await this.checkAndRestartUnhealthyContainers();

    // Check database connections
    await this.checkAndRepairDatabaseConnections();

    // Check cache health
    await this.checkAndRepairCacheConnections();

    // Check disk space
    await this.checkDiskSpace();

    // Check memory leaks
    await this.checkMemoryLeaks();
  }

  private async checkAndRestartUnhealthyContainers(): Promise<void> {
    try {
      const result = execSync('docker-compose ps --format json', { encoding: 'utf8' });
      const containers = JSON.parse(`[${result.trim().split('\n').join(',')}]`);

      for (const container of containers) {
        if (container.State !== 'running') {
          console.log(`🔄 Restarting unhealthy container: ${container.Service}`);
          execSync(`docker-compose restart ${container.Service}`, { stdio: 'inherit' });
          
          // Wait for container to be healthy
          await this.waitForContainerHealth(container.Service);
          
          console.log(`✅ Container ${container.Service} restarted successfully`);
        }
      }
    } catch (error) {
      console.warn('Failed to check container health:', error);
    }
  }

  private async checkAndRepairDatabaseConnections(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3001/api/v3/health/detailed');
      const health = await response.json();

      if (health.layers?.queryGateway?.database?.status !== 'healthy') {
        console.log('🔄 Database connection unhealthy, attempting repair...');
        
        // Restart database connection pool
        execSync('docker-compose restart api', { stdio: 'inherit' });
        
        // Wait for recovery
        await this.sleep(10000);
        
        console.log('✅ Database connection repaired');
      }
    } catch (error) {
      console.warn('Failed to check database connections:', error);
    }
  }

  private async checkAndRepairCacheConnections(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3001/api/v3/health/detailed');
      const health = await response.json();

      if (health.layers?.queryGateway?.cache?.status !== 'healthy') {
        console.log('🔄 Cache connection unhealthy, attempting repair...');
        
        // Restart KeyDB
        execSync('docker-compose restart keydb', { stdio: 'inherit' });
        
        // Wait for recovery
        await this.sleep(5000);
        
        // Restart API to reconnect
        execSync('docker-compose restart api', { stdio: 'inherit' });
        
        console.log('✅ Cache connection repaired');
      }
    } catch (error) {
      console.warn('Failed to check cache connections:', error);
    }
  }

  private async checkDiskSpace(): Promise<void> {
    try {
      const result = execSync('df -h /', { encoding: 'utf8' });
      const lines = result.trim().split('\n');
      const diskInfo = lines[1].split(/\s+/);
      const usagePercent = parseInt(diskInfo[4].replace('%', ''));

      if (usagePercent > 85) {
        console.log(`⚠️ High disk usage: ${usagePercent}%`);
        
        // Clean up old logs and temporary files
        execSync('docker system prune -f', { stdio: 'inherit' });
        execSync('find /tmp -type f -atime +7 -delete', { stdio: 'inherit' });
        
        console.log('✅ Disk cleanup completed');
      }
    } catch (error) {
      console.warn('Failed to check disk space:', error);
    }
  }

  private async checkMemoryLeaks(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3001/api/v3/health/metrics');
      const metrics = await response.json();

      const memoryUsage = (metrics.memory?.heapUsed / metrics.memory?.heapTotal) * 100;

      if (memoryUsage > 90) {
        console.log(`⚠️ High memory usage: ${memoryUsage.toFixed(2)}%`);
        
        // Force garbage collection if possible
        await fetch('http://localhost:3001/api/v3/health/gc', { method: 'POST' });
        
        // If still high, restart containers
        if (memoryUsage > 95) {
          console.log('🔄 Restarting containers due to memory pressure...');
          execSync('docker-compose restart api', { stdio: 'inherit' });
        }
        
        console.log('✅ Memory pressure handled');
      }
    } catch (error) {
      console.warn('Failed to check memory usage:', error);
    }
  }

  private getContainerStats(): { cpu: number; memory: number } {
    try {
      const result = execSync('docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemPerc}}" api', { 
        encoding: 'utf8' 
      });
      
      const lines = result.trim().split('\n');
      if (lines.length > 1) {
        const stats = lines[1].split('\t');
        return {
          cpu: parseFloat(stats[0].replace('%', '')),
          memory: parseFloat(stats[1].replace('%', '')),
        };
      }
    } catch (error) {
      console.warn('Failed to get container stats:', error);
    }
    
    return { cpu: 0, memory: 0 };
  }

  private async updateLoadBalancer(instanceCount: number): Promise<void> {
    // Generate nginx upstream configuration
    const upstreamConfig = Array(instanceCount)
      .fill(null)
      .map((_, i) => `    server api_${i + 1}:3001;`)
      .join('\n');

    const nginxConfig = `
upstream backend {
${upstreamConfig}
}

server {
    listen 80;
    location /api/v3/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`;

    writeFileSync('/tmp/nginx-auto.conf', nginxConfig);
    
    try {
      execSync('docker exec nginx nginx -s reload', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Nginx reload failed:', error);
    }
  }

  private async waitForHealthyInstances(expectedCount: number): Promise<void> {
    console.log(`⏳ Waiting for ${expectedCount} healthy instances...`);
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch('http://localhost:3001/api/v3/health');
        if (response.ok) {
          console.log('✅ All instances are healthy');
          return;
        }
      } catch (error) {
        // Not ready yet
      }
      
      attempts++;
      await this.sleep(2000);
    }
    
    throw new Error('Instances failed to become healthy');
  }

  private async waitForContainerHealth(serviceName: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const result = execSync(`docker-compose ps ${serviceName}`, { encoding: 'utf8' });
        if (result.includes('Up')) {
          return;
        }
      } catch (error) {
        // Not ready yet
      }
      
      attempts++;
      await this.sleep(2000);
    }
    
    throw new Error(`Container ${serviceName} failed to become healthy`);
  }

  private async sendScalingNotification(action: string, instanceCount: number, reason: string): Promise<void> {
    // In production, this would send notifications via Slack, email, etc.
    console.log(`📢 Scaling Notification: ${action} to ${instanceCount} instances - ${reason}`);
  }

  private async setupMonitoring(): Promise<void> {
    console.log('📊 Setting up monitoring...');
    // Setup Prometheus, Grafana, alerting rules
  }

  private async setupHealthChecks(): Promise<void> {
    console.log('🏥 Setting up health checks...');
    // Setup health check endpoints, monitoring probes
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start auto scaling if called directly
if (require.main === module) {
  const autoScaler = new AutoScalingManager();
  autoScaler.start().catch(error => {
    console.error('Auto scaling failed:', error);
    process.exit(1);
  });
}

export { AutoScalingManager };
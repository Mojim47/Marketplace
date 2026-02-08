#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Complete Health Check
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Runtime health check of all services and components
 * Usage: pnpm tsx scripts/health-check-complete.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@clickhouse/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface HealthCheckResult {
  service: string;
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  responseTime?: number;
  message: string;
  details?: any;
}

class HealthChecker {
  private results: HealthCheckResult[] = [];

  async runHealthCheck(): Promise<void> {
    console.log('🏥 NextGen Marketplace - Complete Health Check');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Run all health checks
    await this.checkDockerServices();
    await this.checkClickHouse();
    await this.checkTypesense();
    await this.checkRedis();
    await this.checkPostgreSQL();
    await this.checkVectorProcessor();
    await this.checkNetworkConnectivity();
    await this.checkDiskSpace();
    await this.checkMemoryUsage();

    // Generate report
    this.generateHealthReport();
  }

  private async checkDockerServices(): Promise<void> {
    console.log('🐳 Checking Docker Services...');

    try {
      // Check if Docker is running
      const { stdout: dockerVersion } = await execAsync('docker --version');
      console.log(`   📦 Docker Version: ${dockerVersion.trim()}`);

      // Check ClickHouse services
      const services = [
        'nextgen-clickhouse',
        'nextgen-tabix',
        'nextgen-vector',
      ];

      for (const service of services) {
        try {
          const { stdout } = await execAsync(`docker ps --filter "name=${service}" --format "{{.Status}}"`);
          const isRunning = stdout.includes('Up');
          
          this.results.push({
            service: `Docker: ${service}`,
            status: isRunning ? 'HEALTHY' : 'UNHEALTHY',
            message: isRunning ? `✅ ${service} is running` : `❌ ${service} is not running`,
          });
        } catch (error) {
          this.results.push({
            service: `Docker: ${service}`,
            status: 'UNHEALTHY',
            message: `❌ Failed to check ${service}: ${error.message}`,
          });
        }
      }

    } catch (error) {
      this.results.push({
        service: 'Docker',
        status: 'UNHEALTHY',
        message: `❌ Docker not available: ${error.message}`,
      });
    }

    console.log('   ✅ Docker services check completed\n');
  }

  private async checkClickHouse(): Promise<void> {
    console.log('🗄️ Checking ClickHouse...');

    const startTime = Date.now();
    
    try {
      const client = createClient({
        host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
        database: process.env.CLICKHOUSE_DB || 'nextgen_analytics',
        username: process.env.CLICKHOUSE_USER || 'analytics',
        password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse_secret_2024',
      });

      // Test connection
      const pingResult = await client.ping();
      const responseTime = Date.now() - startTime;

      if (pingResult.success) {
        // Check database and tables
        const tablesResult = await client.query({
          query: `
            SELECT name, engine, total_rows, total_bytes 
            FROM system.tables 
            WHERE database = '${process.env.CLICKHOUSE_DB || 'nextgen_analytics'}'
            AND name IN ('search_events', 'failed_searches', 'product_impressions', 'user_sessions')
          `,
          format: 'JSONEachRow',
        });

        const tables = await tablesResult.json() as any[];
        
        this.results.push({
          service: 'ClickHouse',
          status: 'HEALTHY',
          responseTime,
          message: `✅ ClickHouse healthy (${responseTime}ms)`,
          details: {
            tables: tables.length,
            tableNames: tables.map(t => t.name),
          },
        });

        // Check each required table
        const requiredTables = ['search_events', 'failed_searches', 'product_impressions', 'user_sessions'];
        for (const tableName of requiredTables) {
          const tableExists = tables.some(t => t.name === tableName);
          this.results.push({
            service: `ClickHouse Table: ${tableName}`,
            status: tableExists ? 'HEALTHY' : 'UNHEALTHY',
            message: tableExists ? `✅ Table ${tableName} exists` : `❌ Table ${tableName} missing`,
          });
        }

      } else {
        this.results.push({
          service: 'ClickHouse',
          status: 'UNHEALTHY',
          responseTime,
          message: `❌ ClickHouse ping failed (${responseTime}ms)`,
        });
      }

      await client.close();

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'ClickHouse',
        status: 'UNHEALTHY',
        responseTime,
        message: `❌ ClickHouse connection failed: ${error.message}`,
      });
    }

    console.log('   ✅ ClickHouse check completed\n');
  }

  private async checkTypesense(): Promise<void> {
    console.log('🔍 Checking Typesense...');

    const startTime = Date.now();
    
    try {
      const typesenseHost = process.env.TYPESENSE_HOST || 'localhost';
      const typesensePort = process.env.TYPESENSE_PORT || '8108';
      const typesenseApiKey = process.env.TYPESENSE_API_KEY || 'typesense_api_key_2024';
      
      const response = await fetch(`http://${typesenseHost}:${typesensePort}/health`, {
        headers: {
          'X-TYPESENSE-API-KEY': typesenseApiKey,
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const health = await response.json();
        
        this.results.push({
          service: 'Typesense',
          status: 'HEALTHY',
          responseTime,
          message: `✅ Typesense healthy (${responseTime}ms)`,
          details: health,
        });

        // Check collections
        try {
          const collectionsResponse = await fetch(`http://${typesenseHost}:${typesensePort}/collections`, {
            headers: {
              'X-TYPESENSE-API-KEY': typesenseApiKey,
            },
          });

          if (collectionsResponse.ok) {
            const collections = await collectionsResponse.json();
            const hasProductsCollection = collections.some((c: any) => c.name === 'products');
            
            this.results.push({
              service: 'Typesense Collections',
              status: hasProductsCollection ? 'HEALTHY' : 'DEGRADED',
              message: hasProductsCollection ? '✅ Products collection exists' : '⚠️ Products collection missing',
              details: { collections: collections.length },
            });
          }
        } catch (error) {
          this.results.push({
            service: 'Typesense Collections',
            status: 'DEGRADED',
            message: `⚠️ Could not check collections: ${error.message}`,
          });
        }

      } else {
        this.results.push({
          service: 'Typesense',
          status: 'UNHEALTHY',
          responseTime,
          message: `❌ Typesense unhealthy: ${response.status} ${response.statusText}`,
        });
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'Typesense',
        status: 'UNHEALTHY',
        responseTime,
        message: `❌ Typesense connection failed: ${error.message}`,
      });
    }

    console.log('   ✅ Typesense check completed\n');
  }

  private async checkRedis(): Promise<void> {
    console.log('🔴 Checking Redis/DragonflyDB...');

    const startTime = Date.now();
    
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || '6379';
      const redisPassword = process.env.REDIS_PASSWORD || 'redis_secret_2024';

      // Simple Redis ping using redis-cli if available
      try {
        const { stdout } = await execAsync(`redis-cli -h ${redisHost} -p ${redisPort} -a ${redisPassword} ping`);
        const responseTime = Date.now() - startTime;
        
        if (stdout.trim() === 'PONG') {
          this.results.push({
            service: 'Redis/DragonflyDB',
            status: 'HEALTHY',
            responseTime,
            message: `✅ Redis healthy (${responseTime}ms)`,
          });
        } else {
          this.results.push({
            service: 'Redis/DragonflyDB',
            status: 'UNHEALTHY',
            responseTime,
            message: `❌ Redis ping failed: ${stdout}`,
          });
        }
      } catch (error) {
        // If redis-cli is not available, try telnet approach
        this.results.push({
          service: 'Redis/DragonflyDB',
          status: 'DEGRADED',
          message: `⚠️ Could not check Redis (redis-cli not available): ${error.message}`,
        });
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'Redis/DragonflyDB',
        status: 'UNHEALTHY',
        responseTime,
        message: `❌ Redis check failed: ${error.message}`,
      });
    }

    console.log('   ✅ Redis check completed\n');
  }

  private async checkPostgreSQL(): Promise<void> {
    console.log('🐘 Checking PostgreSQL...');

    try {
      // Check if PostgreSQL is accessible via Docker
      const { stdout } = await execAsync('docker ps --filter "name=nextgen-postgres" --format "{{.Status}}"');
      const isRunning = stdout.includes('Up');
      
      this.results.push({
        service: 'PostgreSQL',
        status: isRunning ? 'HEALTHY' : 'UNHEALTHY',
        message: isRunning ? '✅ PostgreSQL container running' : '❌ PostgreSQL container not running',
      });

    } catch (error) {
      this.results.push({
        service: 'PostgreSQL',
        status: 'DEGRADED',
        message: `⚠️ Could not check PostgreSQL: ${error.message}`,
      });
    }

    console.log('   ✅ PostgreSQL check completed\n');
  }

  private async checkVectorProcessor(): Promise<void> {
    console.log('📊 Checking Vector Log Processor...');

    const startTime = Date.now();
    
    try {
      const vectorHost = process.env.VECTOR_HOST || 'localhost';
      const vectorPort = process.env.VECTOR_API_PORT || '8686';
      
      const response = await fetch(`http://${vectorHost}:${vectorPort}/health`);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const health = await response.json();
        
        this.results.push({
          service: 'Vector Processor',
          status: 'HEALTHY',
          responseTime,
          message: `✅ Vector healthy (${responseTime}ms)`,
          details: health,
        });
      } else {
        this.results.push({
          service: 'Vector Processor',
          status: 'UNHEALTHY',
          responseTime,
          message: `❌ Vector unhealthy: ${response.status}`,
        });
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'Vector Processor',
        status: 'UNHEALTHY',
        responseTime,
        message: `❌ Vector connection failed: ${error.message}`,
      });
    }

    console.log('   ✅ Vector processor check completed\n');
  }

  private async checkNetworkConnectivity(): Promise<void> {
    console.log('🌐 Checking Network Connectivity...');

    const endpoints = [
      { name: 'ClickHouse HTTP', url: `http://localhost:${process.env.CLICKHOUSE_HTTP_PORT || '8123'}/ping` },
      { name: 'Tabix UI', url: `http://localhost:${process.env.TABIX_PORT || '8124'}` },
      { name: 'Typesense', url: `http://localhost:${process.env.TYPESENSE_PORT || '8108'}/health` },
      { name: 'Vector API', url: `http://localhost:${process.env.VECTOR_API_PORT || '8686'}/health` },
    ];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(endpoint.url, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        
        this.results.push({
          service: `Network: ${endpoint.name}`,
          status: response.ok ? 'HEALTHY' : 'DEGRADED',
          responseTime,
          message: response.ok 
            ? `✅ ${endpoint.name} accessible (${responseTime}ms)`
            : `⚠️ ${endpoint.name} returned ${response.status}`,
        });

      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.results.push({
          service: `Network: ${endpoint.name}`,
          status: 'UNHEALTHY',
          responseTime,
          message: `❌ ${endpoint.name} not accessible: ${error.message}`,
        });
      }
    }

    console.log('   ✅ Network connectivity check completed\n');
  }

  private async checkDiskSpace(): Promise<void> {
    console.log('💾 Checking Disk Space...');

    try {
      const { stdout } = await execAsync('df -h .');
      const lines = stdout.split('\n');
      const dataLine = lines[1]; // Second line contains the data
      const parts = dataLine.split(/\s+/);
      const usedPercentage = parseInt(parts[4].replace('%', ''));
      
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      let message = `✅ Disk usage: ${parts[4]} (${parts[2]} used of ${parts[1]})`;
      
      if (usedPercentage > 90) {
        status = 'UNHEALTHY';
        message = `❌ Critical disk usage: ${parts[4]}`;
      } else if (usedPercentage > 80) {
        status = 'DEGRADED';
        message = `⚠️ High disk usage: ${parts[4]}`;
      }
      
      this.results.push({
        service: 'Disk Space',
        status,
        message,
        details: {
          total: parts[1],
          used: parts[2],
          available: parts[3],
          percentage: parts[4],
        },
      });

    } catch (error) {
      this.results.push({
        service: 'Disk Space',
        status: 'DEGRADED',
        message: `⚠️ Could not check disk space: ${error.message}`,
      });
    }

    console.log('   ✅ Disk space check completed\n');
  }

  private async checkMemoryUsage(): Promise<void> {
    console.log('🧠 Checking Memory Usage...');

    try {
      const { stdout } = await execAsync('free -h');
      const lines = stdout.split('\n');
      const memLine = lines[1]; // Memory line
      const parts = memLine.split(/\s+/);
      
      const total = parts[1];
      const used = parts[2];
      const available = parts[6] || parts[3]; // Available or free
      
      // Calculate usage percentage (rough estimate)
      const usedNum = parseFloat(used.replace(/[^\d.]/g, ''));
      const totalNum = parseFloat(total.replace(/[^\d.]/g, ''));
      const usedPercentage = Math.round((usedNum / totalNum) * 100);
      
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      let message = `✅ Memory usage: ${usedPercentage}% (${used} used of ${total})`;
      
      if (usedPercentage > 90) {
        status = 'UNHEALTHY';
        message = `❌ Critical memory usage: ${usedPercentage}%`;
      } else if (usedPercentage > 80) {
        status = 'DEGRADED';
        message = `⚠️ High memory usage: ${usedPercentage}%`;
      }
      
      this.results.push({
        service: 'Memory Usage',
        status,
        message,
        details: {
          total,
          used,
          available,
          percentage: `${usedPercentage}%`,
        },
      });

    } catch (error) {
      this.results.push({
        service: 'Memory Usage',
        status: 'DEGRADED',
        message: `⚠️ Could not check memory usage: ${error.message}`,
      });
    }

    console.log('   ✅ Memory usage check completed\n');
  }

  private generateHealthReport(): void {
    console.log('📊 HEALTH CHECK REPORT');
    console.log('═══════════════════════════════════════════════════════════════');

    // Group results by status
    const healthy = this.results.filter(r => r.status === 'HEALTHY');
    const degraded = this.results.filter(r => r.status === 'DEGRADED');
    const unhealthy = this.results.filter(r => r.status === 'UNHEALTHY');

    // Display results
    if (healthy.length > 0) {
      console.log('\n✅ HEALTHY SERVICES:');
      healthy.forEach(result => {
        const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
        console.log(`   ${result.message}${responseTime}`);
      });
    }

    if (degraded.length > 0) {
      console.log('\n⚠️  DEGRADED SERVICES:');
      degraded.forEach(result => {
        const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
        console.log(`   ${result.message}${responseTime}`);
      });
    }

    if (unhealthy.length > 0) {
      console.log('\n❌ UNHEALTHY SERVICES:');
      unhealthy.forEach(result => {
        const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
        console.log(`   ${result.message}${responseTime}`);
      });
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📈 SUMMARY:');
    console.log(`   ✅ HEALTHY: ${healthy.length}`);
    console.log(`   ⚠️  DEGRADED: ${degraded.length}`);
    console.log(`   ❌ UNHEALTHY: ${unhealthy.length}`);

    const totalServices = this.results.length;
    const healthyPercentage = ((healthy.length / totalServices) * 100).toFixed(1);
    
    console.log(`\n🎯 Overall Health: ${healthyPercentage}%`);

    // Overall status
    if (unhealthy.length === 0 && degraded.length === 0) {
      console.log('\n🎉 ALL SYSTEMS HEALTHY! ✅');
      console.log('   Your NextGen Marketplace analytics system is fully operational.');
    } else if (unhealthy.length === 0) {
      console.log('\n✅ SYSTEMS MOSTLY HEALTHY');
      console.log('   Some services are degraded but core functionality is available.');
      console.log('   Consider addressing degraded services for optimal performance.');
    } else {
      console.log('\n⚠️  SOME SYSTEMS UNHEALTHY');
      console.log(`   ${unhealthy.length} service(s) are unhealthy and need immediate attention.`);
      console.log('   Analytics functionality may be impacted.');
    }

    // Recommendations
    console.log('\n📋 RECOMMENDATIONS:');
    if (unhealthy.length === 0 && degraded.length === 0) {
      console.log('   🚀 System is ready for production use');
      console.log('   📊 Analytics data collection is fully operational');
      console.log('   🔍 Search functionality with analytics tracking is available');
    } else {
      console.log('   🔧 Address unhealthy services before production deployment');
      console.log('   📊 Monitor degraded services for potential issues');
      console.log('   🔄 Run health check again after fixing issues');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`🕐 Completed at: ${new Date().toISOString()}`);
  }
}

// Run the health check
async function main() {
  const healthChecker = new HealthChecker();
  await healthChecker.runHealthCheck();
}

main().catch(console.error);
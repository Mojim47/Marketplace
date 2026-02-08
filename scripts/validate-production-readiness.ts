#!/usr/bin/env ts-node
// ═══════════════════════════════════════════════════════════════════════════
// Production Readiness Validation Script
// ═══════════════════════════════════════════════════════════════════════════
// Validates all critical components before production deployment
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class ProductionReadinessValidator {
  private results: ValidationResult[] = [];
  private prisma: PrismaClient;
  private redis: Redis;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async validate(): Promise<void> {
    console.log('🔍 Starting Production Readiness Validation...\n');

    // Phase 1: Environment & Configuration
    await this.validateEnvironment();
    await this.validateSecrets();
    await this.validateConfiguration();

    // Phase 2: Database & Infrastructure
    await this.validateDatabase();
    await this.validateRedis();
    await this.validateClickHouse();

    // Phase 3: External Services
    await this.validateZarinPal();
    await this.validateMoodian();

    // Phase 4: Security & Performance
    await this.validateSecurity();
    await this.validatePerformance();

    // Phase 5: Application Health
    await this.validateApplication();

    // Generate report
    this.generateReport();
  }

  private async validateEnvironment(): Promise<void> {
    console.log('📋 Validating Environment Variables...');

    const requiredVars = [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'ZARINPAL_MERCHANT_ID',
      'MOODIAN_CLIENT_ID',
      'MOODIAN_CLIENT_SECRET',
      'USER_HASH_SALT',
      'CORS_ORIGINS',
      'CLICKHOUSE_URL',
      'S3_BUCKET_NAME',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMS_API_KEY',
    ];

    const missing = requiredVars.filter(envVar => !process.env[envVar]);
    const defaults = requiredVars.filter(envVar => 
      process.env[envVar] === 'CHANGE_IN_PRODUCTION' || 
      process.env[envVar] === 'CHANGE_THIS_TO_SECURE_256_BIT_KEY_IN_PRODUCTION'
    );

    if (missing.length > 0) {
      this.results.push({
        component: 'Environment Variables',
        status: 'FAIL',
        message: `Missing required environment variables: ${missing.join(', ')}`,
      });
    } else if (defaults.length > 0) {
      this.results.push({
        component: 'Environment Variables',
        status: 'FAIL',
        message: `Default values detected (security risk): ${defaults.join(', ')}`,
      });
    } else {
      this.results.push({
        component: 'Environment Variables',
        status: 'PASS',
        message: 'All required environment variables are set',
      });
    }
  }

  private async validateSecrets(): Promise<void> {
    console.log('🔐 Validating Secrets Security...');

    const jwtSecret = process.env.JWT_SECRET;
    const userSalt = process.env.USER_HASH_SALT;

    if (!jwtSecret || jwtSecret.length < 32) {
      this.results.push({
        component: 'JWT Secret',
        status: 'FAIL',
        message: 'JWT_SECRET must be at least 32 characters long',
      });
    } else if (jwtSecret.includes('CHANGE') || jwtSecret === 'your-secret-key') {
      this.results.push({
        component: 'JWT Secret',
        status: 'FAIL',
        message: 'JWT_SECRET appears to be a default value',
      });
    } else {
      this.results.push({
        component: 'JWT Secret',
        status: 'PASS',
        message: 'JWT secret is properly configured',
      });
    }

    if (!userSalt || userSalt.length < 16) {
      this.results.push({
        component: 'User Salt',
        status: 'FAIL',
        message: 'USER_HASH_SALT must be at least 16 characters long',
      });
    } else {
      this.results.push({
        component: 'User Salt',
        status: 'PASS',
        message: 'User salt is properly configured',
      });
    }
  }

  private async validateConfiguration(): Promise<void> {
    console.log('⚙️  Validating Configuration Files...');

    const configFiles = [
      'package.json',
      'tsconfig.json',
      'prisma/schema.prisma',
      '.env',
      'docker-compose.yml',
    ];

    for (const file of configFiles) {
      if (existsSync(file)) {
        this.results.push({
          component: `Config File: ${file}`,
          status: 'PASS',
          message: 'File exists',
        });
      } else {
        this.results.push({
          component: `Config File: ${file}`,
          status: 'FAIL',
          message: 'File missing',
        });
      }
    }
  }

  private async validateDatabase(): Promise<void> {
    console.log('🗄️  Validating Database Connection...');

    try {
      // Test connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Check if migrations are applied
      const migrations = await this.prisma.$queryRaw`
        SELECT * FROM "_prisma_migrations" 
        WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
      ` as any[];

      if (migrations.length > 0) {
        this.results.push({
          component: 'Database Migrations',
          status: 'FAIL',
          message: 'Pending or failed migrations detected',
          details: migrations,
        });
      } else {
        this.results.push({
          component: 'Database Migrations',
          status: 'PASS',
          message: 'All migrations applied successfully',
        });
      }

      // Check critical indexes
      const indexes = await this.prisma.$queryRaw`
        SELECT schemaname, tablename, indexname 
        FROM pg_indexes 
        WHERE indexname LIKE 'idx_%'
      ` as any[];

      if (indexes.length < 10) {
        this.results.push({
          component: 'Database Indexes',
          status: 'WARN',
          message: `Only ${indexes.length} performance indexes found`,
        });
      } else {
        this.results.push({
          component: 'Database Indexes',
          status: 'PASS',
          message: `${indexes.length} performance indexes configured`,
        });
      }

      this.results.push({
        component: 'Database Connection',
        status: 'PASS',
        message: 'Database connection successful',
      });

    } catch (error) {
      this.results.push({
        component: 'Database Connection',
        status: 'FAIL',
        message: `Database connection failed: ${error.message}`,
      });
    }
  }

  private async validateRedis(): Promise<void> {
    console.log('🔴 Validating Redis Connection...');

    try {
      await this.redis.ping();
      
      // Test set/get operations
      await this.redis.set('health-check', 'ok', 'EX', 10);
      const result = await this.redis.get('health-check');
      
      if (result === 'ok') {
        this.results.push({
          component: 'Redis Connection',
          status: 'PASS',
          message: 'Redis connection and operations successful',
        });
      } else {
        this.results.push({
          component: 'Redis Connection',
          status: 'FAIL',
          message: 'Redis operations failed',
        });
      }

      await this.redis.del('health-check');

    } catch (error) {
      this.results.push({
        component: 'Redis Connection',
        status: 'FAIL',
        message: `Redis connection failed: ${error.message}`,
      });
    }
  }

  private async validateClickHouse(): Promise<void> {
    console.log('📊 Validating ClickHouse Connection...');

    try {
      const clickhouseUrl = process.env.CLICKHOUSE_URL;
      if (!clickhouseUrl) {
        this.results.push({
          component: 'ClickHouse Connection',
          status: 'WARN',
          message: 'ClickHouse URL not configured',
        });
        return;
      }

      const response = await axios.get(`${clickhouseUrl}/ping`, { timeout: 5000 });
      
      if (response.status === 200) {
        this.results.push({
          component: 'ClickHouse Connection',
          status: 'PASS',
          message: 'ClickHouse connection successful',
        });
      } else {
        this.results.push({
          component: 'ClickHouse Connection',
          status: 'FAIL',
          message: `ClickHouse ping failed with status ${response.status}`,
        });
      }

    } catch (error) {
      this.results.push({
        component: 'ClickHouse Connection',
        status: 'FAIL',
        message: `ClickHouse connection failed: ${error.message}`,
      });
    }
  }

  private async validateZarinPal(): Promise<void> {
    console.log('💳 Validating ZarinPal Integration...');

    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';

    if (!merchantId || merchantId === 'CHANGE_IN_PRODUCTION') {
      this.results.push({
        component: 'ZarinPal Configuration',
        status: 'FAIL',
        message: 'ZarinPal merchant ID not configured',
      });
      return;
    }

    if (merchantId.length !== 36) {
      this.results.push({
        component: 'ZarinPal Configuration',
        status: 'WARN',
        message: 'ZarinPal merchant ID format may be incorrect',
      });
    }

    try {
      // Test ZarinPal API connectivity (without making actual payment)
      const baseUrl = isSandbox 
        ? 'https://sandbox.zarinpal.com' 
        : 'https://api.zarinpal.com';
      
      const response = await axios.post(`${baseUrl}/pg/v4/payment/request.json`, {
        merchant_id: merchantId,
        amount: 1000, // Test amount
        callback_url: 'https://example.com/callback',
        description: 'Test connection',
      }, { timeout: 10000 });

      // Even if payment fails, API connectivity is confirmed
      this.results.push({
        component: 'ZarinPal API',
        status: 'PASS',
        message: `ZarinPal API accessible (${isSandbox ? 'sandbox' : 'production'})`,
      });

    } catch (error) {
      this.results.push({
        component: 'ZarinPal API',
        status: 'FAIL',
        message: `ZarinPal API connection failed: ${error.message}`,
      });
    }
  }

  private async validateMoodian(): Promise<void> {
    console.log('🏛️  Validating Moodian Integration...');

    const clientId = process.env.MOODIAN_CLIENT_ID;
    const clientSecret = process.env.MOODIAN_CLIENT_SECRET;

    if (!clientId || !clientSecret || 
        clientId === 'CHANGE_IN_PRODUCTION' || 
        clientSecret === 'CHANGE_IN_PRODUCTION') {
      this.results.push({
        component: 'Moodian Configuration',
        status: 'FAIL',
        message: 'Moodian credentials not configured',
      });
      return;
    }

    try {
      // Test Moodian API connectivity
      const response = await axios.get('https://api.moodian.ir/health', { 
        timeout: 10000 
      });

      this.results.push({
        component: 'Moodian API',
        status: 'PASS',
        message: 'Moodian API accessible',
      });

    } catch (error) {
      this.results.push({
        component: 'Moodian API',
        status: 'WARN',
        message: `Moodian API connection test failed: ${error.message}`,
      });
    }
  }

  private async validateSecurity(): Promise<void> {
    console.log('🛡️  Validating Security Configuration...');

    // Check CORS configuration
    const corsOrigins = process.env.CORS_ORIGINS;
    if (!corsOrigins || corsOrigins.includes('*')) {
      this.results.push({
        component: 'CORS Configuration',
        status: 'FAIL',
        message: 'CORS origins not properly configured (security risk)',
      });
    } else {
      this.results.push({
        component: 'CORS Configuration',
        status: 'PASS',
        message: 'CORS origins properly configured',
      });
    }

    // Check rate limiting configuration
    const rateLimitTtl = process.env.RATE_LIMIT_TTL;
    const rateLimitMax = process.env.RATE_LIMIT_MAX;
    
    if (!rateLimitTtl || !rateLimitMax) {
      this.results.push({
        component: 'Rate Limiting',
        status: 'WARN',
        message: 'Rate limiting not configured',
      });
    } else {
      this.results.push({
        component: 'Rate Limiting',
        status: 'PASS',
        message: 'Rate limiting configured',
      });
    }
  }

  private async validatePerformance(): Promise<void> {
    console.log('⚡ Validating Performance Configuration...');

    // Check cache configuration
    const cacheTtl = process.env.CACHE_TTL_DEFAULT;
    if (!cacheTtl) {
      this.results.push({
        component: 'Cache Configuration',
        status: 'WARN',
        message: 'Cache TTL not configured',
      });
    } else {
      this.results.push({
        component: 'Cache Configuration',
        status: 'PASS',
        message: 'Cache configuration found',
      });
    }

    // Check slow query threshold
    const slowQueryThreshold = process.env.SLOW_QUERY_THRESHOLD;
    if (!slowQueryThreshold) {
      this.results.push({
        component: 'Query Performance',
        status: 'WARN',
        message: 'Slow query threshold not configured',
      });
    } else {
      this.results.push({
        component: 'Query Performance',
        status: 'PASS',
        message: 'Query performance monitoring configured',
      });
    }
  }

  private async validateApplication(): Promise<void> {
    console.log('🚀 Validating Application Health...');

    try {
      // If the application is running, test health endpoint
      const port = process.env.PORT || 3001;
      const response = await axios.get(`http://localhost:${port}/api/v3/health`, {
        timeout: 5000,
      });

      if (response.status === 200) {
        this.results.push({
          component: 'Application Health',
          status: 'PASS',
          message: 'Application health endpoint responding',
        });
      } else {
        this.results.push({
          component: 'Application Health',
          status: 'FAIL',
          message: `Health endpoint returned status ${response.status}`,
        });
      }

    } catch (error) {
      this.results.push({
        component: 'Application Health',
        status: 'WARN',
        message: 'Application not running or health endpoint not accessible',
      });
    }
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📋 PRODUCTION READINESS VALIDATION REPORT');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    console.log(`\n📊 Summary: ${passed} PASS | ${failed} FAIL | ${warnings} WARN\n`);

    // Group results by status
    const failedResults = this.results.filter(r => r.status === 'FAIL');
    const warnResults = this.results.filter(r => r.status === 'WARN');
    const passedResults = this.results.filter(r => r.status === 'PASS');

    if (failedResults.length > 0) {
      console.log('❌ CRITICAL ISSUES (Must fix before production):');
      failedResults.forEach(result => {
        console.log(`   • ${result.component}: ${result.message}`);
      });
      console.log('');
    }

    if (warnResults.length > 0) {
      console.log('⚠️  WARNINGS (Recommended to fix):');
      warnResults.forEach(result => {
        console.log(`   • ${result.component}: ${result.message}`);
      });
      console.log('');
    }

    if (passedResults.length > 0) {
      console.log('✅ PASSED VALIDATIONS:');
      passedResults.forEach(result => {
        console.log(`   • ${result.component}: ${result.message}`);
      });
      console.log('');
    }

    // Final verdict
    if (failed === 0) {
      console.log('🎉 PRODUCTION READY! All critical validations passed.');
      if (warnings > 0) {
        console.log('💡 Consider addressing warnings for optimal performance.');
      }
      process.exit(0);
    } else {
      console.log('🚨 NOT PRODUCTION READY! Please fix critical issues before deployment.');
      process.exit(1);
    }
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
    await this.redis.quit();
  }
}

// Run validation
async function main() {
  const validator = new ProductionReadinessValidator();
  
  try {
    await validator.validate();
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  } finally {
    await validator.cleanup();
  }
}

if (require.main === module) {
  main();
}
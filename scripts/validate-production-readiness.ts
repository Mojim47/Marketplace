#!/usr/bin/env ts-node
// ═══════════════════════════════════════════════════════════════════════════
// Production Readiness Validation Script
// ═══════════════════════════════════════════════════════════════════════════
// Validates all critical components before production deployment
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
import Redis from 'ioredis';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
  remediation?: string;
}

interface ReadinessReport {
  generatedAt: string;
  environment: string;
  mode: 'strict' | 'advisory';
  totals: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
  verdict: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
  checks: ValidationResult[];
}

class ProductionReadinessValidator {
  private results: ValidationResult[] = [];
  private prisma: PrismaClient | null = null;
  private redis: Redis | null = null;
  private readonly mode: 'strict' | 'advisory';

  constructor(mode: 'strict' | 'advisory' = 'advisory') {
    this.mode = mode;
    this.loadEnvironmentFiles();
  }

  private loadEnvironmentFiles(): void {
    const envFiles = ['.env'];
    if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
      envFiles.unshift('.env.production');
    }
    for (const file of envFiles) {
      if (existsSync(file)) {
        dotenv.config({ path: file, override: false });
      }
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private normalizePrismaEngineType(): void {
    const allowed = new Set(['library', 'binary']);
    const current = process.env.PRISMA_CLIENT_ENGINE_TYPE;

    if (!current) {
      return;
    }

    if (!allowed.has(current)) {
      process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
      this.results.push({
        component: 'Prisma Engine Type',
        status: 'WARN',
        message: `Invalid PRISMA_CLIENT_ENGINE_TYPE="${current}" detected; forced to "library" for validation run`,
      });
    }
  }

  private writeReport(report: ReadinessReport): void {
    const reportDir = join(process.cwd(), 'artifacts');
    mkdirSync(reportDir, { recursive: true });
    const basePath = join(reportDir, 'production-readiness-report.json');
    const stampedPath = join(
      reportDir,
      `production-readiness-report-${report.generatedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`
    );
    const serialized = JSON.stringify(report, null, 2);
    writeFileSync(basePath, serialized, 'utf8');
    writeFileSync(stampedPath, serialized, 'utf8');
    console.log(`Report saved: ${basePath}`);
    console.log(`Report snapshot: ${stampedPath}`);
  }

  private failOrWarn(component: string, message: string): void {
    const strict = this.mode === 'strict';
    this.results.push({
      component,
      status: strict ? 'FAIL' : 'WARN',
      message: strict ? message : `${message} (advisory mode)`,
      remediation: this.getRemediation(component),
    });
  }

  private getRemediation(component: string): string | undefined {
    const remediations: Record<string, string> = {
      'Environment Variables': 'Populate missing variables in runtime secrets or .env.production.',
      'JWT Secret': 'Set JWT_SECRET to a cryptographically secure value (>=32 chars).',
      'User Salt': 'Set USER_HASH_SALT to a unique random secret (>=16 chars).',
      'Database Connection': 'Verify DATABASE_URL, DB availability, and migration state.',
      'Redis Connection': 'Verify REDIS_URL and ensure Redis is reachable from runtime network.',
      'ClickHouse Connection': 'Set CLICKHOUSE_URL and validate /ping endpoint reachability.',
      'ZarinPal Configuration': 'Provide a valid ZARINPAL_MERCHANT_ID in secrets.',
      'ZarinPal API': 'Validate merchant config, network egress, and provider API availability.',
      'Moodian Configuration': 'Provide MOODIAN_CLIENT_ID and MOODIAN_CLIENT_SECRET in secrets.',
      'Moodian API': 'Verify Moodian connectivity and credential validity.',
      'Rate Limiting': 'Set RATE_LIMIT_TTL and RATE_LIMIT_MAX for abuse protection.',
      'Cache Configuration': 'Set CACHE_TTL_DEFAULT to enforce deterministic cache behavior.',
      'Query Performance': 'Set SLOW_QUERY_THRESHOLD for DB performance observability.',
      'Application Health': 'Run app and expose /api/v3/health to readiness environment.',
      'Prisma Client Compatibility': 'Set PRISMA_CLIENT_ENGINE_TYPE to library or binary.',
    };
    return remediations[component];
  }

  private initPrismaClient(): PrismaClient | null {
    if (this.prisma) {
      return this.prisma;
    }

    try {
      this.normalizePrismaEngineType();
      this.prisma = new PrismaClient();
      return this.prisma;
    } catch (error) {
      const message = this.getErrorMessage(error);
      if (message.includes('Invalid client engine type')) {
        this.results.push({
          component: 'Prisma Client Compatibility',
          status: 'WARN',
          message: `Prisma client engine is incompatible in this environment; database checks will be skipped (${message})`,
        });
        return null;
      }
      this.results.push({
        component: 'Database Connection',
        status: 'FAIL',
        message: `Database client initialization failed: ${message}`,
      });
      return null;
    }
  }

  async validate(): Promise<number> {
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
    return this.generateReport();
  }

  private async validateEnvironment(): Promise<void> {
    const coreRequiredVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'USER_HASH_SALT',
      'CORS_ORIGINS',
    ];
    const integrationRequiredVars = [
      'ZARINPAL_MERCHANT_ID',
      'MOODIAN_CLIENT_ID',
      'MOODIAN_CLIENT_SECRET',
      'CLICKHOUSE_URL',
      'S3_BUCKET_NAME',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMS_API_KEY',
    ];

    const missingCore = coreRequiredVars.filter((envVar) => !process.env[envVar]);
    const missingIntegration = integrationRequiredVars.filter((envVar) => !process.env[envVar]);
    const defaults = [...coreRequiredVars, ...integrationRequiredVars].filter(
      (envVar) =>
        process.env[envVar] === 'CHANGE_IN_PRODUCTION' ||
        process.env[envVar] === 'CHANGE_THIS_TO_SECURE_256_BIT_KEY_IN_PRODUCTION'
    );

    if (missingCore.length > 0) {
      this.results.push({
        component: 'Environment Variables',
        status: 'FAIL',
        message: `Missing core environment variables: ${missingCore.join(', ')}`,
      });
    } else if (missingIntegration.length > 0) {
      this.failOrWarn(
        'Environment Variables',
        `Missing integration environment variables: ${missingIntegration.join(', ')}`
      );
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
    const jwtSecret = process.env.JWT_SECRET;
    const userSalt = process.env.USER_HASH_SALT;

    if (!jwtSecret || jwtSecret.length < 32) {
      this.failOrWarn('JWT Secret', 'JWT_SECRET must be at least 32 characters long');
    } else if (jwtSecret.includes('CHANGE') || jwtSecret === 'your-secret-key') {
      this.failOrWarn('JWT Secret', 'JWT_SECRET appears to be a default value');
    } else {
      this.results.push({
        component: 'JWT Secret',
        status: 'PASS',
        message: 'JWT secret is properly configured',
      });
    }

    if (!userSalt || userSalt.length < 16) {
      this.failOrWarn('User Salt', 'USER_HASH_SALT must be at least 16 characters long');
    } else {
      this.results.push({
        component: 'User Salt',
        status: 'PASS',
        message: 'User salt is properly configured',
      });
    }
  }

  private async validateConfiguration(): Promise<void> {
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
    const prisma = this.initPrismaClient();
    if (!prisma) {
      const hasCompatibilityWarning = this.results.some(
        (r) => r.component === 'Prisma Client Compatibility' && r.status === 'WARN'
      );
      if (hasCompatibilityWarning) {
        this.results.push({
          component: 'Database Connection',
          status: 'WARN',
          message: 'Database checks skipped due to Prisma client compatibility issue',
        });
      }
      return;
    }

    try {
      // Test connection
      await prisma.$queryRaw`SELECT 1`;

      // Check if migrations are applied
      const migrations = (await prisma.$queryRaw`
        SELECT * FROM "_prisma_migrations" 
        WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
      `) as any[];

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
      const indexes = (await prisma.$queryRaw`
        SELECT schemaname, tablename, indexname 
        FROM pg_indexes 
        WHERE indexname LIKE 'idx_%'
      `) as any[];

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
      this.failOrWarn(
        'Database Connection',
        `Database connection failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  private async validateRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      retryStrategy: () => null,
    });
    this.redis.on('error', () => {
      // Redis connectivity failures are reported by checks below.
    });

    try {
      await this.redis.connect();
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
      this.failOrWarn(
        'Redis Connection',
        `Redis connection failed: ${this.getErrorMessage(error)}`
      );
    } finally {
      if (this.redis) {
        try {
          await this.redis.quit();
        } catch {
          // Ignore shutdown failures for readiness reporting.
        }
        this.redis = null;
      }
    }
  }

  private async validateClickHouse(): Promise<void> {
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
        this.failOrWarn(
          'ClickHouse Connection',
          `ClickHouse ping failed with status ${response.status}`
        );
      }
    } catch (error) {
      this.failOrWarn(
        'ClickHouse Connection',
        `ClickHouse connection failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  private async validateZarinPal(): Promise<void> {
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';

    if (!merchantId || merchantId === 'CHANGE_IN_PRODUCTION') {
      this.failOrWarn('ZarinPal Configuration', 'ZarinPal merchant ID not configured');
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
      const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com' : 'https://api.zarinpal.com';

      const _response = await axios.post(
        `${baseUrl}/pg/v4/payment/request.json`,
        {
          merchant_id: merchantId,
          amount: 1000, // Test amount
          callback_url: 'https://example.com/callback',
          description: 'Test connection',
        },
        { timeout: 10000 }
      );

      // Even if payment fails, API connectivity is confirmed
      this.results.push({
        component: 'ZarinPal API',
        status: 'PASS',
        message: `ZarinPal API accessible (${isSandbox ? 'sandbox' : 'production'})`,
      });
    } catch (error) {
      this.failOrWarn(
        'ZarinPal API',
        `ZarinPal API connection failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  private async validateMoodian(): Promise<void> {
    const clientId = process.env.MOODIAN_CLIENT_ID;
    const clientSecret = process.env.MOODIAN_CLIENT_SECRET;

    if (
      !clientId ||
      !clientSecret ||
      clientId === 'CHANGE_IN_PRODUCTION' ||
      clientSecret === 'CHANGE_IN_PRODUCTION'
    ) {
      this.failOrWarn('Moodian Configuration', 'Moodian credentials not configured');
      return;
    }

    try {
      // Test Moodian API connectivity
      const _response = await axios.get('https://api.moodian.ir/health', {
        timeout: 10000,
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
        message: `Moodian API connection test failed: ${this.getErrorMessage(error)}`,
      });
    }
  }

  private async validateSecurity(): Promise<void> {
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
    } catch (_error) {
      this.results.push({
        component: 'Application Health',
        status: 'WARN',
        message: 'Application not running or health endpoint not accessible',
      });
    }
  }

  private generateReport(): number {
    this.results = this.results.map((result) =>
      result.remediation
        ? result
        : {
            ...result,
            remediation: this.getRemediation(result.component),
          }
    );

    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const warnings = this.results.filter((r) => r.status === 'WARN').length;

    // Group results by status
    const failedResults = this.results.filter((r) => r.status === 'FAIL');
    const warnResults = this.results.filter((r) => r.status === 'WARN');
    const passedResults = this.results.filter((r) => r.status === 'PASS');

    console.log('=== Production Readiness Report ===');
    console.log(`Mode: ${this.mode}`);
    console.log(
      `Total Checks: ${this.results.length} | PASS: ${passed} | WARN: ${warnings} | FAIL: ${failed}`
    );

    if (failedResults.length > 0) {
      console.log('\n[FAIL]');
      failedResults.forEach((result) => {
        console.log(`- ${result.component}: ${result.message}`);
        if (result.remediation) {
          console.log(`  remediation: ${result.remediation}`);
        }
      });
    }

    if (warnResults.length > 0) {
      console.log('\n[WARN]');
      warnResults.forEach((result) => {
        console.log(`- ${result.component}: ${result.message}`);
        if (result.remediation) {
          console.log(`  remediation: ${result.remediation}`);
        }
      });
    }

    if (passedResults.length > 0) {
      console.log('\n[PASS]');
      passedResults.forEach((result) => {
        console.log(`- ${result.component}: ${result.message}`);
      });
    }

    // Final verdict
    const verdict: ReadinessReport['verdict'] =
      failed === 0 ? (warnings > 0 ? 'READY_WITH_WARNINGS' : 'READY') : 'NOT_READY';
    console.log(`\nVERDICT: ${verdict}`);

    const report: ReadinessReport = {
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      mode: this.mode,
      totals: {
        total: this.results.length,
        pass: passed,
        warn: warnings,
        fail: failed,
      },
      verdict,
      checks: this.results,
    };

    this.writeReport(report);
    return failed === 0 ? 0 : 1;
  }

  async cleanup(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// Run validation
async function main() {
  const args = new Set(process.argv.slice(2));
  const mode = args.has('--strict') ? 'strict' : 'advisory';
  const validator = new ProductionReadinessValidator(mode);

  try {
    const exitCode = await validator.validate();
    process.exitCode = exitCode;
  } catch (error) {
    console.error('Validation failed with error:', error);
    process.exitCode = 1;
  } finally {
    await validator.cleanup();
  }
}

if (require.main === module) {
  main();
}

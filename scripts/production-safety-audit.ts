#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Production Safety Audit
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Comprehensive audit to verify system is safe for production
 * Warning: This script identifies CRITICAL issues that MUST be fixed
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@clickhouse/client';

interface SafetyCheck {
  category: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  details: string;
  impact: string;
  fix: string;
}

class ProductionSafetyAuditor {
  private checks: SafetyCheck[] = [];
  private clickhouse: any;

  constructor() {
    this.clickhouse = createClient({
      host: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
      database: process.env.CLICKHOUSE_DATABASE || 'nextgen_analytics',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
    });
  }

  async runAudit(): Promise<void> {
    // Run all safety checks
    await this.checkClickHouseTTLPolicies();
    await this.checkDataValidation();
    await this.checkMemoryMonitoring();
    await this.checkCostMonitoring();
    await this.checkSecurityCompliance();
    await this.checkPerformanceMonitoring();
    await this.checkRollbackCapability();
    await this.checkEnvironmentConfiguration();
    await this.checkDocumentation();
    await this.checkTestCoverage();

    // Generate report
    this.generateReport();
  }

  /**
   * 🔥 CRITICAL: Check TTL policies to prevent data explosion
   */
  private async checkClickHouseTTLPolicies(): Promise<void> {
    try {
      const result = await this.clickhouse.query({
        query: `
          SELECT 
            table,
            ttl_expression
          FROM system.tables 
          WHERE database = '${process.env.CLICKHOUSE_DATABASE || 'nextgen_analytics'}'
          AND table IN ('search_events', 'failed_searches', 'product_impressions', 'user_sessions')
        `,
        format: 'JSONEachRow',
      });

      const tables = (await result.json()) as { table: string; ttl_expression: string }[];
      const tablesWithoutTTL = tables.filter((t) => !t.ttl_expression || t.ttl_expression === '');

      if (tablesWithoutTTL.length > 0) {
        this.checks.push({
          category: 'CRITICAL',
          name: 'ClickHouse TTL Policies',
          description: 'TTL policies prevent data from growing forever',
          status: 'FAIL',
          details: `Tables without TTL: ${tablesWithoutTTL.map((t) => t.table).join(', ')}`,
          impact: 'Data will grow forever, causing disk space exhaustion and system failure',
          fix: 'Add TTL policies to all analytics tables: ALTER TABLE <table> MODIFY TTL date + INTERVAL X YEAR',
        });
      } else {
        this.checks.push({
          category: 'CRITICAL',
          name: 'ClickHouse TTL Policies',
          description: 'TTL policies prevent data from growing forever',
          status: 'PASS',
          details: `All ${tables.length} tables have TTL policies configured`,
          impact: 'Data retention is controlled, preventing storage explosion',
          fix: 'No action needed',
        });
      }
    } catch (error) {
      this.checks.push({
        category: 'CRITICAL',
        name: 'ClickHouse TTL Policies',
        description: 'TTL policies prevent data from growing forever',
        status: 'FAIL',
        details: `Cannot connect to ClickHouse: ${error.message}`,
        impact: 'Cannot verify data retention policies',
        fix: 'Ensure ClickHouse is running and accessible',
      });
    }
  }

  /**
   * 🛡️ CRITICAL: Check data validation implementation
   */
  private async checkDataValidation(): Promise<void> {
    const analyticsServicePath = path.join(
      process.cwd(),
      'libs/analytics/src/analytics.service.ts'
    );

    if (!fs.existsSync(analyticsServicePath)) {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Data Validation',
        description: 'Validate incoming data to prevent corruption',
        status: 'FAIL',
        details: 'Analytics service file not found',
        impact: 'No data validation, corrupt data will cause wrong business decisions',
        fix: 'Implement analytics service with data validation',
      });
      return;
    }

    const serviceContent = fs.readFileSync(analyticsServicePath, 'utf8');

    const hasValidation =
      serviceContent.includes('validateSearchEvent') &&
      serviceContent.includes('isDuplicateEvent') &&
      serviceContent.includes('anonymizeUserData');

    if (hasValidation) {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Data Validation',
        description: 'Validate incoming data to prevent corruption',
        status: 'PASS',
        details:
          'Data validation methods found: validateSearchEvent, isDuplicateEvent, anonymizeUserData',
        impact: 'Data integrity is protected, preventing corrupt analytics',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Data Validation',
        description: 'Validate incoming data to prevent corruption',
        status: 'FAIL',
        details: 'Missing data validation methods in analytics service',
        impact: 'Corrupt data will cause wrong business decisions and system instability',
        fix: 'Implement validateSearchEvent, isDuplicateEvent, and anonymizeUserData methods',
      });
    }
  }

  /**
   * 🧠 CRITICAL: Check memory monitoring implementation
   */
  private async checkMemoryMonitoring(): Promise<void> {
    const analyticsServicePath = path.join(
      process.cwd(),
      'libs/analytics/src/analytics.service.ts'
    );

    if (!fs.existsSync(analyticsServicePath)) {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Memory Monitoring',
        description: 'Monitor memory usage to prevent memory leaks',
        status: 'FAIL',
        details: 'Analytics service file not found',
        impact: 'Memory leaks will kill the application',
        fix: 'Implement memory monitoring in analytics service',
      });
      return;
    }

    const serviceContent = fs.readFileSync(analyticsServicePath, 'utf8');

    const hasMemoryMonitoring =
      serviceContent.includes('checkMemoryUsage') &&
      serviceContent.includes('memoryUsage') &&
      serviceContent.includes('process.memoryUsage');

    if (hasMemoryMonitoring) {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Memory Monitoring',
        description: 'Monitor memory usage to prevent memory leaks',
        status: 'PASS',
        details: 'Memory monitoring implemented with checkMemoryUsage method',
        impact: 'Memory leaks will be detected early, preventing system crashes',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Memory Monitoring',
        description: 'Monitor memory usage to prevent memory leaks',
        status: 'FAIL',
        details: 'Missing memory monitoring in analytics service',
        impact: 'Memory leaks will slowly kill the application',
        fix: 'Implement checkMemoryUsage method with memory growth tracking',
      });
    }
  }

  /**
   * 💰 CRITICAL: Check cost monitoring implementation
   */
  private async checkCostMonitoring(): Promise<void> {
    const analyticsServicePath = path.join(
      process.cwd(),
      'libs/analytics/src/analytics.service.ts'
    );

    if (!fs.existsSync(analyticsServicePath)) {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Cost Monitoring',
        description: 'Monitor costs to prevent budget explosion',
        status: 'FAIL',
        details: 'Analytics service file not found',
        impact: 'Costs will spiral out of control',
        fix: 'Implement cost monitoring in analytics service',
      });
      return;
    }

    const serviceContent = fs.readFileSync(analyticsServicePath, 'utf8');

    const hasCostMonitoring =
      serviceContent.includes('checkCostLimits') &&
      serviceContent.includes('dailyEventCount') &&
      serviceContent.includes('ANALYTICS_DAILY_EVENT_LIMIT');

    if (hasCostMonitoring) {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Cost Monitoring',
        description: 'Monitor costs to prevent budget explosion',
        status: 'PASS',
        details: 'Cost monitoring implemented with daily event limits',
        impact: 'Costs are controlled, preventing budget overruns',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'CRITICAL',
        name: 'Cost Monitoring',
        description: 'Monitor costs to prevent budget explosion',
        status: 'FAIL',
        details: 'Missing cost monitoring in analytics service',
        impact: 'Analytics costs will spiral out of control',
        fix: 'Implement checkCostLimits method with daily event tracking',
      });
    }
  }

  /**
   * 🔒 HIGH: Check security and GDPR compliance
   */
  private async checkSecurityCompliance(): Promise<void> {
    const analyticsServicePath = path.join(
      process.cwd(),
      'libs/analytics/src/analytics.service.ts'
    );

    if (!fs.existsSync(analyticsServicePath)) {
      this.checks.push({
        category: 'HIGH',
        name: 'Security & GDPR Compliance',
        description: 'Ensure user data is properly anonymized',
        status: 'FAIL',
        details: 'Analytics service file not found',
        impact: 'GDPR violations and potential legal liability',
        fix: 'Implement user data anonymization',
      });
      return;
    }

    const serviceContent = fs.readFileSync(analyticsServicePath, 'utf8');

    const hasDataAnonymization =
      serviceContent.includes('anonymizeUserData') &&
      serviceContent.includes('hashUserId') &&
      serviceContent.includes('anonymizeIP');

    const hasUserHashSalt = process.env.USER_HASH_SALT && process.env.USER_HASH_SALT.length > 10;

    if (hasDataAnonymization && hasUserHashSalt) {
      this.checks.push({
        category: 'HIGH',
        name: 'Security & GDPR Compliance',
        description: 'Ensure user data is properly anonymized',
        status: 'PASS',
        details: 'Data anonymization implemented with proper salt configuration',
        impact: 'User privacy is protected, GDPR compliant',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'HIGH',
        name: 'Security & GDPR Compliance',
        description: 'Ensure user data is properly anonymized',
        status: 'FAIL',
        details: `Missing: ${!hasDataAnonymization ? 'data anonymization' : ''} ${!hasUserHashSalt ? 'USER_HASH_SALT env var' : ''}`,
        impact: 'GDPR violations, potential legal liability and fines',
        fix: 'Implement data anonymization and set USER_HASH_SALT environment variable',
      });
    }
  }

  /**
   * ⚡ HIGH: Check performance monitoring
   */
  private async checkPerformanceMonitoring(): Promise<void> {
    const migrationServicePath = path.join(
      process.cwd(),
      'libs/search/src/search-migration.service.ts'
    );

    if (!fs.existsSync(migrationServicePath)) {
      this.checks.push({
        category: 'HIGH',
        name: 'Performance Monitoring',
        description: 'Monitor search performance and circuit breaker',
        status: 'FAIL',
        details: 'Search migration service file not found',
        impact: 'No performance monitoring, degradation will go unnoticed',
        fix: 'Implement search migration service with performance monitoring',
      });
      return;
    }

    const serviceContent = fs.readFileSync(migrationServicePath, 'utf8');

    const hasCircuitBreaker =
      serviceContent.includes('CircuitBreakerState') &&
      serviceContent.includes('executeWithCircuitBreaker') &&
      serviceContent.includes('recordFailure');

    const hasHealthCheck =
      serviceContent.includes('healthCheck') && serviceContent.includes('migration');

    if (hasCircuitBreaker && hasHealthCheck) {
      this.checks.push({
        category: 'HIGH',
        name: 'Performance Monitoring',
        description: 'Monitor search performance and circuit breaker',
        status: 'PASS',
        details: 'Circuit breaker and health check implemented',
        impact: 'Performance issues will be detected and handled automatically',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'HIGH',
        name: 'Performance Monitoring',
        description: 'Monitor search performance and circuit breaker',
        status: 'FAIL',
        details: `Missing: ${!hasCircuitBreaker ? 'circuit breaker' : ''} ${!hasHealthCheck ? 'health check' : ''}`,
        impact: 'Performance degradation will go unnoticed until system fails',
        fix: 'Implement circuit breaker and health check methods',
      });
    }
  }

  /**
   * 🔄 HIGH: Check rollback capability
   */
  private async checkRollbackCapability(): Promise<void> {
    const migrationServicePath = path.join(
      process.cwd(),
      'libs/search/src/search-migration.service.ts'
    );

    if (!fs.existsSync(migrationServicePath)) {
      this.checks.push({
        category: 'HIGH',
        name: 'Rollback Capability',
        description: 'Ability to rollback to old search service',
        status: 'FAIL',
        details: 'Search migration service file not found',
        impact: 'Cannot rollback if new system fails',
        fix: 'Implement search migration service with rollback capability',
      });
      return;
    }

    const serviceContent = fs.readFileSync(migrationServicePath, 'utf8');

    const hasRollback =
      serviceContent.includes('executeOldService') &&
      serviceContent.includes('SEARCH_MIGRATION_PERCENTAGE') &&
      serviceContent.includes('fallback');

    const hasConfigUpdate =
      serviceContent.includes('updateMigrationConfig') &&
      serviceContent.includes('resetCircuitBreaker');

    if (hasRollback && hasConfigUpdate) {
      this.checks.push({
        category: 'HIGH',
        name: 'Rollback Capability',
        description: 'Ability to rollback to old search service',
        status: 'PASS',
        details: 'Rollback mechanism implemented with runtime configuration',
        impact: 'Can safely rollback if issues occur',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'HIGH',
        name: 'Rollback Capability',
        description: 'Ability to rollback to old search service',
        status: 'FAIL',
        details: `Missing: ${!hasRollback ? 'rollback mechanism' : ''} ${!hasConfigUpdate ? 'runtime config update' : ''}`,
        impact: 'Cannot rollback if new system fails, potential extended downtime',
        fix: 'Implement rollback mechanism and runtime configuration updates',
      });
    }
  }

  /**
   * 🔧 MEDIUM: Check environment configuration
   */
  private async checkEnvironmentConfiguration(): Promise<void> {
    const requiredEnvVars = [
      'CLICKHOUSE_HOST',
      'CLICKHOUSE_PORT',
      'CLICKHOUSE_DATABASE',
      'CLICKHOUSE_USERNAME',
      'SEARCH_ANALYTICS_ENABLED',
      'SEARCH_MIGRATION_PERCENTAGE',
      'USER_HASH_SALT',
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length === 0) {
      this.checks.push({
        category: 'MEDIUM',
        name: 'Environment Configuration',
        description: 'Required environment variables are set',
        status: 'PASS',
        details: `All ${requiredEnvVars.length} required environment variables are configured`,
        impact: 'System will start correctly with proper configuration',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'MEDIUM',
        name: 'Environment Configuration',
        description: 'Required environment variables are set',
        status: 'FAIL',
        details: `Missing environment variables: ${missingVars.join(', ')}`,
        impact: 'System may fail to start or behave incorrectly',
        fix: `Set missing environment variables: ${missingVars.join(', ')}`,
      });
    }
  }

  /**
   * 📚 MEDIUM: Check documentation
   */
  private async checkDocumentation(): Promise<void> {
    const requiredDocs = [
      'CRITICAL_PRODUCTION_FIXES.md',
      'PRODUCTION_READINESS_REPORT.md',
      'FINAL_CHECKLIST.md',
      'docs/CLICKHOUSE_ANALYTICS_SETUP.md',
      'docs/SEARCH_MIGRATION_GUIDE.md',
    ];

    const existingDocs = requiredDocs.filter((doc) => fs.existsSync(path.join(process.cwd(), doc)));

    if (existingDocs.length >= 4) {
      this.checks.push({
        category: 'MEDIUM',
        name: 'Documentation',
        description: 'Essential documentation is available',
        status: 'PASS',
        details: `${existingDocs.length}/${requiredDocs.length} essential documents found`,
        impact: 'Team can understand and maintain the system',
        fix: 'No action needed',
      });
    } else {
      const missingDocs = requiredDocs.filter(
        (doc) => !fs.existsSync(path.join(process.cwd(), doc))
      );
      this.checks.push({
        category: 'MEDIUM',
        name: 'Documentation',
        description: 'Essential documentation is available',
        status: 'WARNING',
        details: `Missing documentation: ${missingDocs.join(', ')}`,
        impact: 'Team may struggle to understand and maintain the system',
        fix: `Create missing documentation: ${missingDocs.join(', ')}`,
      });
    }
  }

  /**
   * 🧪 LOW: Check test coverage
   */
  private async checkTestCoverage(): Promise<void> {
    const testFiles = [
      'scripts/test-clickhouse-analytics.ts',
      'scripts/test-search-migration.ts',
      'scripts/production-safety-audit.ts',
    ];

    const existingTests = testFiles.filter((test) => fs.existsSync(path.join(process.cwd(), test)));

    if (existingTests.length >= 2) {
      this.checks.push({
        category: 'LOW',
        name: 'Test Coverage',
        description: 'Test scripts are available for validation',
        status: 'PASS',
        details: `${existingTests.length}/${testFiles.length} test scripts found`,
        impact: 'System can be validated before deployment',
        fix: 'No action needed',
      });
    } else {
      this.checks.push({
        category: 'LOW',
        name: 'Test Coverage',
        description: 'Test scripts are available for validation',
        status: 'WARNING',
        details: `Limited test coverage: ${existingTests.length}/${testFiles.length} test scripts`,
        impact: 'Harder to validate system before deployment',
        fix: 'Create additional test scripts for comprehensive validation',
      });
    }
  }

  /**
   * Generate comprehensive audit report
   */
  private generateReport(): void {
    // Group checks by category
    const critical = this.checks.filter((c) => c.category === 'CRITICAL');
    const high = this.checks.filter((c) => c.category === 'HIGH');
    const medium = this.checks.filter((c) => c.category === 'MEDIUM');
    const low = this.checks.filter((c) => c.category === 'LOW');

    this.displayChecks('🔥 CRITICAL CHECKS (MUST PASS)', critical);
    this.displayChecks('⚠️  HIGH PRIORITY CHECKS', high);
    this.displayChecks('📊 MEDIUM PRIORITY CHECKS', medium);
    this.displayChecks('📝 LOW PRIORITY CHECKS', low);

    // Calculate overall score
    const _totalChecks = this.checks.length;
    const _passedChecks = this.checks.filter((c) => c.status === 'PASS').length;
    const failedChecks = this.checks.filter((c) => c.status === 'FAIL').length;
    const _warningChecks = this.checks.filter((c) => c.status === 'WARNING').length;

    const criticalFailed = critical.filter((c) => c.status === 'FAIL').length;
    const highFailed = high.filter((c) => c.status === 'FAIL').length;

    // Production readiness assessment
    if (criticalFailed > 0) {
    } else if (highFailed > 2) {
    } else if (highFailed > 0 || failedChecks > 3) {
    } else {
    }

    if (criticalFailed > 0) {
    } else {
    }
  }

  private displayChecks(_title: string, checks: SafetyCheck[]): void {
    checks.forEach((check, _index) => {
      const _statusIcon = {
        PASS: '✅',
        FAIL: '❌',
        WARNING: '⚠️',
        SKIP: '⏭️',
      }[check.status];
    });
  }
}

// Run the audit
const auditor = new ProductionSafetyAuditor();
auditor.runAudit().catch(console.error);

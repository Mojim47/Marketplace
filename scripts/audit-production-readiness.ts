#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Production Readiness Audit
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Comprehensive audit of all implemented components
 * Usage: pnpm tsx scripts/audit-production-readiness.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface AuditResult {
  category: string;
  item: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  critical: boolean;
}

class ProductionReadinessAuditor {
  private results: AuditResult[] = [];
  private readonly rootPath = process.cwd();

  async runAudit(): Promise<void> {
    console.log('🔍 NextGen Marketplace - Production Readiness Audit');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📁 Root Path: ${this.rootPath}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Run all audit categories
    await this.auditFileStructure();
    await this.auditDependencies();
    await this.auditConfiguration();
    await this.auditDockerSetup();
    await this.auditTypeScriptConfig();
    await this.auditEnvironmentVariables();
    await this.auditSecurityConsiderations();
    await this.auditTestingSetup();

    // Generate report
    this.generateReport();
  }

  private async auditFileStructure(): Promise<void> {
    console.log('📁 Auditing File Structure...');

    const requiredFiles = [
      // ClickHouse Analytics Infrastructure
      { path: 'docker-compose.clickhouse.yml', critical: true, desc: 'ClickHouse Docker setup' },
      { path: 'infra/clickhouse/init.sql', critical: true, desc: 'ClickHouse database schema' },
      { path: 'infra/clickhouse/config.xml', critical: true, desc: 'ClickHouse configuration' },
      { path: 'infra/vector/vector.toml', critical: true, desc: 'Vector log processor config' },

      // Analytics Library
      { path: 'libs/analytics/package.json', critical: true, desc: 'Analytics library package' },
      { path: 'libs/analytics/src/index.ts', critical: true, desc: 'Analytics library exports' },
      { path: 'libs/analytics/src/analytics.service.ts', critical: true, desc: 'Analytics service' },
      { path: 'libs/analytics/src/types.ts', critical: true, desc: 'Analytics types' },
      { path: 'libs/analytics/src/config.ts', critical: true, desc: 'Analytics configuration' },
      { path: 'libs/analytics/src/analytics.module.ts', critical: true, desc: 'Analytics NestJS module' },
      { path: 'libs/analytics/tsconfig.json', critical: true, desc: 'Analytics TypeScript config' },
      { path: 'libs/analytics/vitest.config.ts', critical: false, desc: 'Analytics test config' },

      // Enhanced Search Services
      { path: 'libs/search/src/analytics-search.service.ts', critical: true, desc: 'Analytics search service' },
      { path: 'libs/search/src/analytics-hybrid-search.service.ts', critical: true, desc: 'Analytics hybrid search' },
      { path: 'libs/search/src/search-migration.service.ts', critical: true, desc: 'Migration service' },

      // Test Scripts
      { path: 'scripts/test-clickhouse-analytics.ts', critical: false, desc: 'ClickHouse test script' },
      { path: 'scripts/test-search-migration.ts', critical: false, desc: 'Migration test script' },

      // Documentation
      { path: 'docs/CLICKHOUSE_ANALYTICS_SETUP.md', critical: false, desc: 'ClickHouse setup guide' },
      { path: 'docs/SEARCH_MIGRATION_GUIDE.md', critical: false, desc: 'Migration guide' },
      { path: 'CLICKHOUSE_IMPLEMENTATION_SUMMARY.md', critical: false, desc: 'Implementation summary' },
      { path: 'SAFE_MIGRATION_SUMMARY.md', critical: false, desc: 'Migration summary' },
    ];

    for (const file of requiredFiles) {
      const fullPath = join(this.rootPath, file.path);
      const exists = existsSync(fullPath);
      
      this.results.push({
        category: 'File Structure',
        item: file.desc,
        status: exists ? 'PASS' : 'FAIL',
        message: exists ? `✅ ${file.path}` : `❌ Missing: ${file.path}`,
        critical: file.critical,
      });
    }

    console.log('   ✅ File structure audit completed\n');
  }

  private async auditDependencies(): Promise<void> {
    console.log('📦 Auditing Dependencies...');

    try {
      // Check analytics library dependencies
      const analyticsPackagePath = join(this.rootPath, 'libs/analytics/package.json');
      if (existsSync(analyticsPackagePath)) {
        const analyticsPackage = JSON.parse(readFileSync(analyticsPackagePath, 'utf8'));
        const requiredDeps = [
          '@nestjs/common',
          '@nestjs/config',
          '@clickhouse/client',
          'uuid',
          'zod',
        ];

        for (const dep of requiredDeps) {
          const hasDepency = analyticsPackage.dependencies?.[dep] || analyticsPackage.devDependencies?.[dep];
          this.results.push({
            category: 'Dependencies',
            item: `Analytics: ${dep}`,
            status: hasDepency ? 'PASS' : 'FAIL',
            message: hasDepency ? `✅ ${dep}: ${hasDepency}` : `❌ Missing: ${dep}`,
            critical: true,
          });
        }
      }

      // Check if TypeScript paths are configured
      const tsconfigPath = join(this.rootPath, 'tsconfig.base.json');
      if (existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
        const hasAnalyticsPath = tsconfig.compilerOptions?.paths?.['@nextgen/analytics'];
        
        this.results.push({
          category: 'Dependencies',
          item: 'TypeScript path mapping',
          status: hasAnalyticsPath ? 'PASS' : 'FAIL',
          message: hasAnalyticsPath ? '✅ @nextgen/analytics path configured' : '❌ Missing @nextgen/analytics path',
          critical: true,
        });
      }

    } catch (error) {
      this.results.push({
        category: 'Dependencies',
        item: 'Dependency check',
        status: 'FAIL',
        message: `❌ Error checking dependencies: ${error.message}`,
        critical: true,
      });
    }

    console.log('   ✅ Dependencies audit completed\n');
  }

  private async auditConfiguration(): Promise<void> {
    console.log('⚙️ Auditing Configuration...');

    // Check environment variables template
    const envExamplePath = join(this.rootPath, '.env.example');
    if (existsSync(envExamplePath)) {
      const envContent = readFileSync(envExamplePath, 'utf8');
      
      const requiredEnvVars = [
        'CLICKHOUSE_HOST',
        'CLICKHOUSE_HTTP_PORT',
        'CLICKHOUSE_DB',
        'CLICKHOUSE_USER',
        'CLICKHOUSE_PASSWORD',
        'SEARCH_ANALYTICS_ENABLED',
        'SEARCH_MIGRATION_PERCENTAGE',
        'ANALYTICS_BATCH_SIZE',
        'ANALYTICS_FLUSH_INTERVAL',
      ];

      for (const envVar of requiredEnvVars) {
        const hasVar = envContent.includes(envVar);
        this.results.push({
          category: 'Configuration',
          item: `Environment variable: ${envVar}`,
          status: hasVar ? 'PASS' : 'FAIL',
          message: hasVar ? `✅ ${envVar} configured` : `❌ Missing: ${envVar}`,
          critical: true,
        });
      }
    } else {
      this.results.push({
        category: 'Configuration',
        item: '.env.example file',
        status: 'FAIL',
        message: '❌ Missing .env.example file',
        critical: true,
      });
    }

    console.log('   ✅ Configuration audit completed\n');
  }

  private async auditDockerSetup(): Promise<void> {
    console.log('🐳 Auditing Docker Setup...');

    const dockerComposePath = join(this.rootPath, 'docker-compose.clickhouse.yml');
    if (existsSync(dockerComposePath)) {
      const dockerContent = readFileSync(dockerComposePath, 'utf8');
      
      const requiredServices = [
        'clickhouse',
        'tabix',
        'vector',
      ];

      for (const service of requiredServices) {
        const hasService = dockerContent.includes(`${service}:`);
        this.results.push({
          category: 'Docker Setup',
          item: `Service: ${service}`,
          status: hasService ? 'PASS' : 'FAIL',
          message: hasService ? `✅ ${service} service configured` : `❌ Missing: ${service} service`,
          critical: true,
        });
      }

      // Check for required volumes
      const hasVolumes = dockerContent.includes('clickhouse_data:');
      this.results.push({
        category: 'Docker Setup',
        item: 'Persistent volumes',
        status: hasVolumes ? 'PASS' : 'WARNING',
        message: hasVolumes ? '✅ Persistent volumes configured' : '⚠️ Check persistent volumes',
        critical: false,
      });

    } else {
      this.results.push({
        category: 'Docker Setup',
        item: 'Docker Compose file',
        status: 'FAIL',
        message: '❌ Missing docker-compose.clickhouse.yml',
        critical: true,
      });
    }

    console.log('   ✅ Docker setup audit completed\n');
  }

  private async auditTypeScriptConfig(): Promise<void> {
    console.log('📝 Auditing TypeScript Configuration...');

    // Check analytics library TypeScript config
    const analyticsConfigPath = join(this.rootPath, 'libs/analytics/tsconfig.json');
    if (existsSync(analyticsConfigPath)) {
      try {
        const config = JSON.parse(readFileSync(analyticsConfigPath, 'utf8'));
        
        const hasExtends = config.extends === '../../tsconfig.base.json';
        this.results.push({
          category: 'TypeScript',
          item: 'Analytics library extends base config',
          status: hasExtends ? 'PASS' : 'WARNING',
          message: hasExtends ? '✅ Extends base config' : '⚠️ Check extends configuration',
          critical: false,
        });

        const hasOutDir = config.compilerOptions?.outDir;
        this.results.push({
          category: 'TypeScript',
          item: 'Analytics library output directory',
          status: hasOutDir ? 'PASS' : 'WARNING',
          message: hasOutDir ? '✅ Output directory configured' : '⚠️ Check output directory',
          critical: false,
        });

      } catch (error) {
        this.results.push({
          category: 'TypeScript',
          item: 'Analytics TypeScript config',
          status: 'FAIL',
          message: `❌ Invalid TypeScript config: ${error.message}`,
          critical: true,
        });
      }
    }

    console.log('   ✅ TypeScript configuration audit completed\n');
  }

  private async auditEnvironmentVariables(): Promise<void> {
    console.log('🌍 Auditing Environment Variables...');

    // Check if current environment has required variables
    const requiredEnvVars = [
      { name: 'NODE_ENV', critical: false, defaultValue: 'development' },
      { name: 'DATABASE_URL', critical: true, defaultValue: null },
      { name: 'REDIS_URL', critical: true, defaultValue: null },
      { name: 'TYPESENSE_API_KEY', critical: true, defaultValue: null },
    ];

    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar.name];
      const hasValue = !!value;
      
      this.results.push({
        category: 'Environment',
        item: `${envVar.name}`,
        status: hasValue ? 'PASS' : (envVar.critical ? 'FAIL' : 'WARNING'),
        message: hasValue 
          ? `✅ ${envVar.name} is set` 
          : `${envVar.critical ? '❌' : '⚠️'} ${envVar.name} not set${envVar.defaultValue ? ` (default: ${envVar.defaultValue})` : ''}`,
        critical: envVar.critical,
      });
    }

    console.log('   ✅ Environment variables audit completed\n');
  }

  private async auditSecurityConsiderations(): Promise<void> {
    console.log('🔒 Auditing Security Considerations...');

    // Check ClickHouse configuration for security
    const clickhouseConfigPath = join(this.rootPath, 'infra/clickhouse/config.xml');
    if (existsSync(clickhouseConfigPath)) {
      const configContent = readFileSync(clickhouseConfigPath, 'utf8');
      
      const hasUserConfig = configContent.includes('<users>');
      this.results.push({
        category: 'Security',
        item: 'ClickHouse user authentication',
        status: hasUserConfig ? 'PASS' : 'WARNING',
        message: hasUserConfig ? '✅ User authentication configured' : '⚠️ Check user authentication',
        critical: false,
      });

      const hasNetworkRestriction = configContent.includes('<networks>');
      this.results.push({
        category: 'Security',
        item: 'ClickHouse network restrictions',
        status: hasNetworkRestriction ? 'PASS' : 'WARNING',
        message: hasNetworkRestriction ? '✅ Network restrictions configured' : '⚠️ Consider network restrictions',
        critical: false,
      });
    }

    // Check for sensitive data in code
    const analyticsServicePath = join(this.rootPath, 'libs/analytics/src/analytics.service.ts');
    if (existsSync(analyticsServicePath)) {
      const serviceContent = readFileSync(analyticsServicePath, 'utf8');
      
      const hasHardcodedSecrets = /password.*=.*['"][^'"]+['"]/.test(serviceContent);
      this.results.push({
        category: 'Security',
        item: 'No hardcoded secrets in analytics service',
        status: hasHardcodedSecrets ? 'FAIL' : 'PASS',
        message: hasHardcodedSecrets ? '❌ Hardcoded secrets detected' : '✅ No hardcoded secrets',
        critical: true,
      });
    }

    console.log('   ✅ Security audit completed\n');
  }

  private async auditTestingSetup(): Promise<void> {
    console.log('🧪 Auditing Testing Setup...');

    // Check test scripts
    const testScripts = [
      { path: 'scripts/test-clickhouse-analytics.ts', name: 'ClickHouse analytics test' },
      { path: 'scripts/test-search-migration.ts', name: 'Search migration test' },
    ];

    for (const script of testScripts) {
      const scriptPath = join(this.rootPath, script.path);
      const exists = existsSync(scriptPath);
      
      this.results.push({
        category: 'Testing',
        item: script.name,
        status: exists ? 'PASS' : 'WARNING',
        message: exists ? `✅ ${script.name} available` : `⚠️ Missing: ${script.name}`,
        critical: false,
      });
    }

    // Check if analytics library has test config
    const analyticsTestConfigPath = join(this.rootPath, 'libs/analytics/vitest.config.ts');
    const hasTestConfig = existsSync(analyticsTestConfigPath);
    
    this.results.push({
      category: 'Testing',
      item: 'Analytics library test configuration',
      status: hasTestConfig ? 'PASS' : 'WARNING',
      message: hasTestConfig ? '✅ Test configuration available' : '⚠️ Consider adding test configuration',
      critical: false,
    });

    console.log('   ✅ Testing setup audit completed\n');
  }

  private generateReport(): void {
    console.log('📊 PRODUCTION READINESS REPORT');
    console.log('═══════════════════════════════════════════════════════════════');

    // Group results by category
    const categories = [...new Set(this.results.map(r => r.category))];
    
    let totalPass = 0;
    let totalFail = 0;
    let totalWarning = 0;
    let criticalFail = 0;

    for (const category of categories) {
      console.log(`\n📁 ${category}:`);
      const categoryResults = this.results.filter(r => r.category === category);
      
      for (const result of categoryResults) {
        console.log(`   ${result.message}`);
        
        if (result.status === 'PASS') totalPass++;
        else if (result.status === 'FAIL') {
          totalFail++;
          if (result.critical) criticalFail++;
        }
        else if (result.status === 'WARNING') totalWarning++;
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📈 SUMMARY:');
    console.log(`   ✅ PASS: ${totalPass}`);
    console.log(`   ❌ FAIL: ${totalFail} (${criticalFail} critical)`);
    console.log(`   ⚠️  WARNING: ${totalWarning}`);

    const totalItems = totalPass + totalFail + totalWarning;
    const successRate = ((totalPass / totalItems) * 100).toFixed(1);
    
    console.log(`\n🎯 Success Rate: ${successRate}%`);

    // Production readiness assessment
    if (criticalFail === 0 && totalFail === 0) {
      console.log('\n🎉 PRODUCTION READY! ✅');
      console.log('   All critical components are in place and configured correctly.');
      console.log('   You can proceed with deployment.');
    } else if (criticalFail === 0) {
      console.log('\n✅ MOSTLY READY FOR PRODUCTION');
      console.log('   No critical failures detected.');
      console.log('   Address warnings for optimal setup.');
    } else {
      console.log('\n⚠️  NOT READY FOR PRODUCTION');
      console.log(`   ${criticalFail} critical failure(s) must be resolved before deployment.`);
      console.log('   Please fix critical issues and run audit again.');
    }

    // Next steps
    console.log('\n📋 NEXT STEPS:');
    if (criticalFail === 0) {
      console.log('   1. Start ClickHouse services: docker-compose -f docker-compose.clickhouse.yml up -d');
      console.log('   2. Run test scripts to verify functionality');
      console.log('   3. Configure environment variables for your environment');
      console.log('   4. Deploy with migration percentage at 0%');
      console.log('   5. Gradually increase migration percentage');
    } else {
      console.log('   1. Fix all critical failures listed above');
      console.log('   2. Run this audit again: pnpm tsx scripts/audit-production-readiness.ts');
      console.log('   3. Proceed with deployment only after all critical issues are resolved');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
  }
}

// Run the audit
async function main() {
  const auditor = new ProductionReadinessAuditor();
  await auditor.runAudit();
}

main().catch(console.error);
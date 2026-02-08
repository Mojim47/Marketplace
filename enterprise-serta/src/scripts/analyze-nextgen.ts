// ═══════════════════════════════════════════════════════════════════════════
// NextGen Marketplace Analysis Script
// ═══════════════════════════════════════════════════════════════════════════

import { SertaOrchestrator } from '../engine/orchestrator';
import { SertaConfig, AgentType, ReportFormat } from '../types';
import * as path from 'path';
import chalk from 'chalk';

async function analyzeNextGenMarketplace() {
  console.log(chalk.cyan('🚀 Enterprise-SERTA Analysis of NextGen Marketplace'));
  console.log(chalk.cyan('═'.repeat(60)));

  // Configuration for NextGen Marketplace analysis
  const config: SertaConfig = {
    projectPath: path.resolve('../'), // Parent directory (NextGen Marketplace root)
    outputPath: path.join(__dirname, '../../results/nextgen-analysis'),
    
    vectorDb: {
      provider: 'qdrant',
      url: 'http://localhost:6333',
      collection: 'nextgen_marketplace_analysis',
      dimensions: 4096
    },
    
    agents: [
      // Enable all agents for comprehensive analysis
      { type: AgentType.SECURITY_REDTEAM, enabled: true, config: {
        deepScan: true,
        businessLogicFocus: true,
        iranianComplianceFocus: true
      }},
      { type: AgentType.ARCHITECTURE_DESTROYER, enabled: true, config: {
        monorepoAnalysis: true,
        microservicePatterns: true
      }},
      { type: AgentType.DATABASE_BREACHER, enabled: true, config: {
        prismaFocus: true,
        rlsAnalysis: true,
        multiTenantFocus: true
      }},
      { type: AgentType.RLS_ISOLATION_CHECKER, enabled: true, config: {
        tenantIsolationDeepScan: true,
        postgresRLSFocus: true
      }},
      { type: AgentType.PERFORMANCE_ASSASSIN, enabled: true, config: {
        nestjsOptimization: true,
        prismaQueryAnalysis: true,
        redisPatterns: true
      }},
      { type: AgentType.DEADLOCK_HUNTER, enabled: true, config: {
        concurrencyAnalysis: true,
        paymentFlowFocus: true
      }},
      { type: AgentType.MEMORY_LEAK_DETECTOR, enabled: true, config: {
        nodejsPatterns: true,
        eventLoopAnalysis: true
      }},
      { type: AgentType.CONFIG_MISFIRE_DETECTOR, enabled: true, config: {
        kubernetesConfigs: true,
        dockerConfigs: true,
        envVariables: true
      }},
      { type: AgentType.API_SURFACE_ANALYZER, enabled: true, config: {
        openApiAnalysis: true,
        nestjsControllers: true,
        graphqlResolvers: true
      }},
      { type: AgentType.COMPLIANCE_AGENT, enabled: true, config: {
        iranianRegulations: true,
        moodianCompliance: true,
        pciDssBasics: true,
        gdprBasics: true
      }},
      { type: AgentType.FINANCIAL_RISK_AGENT, enabled: true, config: {
        zarinpalIntegration: true,
        paymentFlows: true,
        pricingLogic: true,
        orderProcessing: true
      }},
      { type: AgentType.ML_EXPLOIT_GENERATOR, enabled: true, config: {
        patternLearning: true,
        exploitChainGeneration: true,
        businessLogicExploits: true
      }}
    ],
    
    analysis: {
      includePatterns: [
        // NextGen Marketplace specific patterns
        'apps/**/*.{ts,tsx,js,jsx}',
        'libs/**/*.{ts,tsx,js,jsx}',
        'prisma/**/*.{prisma,sql}',
        'k8s/**/*.{yaml,yml}',
        'terraform/**/*.{tf,hcl}',
        'contracts/**/*.{yaml,yml,json}',
        'monitoring/**/*.{yaml,yml}',
        'scripts/**/*.{ts,js,sh}',
        'Dockerfile*',
        'docker-compose*.yml',
        '*.{json,yaml,yml,md}',
        '.env*'
      ],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/*.min.js',
        '**/*.bundle.js',
        '**/vendor/**',
        '**/third_party/**',
        // Exclude generated files
        '**/.prisma/**',
        '**/generated/**',
        // Exclude test files for now (can be enabled later)
        '**/*.test.{ts,js}',
        '**/*.spec.{ts,js}',
        '**/test/**',
        '**/tests/**'
      ],
      maxFileSize: 2 * 1024 * 1024, // 2MB for larger config files
      parallelism: 8, // Higher parallelism for comprehensive analysis
      timeout: 600000 // 10 minutes timeout
    },
    
    reporting: {
      formats: [
        ReportFormat.JSON,
        ReportFormat.HTML,
        ReportFormat.MARKDOWN,
        ReportFormat.SARIF // For integration with security tools
      ],
      includeEvidence: true,
      includeRecommendations: true,
      executiveSummary: true
    }
  };

  const orchestrator = new SertaOrchestrator(config);

  try {
    console.log(chalk.blue('\n🔧 Initializing Enterprise-SERTA for NextGen Marketplace...'));
    await orchestrator.initialize();

    console.log(chalk.blue('\n🎯 Starting comprehensive security analysis...'));
    console.log(chalk.gray('This analysis will focus on:'));
    console.log(chalk.gray('  • Multi-tenant security isolation'));
    console.log(chalk.gray('  • Iranian marketplace compliance (Moodian, ZarinPal)'));
    console.log(chalk.gray('  • NestJS + Prisma security patterns'));
    console.log(chalk.gray('  • Kubernetes and infrastructure security'));
    console.log(chalk.gray('  • Business logic vulnerabilities'));
    console.log(chalk.gray('  • Payment processing security'));
    console.log(chalk.gray('  • API surface attack vectors'));

    const startTime = Date.now();
    const result = await orchestrator.analyzeProject();
    const duration = Date.now() - startTime;

    console.log(chalk.green('\n🎉 NextGen Marketplace Analysis Completed!'));
    console.log(chalk.blue('═'.repeat(60)));
    
    // Print detailed results
    console.log(chalk.bold('\n📊 ANALYSIS RESULTS'));
    console.log(`${chalk.bold('Duration:')} ${Math.round(duration / 1000)}s`);
    console.log(`${chalk.bold('Overall Risk Score:')} ${getRiskColor(result.overallRiskScore)}${result.overallRiskScore.toFixed(1)}/10${chalk.reset()}`);
    
    console.log(chalk.bold('\n🏗️ CODEBASE METRICS'));
    console.log(`${chalk.bold('Files Analyzed:')} ${result.summary.totalFiles}`);
    console.log(`${chalk.bold('Functions:')} ${result.summary.totalFunctions}`);
    console.log(`${chalk.bold('API Endpoints:')} ${result.summary.totalEndpoints}`);
    console.log(`${chalk.bold('Threat Graph Nodes:')} ${result.threatGraph.nodes.length}`);
    console.log(`${chalk.bold('Attack Paths:')} ${result.threatGraph.criticalPaths.length}`);

    console.log(chalk.bold('\n🚨 SECURITY FINDINGS'));
    console.log(`${chalk.red.bold('Critical:')} ${result.summary.criticalVulnerabilities}`);
    console.log(`${chalk.yellow.bold('High:')} ${result.summary.highRiskVulnerabilities}`);
    console.log(`${chalk.blue.bold('Medium:')} ${result.summary.mediumRiskVulnerabilities}`);
    console.log(`${chalk.gray.bold('Low:')} ${result.summary.lowRiskVulnerabilities}`);

    console.log(chalk.bold('\n💼 BUSINESS IMPACT'));
    console.log(`${chalk.red.bold('Business Critical Risks:')} ${result.summary.businessCriticalRisks}`);
    console.log(`${chalk.yellow.bold('Compliance Violations:')} ${result.summary.complianceViolations}`);
    console.log(`${chalk.blue.bold('Performance Issues:')} ${result.summary.performanceIssues}`);

    console.log(chalk.bold('\n🤖 AGENT PERFORMANCE'));
    result.agentResults.forEach(agent => {
      const criticalFindings = agent.findings.filter(f => f.severity === 'critical').length;
      const executionTime = Math.round(agent.metrics.executionTime / 1000);
      
      console.log(`${chalk.bold(agent.name)}:`);
      console.log(`  Findings: ${agent.findings.length} (${criticalFindings} critical)`);
      console.log(`  Execution: ${executionTime}s`);
      console.log(`  Coverage: ${agent.metrics.coveragePercentage}%`);
    });

    // Print top critical findings
    const allFindings = result.agentResults.flatMap(agent => agent.findings);
    const criticalFindings = allFindings.filter(f => f.severity === 'critical');
    
    if (criticalFindings.length > 0) {
      console.log(chalk.red.bold('\n🔥 TOP CRITICAL FINDINGS'));
      criticalFindings.slice(0, 5).forEach((finding, i) => {
        console.log(`${i + 1}. ${chalk.red(finding.title)}`);
        console.log(`   ${chalk.gray(finding.description)}`);
        console.log(`   ${chalk.yellow('Impact:')} Financial: ${finding.businessImpact.financial}/10`);
      });
    }

    // Print top recommendations
    console.log(chalk.blue.bold('\n🎯 TOP RECOMMENDATIONS'));
    result.recommendations.slice(0, 5).forEach((rec, i) => {
      const priorityColor = rec.priority === 'critical' ? chalk.red : 
                           rec.priority === 'high' ? chalk.yellow : chalk.blue;
      console.log(`${i + 1}. ${priorityColor.bold(rec.title)} (${rec.priority.toUpperCase()})`);
      console.log(`   ${chalk.gray(rec.description)}`);
      console.log(`   ${chalk.cyan('Effort:')} ${rec.estimatedEffort}`);
    });

    // NextGen Marketplace specific insights
    console.log(chalk.magenta.bold('\n🏪 NEXTGEN MARKETPLACE SPECIFIC INSIGHTS'));
    
    // Multi-tenant security analysis
    const tenantFindings = allFindings.filter(f => 
      f.title.toLowerCase().includes('tenant') || 
      f.description.toLowerCase().includes('isolation')
    );
    console.log(`${chalk.bold('Multi-Tenant Security:')} ${tenantFindings.length} issues found`);
    
    // Payment security analysis
    const paymentFindings = allFindings.filter(f => 
      f.title.toLowerCase().includes('payment') || 
      f.description.toLowerCase().includes('zarinpal')
    );
    console.log(`${chalk.bold('Payment Security:')} ${paymentFindings.length} issues found`);
    
    // Iranian compliance analysis
    const complianceFindings = allFindings.filter(f => 
      f.title.toLowerCase().includes('moodian') || 
      f.description.toLowerCase().includes('tax') ||
      f.description.toLowerCase().includes('iranian')
    );
    console.log(`${chalk.bold('Iranian Compliance:')} ${complianceFindings.length} issues found`);

    // API security analysis
    const apiFindings = allFindings.filter(f => 
      f.title.toLowerCase().includes('api') || 
      f.title.toLowerCase().includes('endpoint')
    );
    console.log(`${chalk.bold('API Security:')} ${apiFindings.length} issues found`);

    console.log(chalk.blue('\n📄 DETAILED REPORTS'));
    console.log(`${chalk.bold('Results Directory:')} ${config.outputPath}`);
    console.log(`${chalk.bold('Executive Summary:')} executive-summary-${result.id}.md`);
    console.log(`${chalk.bold('Full Report:')} analysis-${result.id}.json`);
    console.log(`${chalk.bold('Threat Graph:')} threat-graph-${result.id}.json`);

    // Cleanup
    await orchestrator.cleanup();

    // Exit with appropriate code
    if (result.summary.criticalVulnerabilities > 0) {
      console.log(chalk.red('\n⚠️ CRITICAL VULNERABILITIES FOUND - Review immediately!'));
      process.exit(1);
    } else if (result.summary.highRiskVulnerabilities > 0) {
      console.log(chalk.yellow('\n⚠️ HIGH RISK VULNERABILITIES FOUND - Address before production'));
      process.exit(0);
    } else {
      console.log(chalk.green('\n✅ No critical vulnerabilities found'));
      process.exit(0);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Analysis failed:'), error);
    await orchestrator.cleanup();
    process.exit(1);
  }
}

function getRiskColor(score: number): any {
  if (score >= 8) return chalk.red.bold;
  if (score >= 6) return chalk.yellow.bold;
  if (score >= 4) return chalk.blue.bold;
  return chalk.green.bold;
}

// Run the analysis
if (require.main === module) {
  analyzeNextGenMarketplace().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { analyzeNextGenMarketplace };
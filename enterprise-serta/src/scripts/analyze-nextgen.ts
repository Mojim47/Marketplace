// ═══════════════════════════════════════════════════════════════════════════
// NextGen Marketplace Analysis Script
// ═══════════════════════════════════════════════════════════════════════════

import * as path from 'node:path';
import chalk from 'chalk';
import { SertaOrchestrator } from '../engine/orchestrator';
import { AgentType, ReportFormat, type SertaConfig } from '../types';

async function analyzeNextGenMarketplace() {
  // Configuration for NextGen Marketplace analysis
  const config: SertaConfig = {
    projectPath: path.resolve('../'), // Parent directory (NextGen Marketplace root)
    outputPath: path.join(__dirname, '../../results/nextgen-analysis'),

    vectorDb: {
      provider: 'qdrant',
      url: 'http://localhost:6333',
      collection: 'nextgen_marketplace_analysis',
      dimensions: 4096,
    },

    agents: [
      // Enable all agents for comprehensive analysis
      {
        type: AgentType.SECURITY_REDTEAM,
        enabled: true,
        config: {
          deepScan: true,
          businessLogicFocus: true,
          iranianComplianceFocus: true,
        },
      },
      {
        type: AgentType.ARCHITECTURE_DESTROYER,
        enabled: true,
        config: {
          monorepoAnalysis: true,
          microservicePatterns: true,
        },
      },
      {
        type: AgentType.DATABASE_BREACHER,
        enabled: true,
        config: {
          prismaFocus: true,
          rlsAnalysis: true,
          multiTenantFocus: true,
        },
      },
      {
        type: AgentType.RLS_ISOLATION_CHECKER,
        enabled: true,
        config: {
          tenantIsolationDeepScan: true,
          postgresRLSFocus: true,
        },
      },
      {
        type: AgentType.PERFORMANCE_ASSASSIN,
        enabled: true,
        config: {
          nestjsOptimization: true,
          prismaQueryAnalysis: true,
          redisPatterns: true,
        },
      },
      {
        type: AgentType.DEADLOCK_HUNTER,
        enabled: true,
        config: {
          concurrencyAnalysis: true,
          paymentFlowFocus: true,
        },
      },
      {
        type: AgentType.MEMORY_LEAK_DETECTOR,
        enabled: true,
        config: {
          nodejsPatterns: true,
          eventLoopAnalysis: true,
        },
      },
      {
        type: AgentType.CONFIG_MISFIRE_DETECTOR,
        enabled: true,
        config: {
          kubernetesConfigs: true,
          dockerConfigs: true,
          envVariables: true,
        },
      },
      {
        type: AgentType.API_SURFACE_ANALYZER,
        enabled: true,
        config: {
          openApiAnalysis: true,
          nestjsControllers: true,
          graphqlResolvers: true,
        },
      },
      {
        type: AgentType.COMPLIANCE_AGENT,
        enabled: true,
        config: {
          iranianRegulations: true,
          moodianCompliance: true,
          pciDssBasics: true,
          gdprBasics: true,
        },
      },
      {
        type: AgentType.FINANCIAL_RISK_AGENT,
        enabled: true,
        config: {
          zarinpalIntegration: true,
          paymentFlows: true,
          pricingLogic: true,
          orderProcessing: true,
        },
      },
      {
        type: AgentType.ML_EXPLOIT_GENERATOR,
        enabled: true,
        config: {
          patternLearning: true,
          exploitChainGeneration: true,
          businessLogicExploits: true,
        },
      },
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
        '.env*',
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
        '**/tests/**',
      ],
      maxFileSize: 2 * 1024 * 1024, // 2MB for larger config files
      parallelism: 8, // Higher parallelism for comprehensive analysis
      timeout: 600000, // 10 minutes timeout
    },

    reporting: {
      formats: [
        ReportFormat.JSON,
        ReportFormat.HTML,
        ReportFormat.MARKDOWN,
        ReportFormat.SARIF, // For integration with security tools
      ],
      includeEvidence: true,
      includeRecommendations: true,
      executiveSummary: true,
    },
  };

  const orchestrator = new SertaOrchestrator(config);

  try {
    await orchestrator.initialize();

    const startTime = Date.now();
    const result = await orchestrator.analyzeProject();
    const _duration = Date.now() - startTime;
    result.agentResults.forEach((agent) => {
      const _criticalFindings = agent.findings.filter((f) => f.severity === 'critical').length;
      const _executionTime = Math.round(agent.metrics.executionTime / 1000);
    });

    // Print top critical findings
    const allFindings = result.agentResults.flatMap((agent) => agent.findings);
    const criticalFindings = allFindings.filter((f) => f.severity === 'critical');

    if (criticalFindings.length > 0) {
      criticalFindings.slice(0, 5).forEach((_finding, _i) => {});
    }
    result.recommendations.slice(0, 5).forEach((rec, _i) => {
      const _priorityColor =
        rec.priority === 'critical'
          ? chalk.red
          : rec.priority === 'high'
            ? chalk.yellow
            : chalk.blue;
    });

    // Multi-tenant security analysis
    const _tenantFindings = allFindings.filter(
      (f) =>
        f.title.toLowerCase().includes('tenant') ||
        f.description.toLowerCase().includes('isolation')
    );

    // Payment security analysis
    const _paymentFindings = allFindings.filter(
      (f) =>
        f.title.toLowerCase().includes('payment') ||
        f.description.toLowerCase().includes('zarinpal')
    );

    // Iranian compliance analysis
    const _complianceFindings = allFindings.filter(
      (f) =>
        f.title.toLowerCase().includes('moodian') ||
        f.description.toLowerCase().includes('tax') ||
        f.description.toLowerCase().includes('iranian')
    );

    // API security analysis
    const _apiFindings = allFindings.filter(
      (f) => f.title.toLowerCase().includes('api') || f.title.toLowerCase().includes('endpoint')
    );

    // Cleanup
    await orchestrator.cleanup();

    // Exit with appropriate code
    if (result.summary.criticalVulnerabilities > 0) {
      process.exit(1);
    } else if (result.summary.highRiskVulnerabilities > 0) {
      process.exit(0);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Analysis failed:'), error);
    await orchestrator.cleanup();
    process.exit(1);
  }
}

function getRiskColor(score: number): any {
  if (score >= 8) {
    return chalk.red.bold;
  }
  if (score >= 6) {
    return chalk.yellow.bold;
  }
  if (score >= 4) {
    return chalk.blue.bold;
  }
  return chalk.green.bold;
}

// Run the analysis
if (require.main === module) {
  analyzeNextGenMarketplace().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { analyzeNextGenMarketplace };

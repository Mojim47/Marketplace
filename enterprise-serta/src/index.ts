// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-SERTA Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { SertaOrchestrator } from '../engine/orchestrator';
import { AgentType, ReportFormat, type SertaConfig } from '../types';

const program = new Command();

// ASCII Art Banner
function printBanner(): void {}

// Default configuration
function createDefaultConfig(projectPath: string): SertaConfig {
  return {
    projectPath: path.resolve(projectPath),
    outputPath: path.join(process.cwd(), 'serta-results'),
    vectorDb: {
      provider: 'qdrant',
      url: 'http://localhost:6333',
      collection: 'enterprise_serta_embeddings',
      dimensions: 4096,
    },
    agents: [
      { type: AgentType.SECURITY_REDTEAM, enabled: true, config: {} },
      { type: AgentType.ARCHITECTURE_DESTROYER, enabled: true, config: {} },
      { type: AgentType.DATABASE_BREACHER, enabled: true, config: {} },
      { type: AgentType.RLS_ISOLATION_CHECKER, enabled: true, config: {} },
      { type: AgentType.PERFORMANCE_ASSASSIN, enabled: true, config: {} },
      { type: AgentType.DEADLOCK_HUNTER, enabled: true, config: {} },
      { type: AgentType.MEMORY_LEAK_DETECTOR, enabled: true, config: {} },
      { type: AgentType.CONFIG_MISFIRE_DETECTOR, enabled: true, config: {} },
      { type: AgentType.API_SURFACE_ANALYZER, enabled: true, config: {} },
      { type: AgentType.COMPLIANCE_AGENT, enabled: true, config: {} },
      { type: AgentType.FINANCIAL_RISK_AGENT, enabled: true, config: {} },
      { type: AgentType.ML_EXPLOIT_GENERATOR, enabled: true, config: {} },
    ],
    analysis: {
      includePatterns: [
        '**/*.{ts,js,tsx,jsx}',
        '**/*.{py,java,go,rs,php,rb,cs,cpp,c,h}',
        '**/*.{yaml,yml,json,sql}',
        '**/Dockerfile*',
        '**/*.prisma',
      ],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.bundle.js',
        '**/vendor/**',
        '**/third_party/**',
        '**/.next/**',
        '**/.nuxt/**',
      ],
      maxFileSize: 1024 * 1024, // 1MB
      parallelism: 5,
      timeout: 300000, // 5 minutes
    },
    reporting: {
      formats: [ReportFormat.JSON, ReportFormat.HTML, ReportFormat.MARKDOWN],
      includeEvidence: true,
      includeRecommendations: true,
      executiveSummary: true,
    },
  };
}

// Load configuration from file
async function loadConfig(configPath?: string): Promise<Partial<SertaConfig>> {
  if (!configPath) {
    return {};
  }

  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Could not load config from ${configPath}:`, error.message));
    return {};
  }
}

// Merge configurations
function mergeConfig(defaultConfig: SertaConfig, userConfig: Partial<SertaConfig>): SertaConfig {
  return {
    ...defaultConfig,
    ...userConfig,
    vectorDb: { ...defaultConfig.vectorDb, ...userConfig.vectorDb },
    analysis: { ...defaultConfig.analysis, ...userConfig.analysis },
    reporting: { ...defaultConfig.reporting, ...userConfig.reporting },
    agents: userConfig.agents || defaultConfig.agents,
  };
}

// Validate configuration
function validateConfig(config: SertaConfig): void {
  if (!config.projectPath) {
    throw new Error('Project path is required');
  }

  if (!config.vectorDb.url) {
    throw new Error('Vector database URL is required');
  }

  if (config.agents.length === 0) {
    throw new Error('At least one agent must be enabled');
  }
}

// Main analyze command
program
  .name('serta')
  .description('Enterprise Zero-Trust Threat-Graph + Vector-DB + ML-Driven Auditor')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a project for security vulnerabilities and risks')
  .argument('<project-path>', 'Path to the project to analyze')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <path>', 'Output directory for results')
  .option('--vector-db <url>', 'Vector database URL (default: http://localhost:6333)')
  .option('--agents <agents>', 'Comma-separated list of agents to run')
  .option('--parallel <number>', 'Number of parallel workers', '5')
  .option('--timeout <ms>', 'Analysis timeout in milliseconds', '300000')
  .option('--verbose', 'Enable verbose logging')
  .action(async (projectPath: string, options: any) => {
    try {
      printBanner();

      // Load and merge configuration
      const defaultConfig = createDefaultConfig(projectPath);
      const userConfig = await loadConfig(options.config);
      const config = mergeConfig(defaultConfig, userConfig);

      // Apply command line overrides
      if (options.output) {
        config.outputPath = path.resolve(options.output);
      }

      if (options.vectorDb) {
        config.vectorDb.url = options.vectorDb;
      }

      if (options.parallel) {
        config.analysis.parallelism = Number.parseInt(options.parallel);
      }

      if (options.timeout) {
        config.analysis.timeout = Number.parseInt(options.timeout);
      }

      if (options.agents) {
        const enabledAgentTypes = options.agents.split(',').map((a: string) => a.trim());
        config.agents = config.agents.map((agent) => ({
          ...agent,
          enabled: enabledAgentTypes.includes(agent.type),
        }));
      }

      // Validate configuration
      validateConfig(config);

      // Initialize orchestrator
      const orchestrator = new SertaOrchestrator(config);

      // Setup cleanup handlers
      const cleanup = async () => {
        await orchestrator.cleanup();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      try {
        // Initialize components
        await orchestrator.initialize();

        // Run analysis
        const _result = await orchestrator.analyzeProject();

        await orchestrator.cleanup();
      } catch (error) {
        console.error(chalk.red('\n❌ Analysis failed:'), error);
        await orchestrator.cleanup();
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error);
      process.exit(1);
    }
  });

// Initialize command - setup vector database and dependencies
program
  .command('init')
  .description('Initialize Enterprise-SERTA (setup vector database, download models)')
  .option('--vector-db <url>', 'Vector database URL', 'http://localhost:6333')
  .option('--force', 'Force re-initialization')
  .action(async (options: any) => {
    try {
      printBanner();

      // Create minimal config for initialization
      const config: SertaConfig = {
        projectPath: process.cwd(),
        outputPath: path.join(process.cwd(), 'serta-results'),
        vectorDb: {
          provider: 'qdrant',
          url: options.vectorDb,
          collection: 'enterprise_serta_embeddings',
          dimensions: 4096,
        },
        agents: [],
        analysis: {
          includePatterns: [],
          excludePatterns: [],
          maxFileSize: 1024 * 1024,
          parallelism: 1,
          timeout: 60000,
        },
        reporting: {
          formats: [ReportFormat.JSON],
          includeEvidence: true,
          includeRecommendations: true,
          executiveSummary: true,
        },
      };

      const orchestrator = new SertaOrchestrator(config);
      await orchestrator.initialize();

      await orchestrator.cleanup();
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error);
      process.exit(1);
    }
  });

// Status command - check system status
program
  .command('status')
  .description('Check Enterprise-SERTA system status')
  .option('--vector-db <url>', 'Vector database URL', 'http://localhost:6333')
  .action(async (_options: any) => {
    try {
      printBanner();
      const _availableAgents = Object.values(AgentType);
      const _memUsage = process.memoryUsage();
    } catch (error) {
      console.error(chalk.red('❌ Status check failed:'), error);
      process.exit(1);
    }
  });

// Config command - generate configuration file
program
  .command('config')
  .description('Generate configuration file template')
  .option('-o, --output <path>', 'Output path for config file', 'serta.config.json')
  .action(async (options: any) => {
    try {
      const defaultConfig = createDefaultConfig('./');
      const configPath = path.resolve(options.output);

      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ Config generation failed:'), error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
}

// Export for programmatic usage
export { SertaOrchestrator, createDefaultConfig };
export * from '@/types';

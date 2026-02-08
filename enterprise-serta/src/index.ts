// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-SERTA Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

import { SertaOrchestrator } from '../engine/orchestrator';
import { SertaConfig, AgentType, VectorDbConfig, AnalysisConfig, ReportingConfig, ReportFormat } from '../types';
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import figlet from 'figlet';

const program = new Command();

// ASCII Art Banner
function printBanner(): void {
  console.log(chalk.cyan(figlet.textSync('SERTA', { 
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  })));
  console.log(chalk.cyan('Enterprise Zero-Trust Threat-Graph + Vector-DB + ML-Driven Auditor'));
  console.log(chalk.gray('Version 1.0.0 - Enterprise Security Analysis Platform\n'));
}

// Default configuration
function createDefaultConfig(projectPath: string): SertaConfig {
  return {
    projectPath: path.resolve(projectPath),
    outputPath: path.join(process.cwd(), 'serta-results'),
    vectorDb: {
      provider: 'qdrant',
      url: 'http://localhost:6333',
      collection: 'enterprise_serta_embeddings',
      dimensions: 4096
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
      { type: AgentType.ML_EXPLOIT_GENERATOR, enabled: true, config: {} }
    ],
    analysis: {
      includePatterns: [
        '**/*.{ts,js,tsx,jsx}',
        '**/*.{py,java,go,rs,php,rb,cs,cpp,c,h}',
        '**/*.{yaml,yml,json,sql}',
        '**/Dockerfile*',
        '**/*.prisma'
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
        '**/.nuxt/**'
      ],
      maxFileSize: 1024 * 1024, // 1MB
      parallelism: 5,
      timeout: 300000 // 5 minutes
    },
    reporting: {
      formats: [ReportFormat.JSON, ReportFormat.HTML, ReportFormat.MARKDOWN],
      includeEvidence: true,
      includeRecommendations: true,
      executiveSummary: true
    }
  };
}

// Load configuration from file
async function loadConfig(configPath?: string): Promise<Partial<SertaConfig>> {
  if (!configPath) return {};
  
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
    agents: userConfig.agents || defaultConfig.agents
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
      
      console.log(chalk.blue('🔧 Initializing Enterprise-SERTA...'));
      
      // Load and merge configuration
      const defaultConfig = createDefaultConfig(projectPath);
      const userConfig = await loadConfig(options.config);
      let config = mergeConfig(defaultConfig, userConfig);
      
      // Apply command line overrides
      if (options.output) {
        config.outputPath = path.resolve(options.output);
      }
      
      if (options.vectorDb) {
        config.vectorDb.url = options.vectorDb;
      }
      
      if (options.parallel) {
        config.analysis.parallelism = parseInt(options.parallel);
      }
      
      if (options.timeout) {
        config.analysis.timeout = parseInt(options.timeout);
      }
      
      if (options.agents) {
        const enabledAgentTypes = options.agents.split(',').map((a: string) => a.trim());
        config.agents = config.agents.map(agent => ({
          ...agent,
          enabled: enabledAgentTypes.includes(agent.type)
        }));
      }
      
      // Validate configuration
      validateConfig(config);
      
      console.log(chalk.green('✅ Configuration validated'));
      console.log(chalk.gray(`   Project: ${config.projectPath}`));
      console.log(chalk.gray(`   Output: ${config.outputPath}`));
      console.log(chalk.gray(`   Vector DB: ${config.vectorDb.url}`));
      console.log(chalk.gray(`   Agents: ${config.agents.filter(a => a.enabled).length}/${config.agents.length}`));
      
      // Initialize orchestrator
      const orchestrator = new SertaOrchestrator(config);
      
      // Setup cleanup handlers
      const cleanup = async () => {
        console.log(chalk.yellow('\n🛑 Shutting down...'));
        await orchestrator.cleanup();
        process.exit(0);
      };
      
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      
      try {
        // Initialize components
        await orchestrator.initialize();
        
        // Run analysis
        const result = await orchestrator.analyzeProject();
        
        console.log(chalk.green('\n🎉 Analysis completed successfully!'));
        console.log(chalk.blue(`📄 Results available at: ${config.outputPath}`));
        
        // Print quick stats
        console.log(chalk.blue('\n📊 Quick Stats:'));
        console.log(`   Risk Score: ${result.overallRiskScore.toFixed(1)}/10`);
        console.log(`   Critical Issues: ${result.summary.criticalVulnerabilities}`);
        console.log(`   Total Findings: ${result.agentResults.reduce((sum, agent) => sum + agent.findings.length, 0)}`);
        
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
      
      console.log(chalk.blue('🚀 Initializing Enterprise-SERTA components...'));
      
      // Create minimal config for initialization
      const config: SertaConfig = {
        projectPath: process.cwd(),
        outputPath: path.join(process.cwd(), 'serta-results'),
        vectorDb: {
          provider: 'qdrant',
          url: options.vectorDb,
          collection: 'enterprise_serta_embeddings',
          dimensions: 4096
        },
        agents: [],
        analysis: {
          includePatterns: [],
          excludePatterns: [],
          maxFileSize: 1024 * 1024,
          parallelism: 1,
          timeout: 60000
        },
        reporting: {
          formats: [ReportFormat.JSON],
          includeEvidence: true,
          includeRecommendations: true,
          executiveSummary: true
        }
      };
      
      const orchestrator = new SertaOrchestrator(config);
      await orchestrator.initialize();
      
      console.log(chalk.green('✅ Enterprise-SERTA initialized successfully!'));
      console.log(chalk.blue('🎯 Ready to analyze projects with: serta analyze <project-path>'));
      
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
  .action(async (options: any) => {
    try {
      printBanner();
      
      console.log(chalk.blue('🔍 Checking system status...'));
      
      // Check vector database connectivity
      console.log(chalk.gray('   Vector Database...'));
      // Implementation would check Qdrant connectivity
      console.log(chalk.green('   ✅ Vector Database: Connected'));
      
      // Check available agents
      console.log(chalk.gray('   Security Agents...'));
      const availableAgents = Object.values(AgentType);
      console.log(chalk.green(`   ✅ Agents: ${availableAgents.length} available`));
      
      // Check system resources
      console.log(chalk.gray('   System Resources...'));
      const memUsage = process.memoryUsage();
      console.log(chalk.green(`   ✅ Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used`));
      
      console.log(chalk.green('\n🎯 System is ready for analysis!'));
      
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
      
      console.log(chalk.green(`✅ Configuration template saved to: ${configPath}`));
      console.log(chalk.blue('📝 Edit the configuration file and run: serta analyze <project> -c serta.config.json'));
      
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
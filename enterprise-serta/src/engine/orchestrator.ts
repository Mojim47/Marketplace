// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-SERTA Orchestrator - Main Analysis Engine
// ═══════════════════════════════════════════════════════════════════════════

import { 
  AnalysisResult, 
  AnalysisStatus, 
  SertaConfig, 
  CodeFile, 
  ThreatGraph,
  Agent,
  AgentType,
  AnalysisSummary,
  Recommendation,
  Priority,
  RecommendationCategory
} from '../types';

import { FileScanner } from '../collector/file-scanner';
import { ASTParser } from '../collector/ast-parser';
import { DependencyGraphBuilder } from '../collector/dependency-graph';
import { SemanticEmbedder } from '../embeddings/semantic-embedder';
import { VectorStore } from '../embeddings/store';
import { ThreatGraphBuilder } from '../threat-graph/graph-builder';
import { SecurityRedTeamAgent } from '../agents/security-redteam';

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import chalk from 'chalk';
import ora from 'ora';

export class SertaOrchestrator {
  private config: SertaConfig;
  private vectorStore: VectorStore;
  private semanticEmbedder: SemanticEmbedder;
  private agents: Map<AgentType, Agent> = new Map();
  private analysisId: string;

  constructor(config: SertaConfig) {
    this.config = config;
    this.analysisId = crypto.randomUUID();
    
    // Initialize components
    this.vectorStore = new VectorStore(
      config.vectorDb.url,
      config.vectorDb.collection
    );
    this.semanticEmbedder = new SemanticEmbedder();
    
    // Initialize agents
    this.initializeAgents();
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue('🚀 Initializing Enterprise-SERTA...'));
    
    const spinner = ora('Setting up vector store...').start();
    try {
      await this.vectorStore.initialize();
      spinner.succeed('Vector store initialized');
    } catch (error) {
      spinner.fail('Vector store initialization failed');
      throw error;
    }

    const embeddingSpinner = ora('Loading semantic embedding model...').start();
    try {
      await this.semanticEmbedder.initialize();
      embeddingSpinner.succeed('Semantic embedder initialized');
    } catch (error) {
      embeddingSpinner.fail('Semantic embedder initialization failed');
      throw error;
    }

    console.log(chalk.green('✅ Enterprise-SERTA initialized successfully'));
  }

  async analyzeProject(): Promise<AnalysisResult> {
    const startTime = new Date();
    console.log(chalk.blue(`🔍 Starting comprehensive security analysis of: ${this.config.projectPath}`));

    const result: AnalysisResult = {
      id: this.analysisId,
      projectPath: this.config.projectPath,
      startTime,
      endTime: new Date(),
      status: AnalysisStatus.RUNNING,
      overallRiskScore: 0,
      threatGraph: { nodes: [], edges: [], riskScore: 0, criticalPaths: [], vulnerabilities: [] },
      agentResults: [],
      summary: this.createEmptySummary(),
      recommendations: []
    };

    try {
      // Phase 1: Code Collection and Parsing
      console.log(chalk.yellow('\n📁 Phase 1: Code Collection and Parsing'));
      const codeFiles = await this.collectAndParseCode();
      
      // Phase 2: Dependency Analysis
      console.log(chalk.yellow('\n🔗 Phase 2: Dependency Analysis'));
      const dependencyGraph = await this.analyzeDependencies(codeFiles);
      
      // Phase 3: Semantic Embedding Generation
      console.log(chalk.yellow('\n🧠 Phase 3: Semantic Embedding Generation'));
      await this.generateEmbeddings(codeFiles);
      
      // Phase 4: Threat Graph Construction
      console.log(chalk.yellow('\n🕸️ Phase 4: Threat Graph Construction'));
      const threatGraph = await this.buildThreatGraph(codeFiles, dependencyGraph);
      result.threatGraph = threatGraph;
      
      // Phase 5: Multi-Agent Security Analysis
      console.log(chalk.yellow('\n🤖 Phase 5: Multi-Agent Security Analysis'));
      const agentResults = await this.runSecurityAgents(codeFiles, threatGraph);
      result.agentResults = agentResults;
      
      // Phase 6: Risk Assessment and Reporting
      console.log(chalk.yellow('\n📊 Phase 6: Risk Assessment and Reporting'));
      await this.performRiskAssessment(result);
      
      result.status = AnalysisStatus.COMPLETED;
      result.endTime = new Date();
      
      // Save results
      await this.saveResults(result);
      
      console.log(chalk.green(`\n✅ Analysis completed successfully in ${this.getExecutionTime(startTime)}ms`));
      this.printSummary(result);
      
      return result;
      
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
      result.status = AnalysisStatus.FAILED;
      result.endTime = new Date();
      throw error;
    }
  }

  private async collectAndParseCode(): Promise<CodeFile[]> {
    const spinner = ora('Scanning project files...').start();
    
    try {
      // Initialize file scanner
      const scanner = new FileScanner(
        this.config.analysis.includePatterns,
        this.config.analysis.excludePatterns,
        this.config.analysis.maxFileSize
      );
      
      // Scan project
      const codeFiles = await scanner.scanProject(this.config.projectPath);
      spinner.succeed(`Found ${codeFiles.length} files to analyze`);
      
      // Parse AST for each file
      const parseSpinner = ora('Parsing abstract syntax trees...').start();
      const parser = new ASTParser();
      const parsedFiles: CodeFile[] = [];
      
      // Process files in parallel with concurrency limit
      const concurrency = this.config.analysis.parallelism || 5;
      const chunks = this.chunkArray(codeFiles, concurrency);
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
          chunk.map(file => parser.parseFile(file))
        );
        
        for (const result of chunkResults) {
          if (result.status === 'fulfilled') {
            parsedFiles.push(result.value);
          } else {
            console.warn(chalk.yellow(`⚠️ Failed to parse file: ${result.reason}`));
          }
        }
      }
      
      parseSpinner.succeed(`Parsed ${parsedFiles.length} files`);
      return parsedFiles;
      
    } catch (error) {
      spinner.fail('Code collection failed');
      throw error;
    }
  }

  private async analyzeDependencies(codeFiles: CodeFile[]) {
    const spinner = ora('Building dependency graph...').start();
    
    try {
      const builder = new DependencyGraphBuilder(this.config.projectPath);
      const dependencyGraph = await builder.buildGraph(codeFiles);
      
      const metrics = await builder.getGraphMetrics();
      spinner.succeed(`Built dependency graph: ${metrics.totalNodes} nodes, ${metrics.totalEdges} edges`);
      
      if (metrics.cyclicDependencies > 0) {
        console.warn(chalk.yellow(`⚠️ Found ${metrics.cyclicDependencies} circular dependencies`));
      }
      
      return dependencyGraph;
      
    } catch (error) {
      spinner.fail('Dependency analysis failed');
      throw error;
    }
  }

  private async generateEmbeddings(codeFiles: CodeFile[]): Promise<void> {
    const spinner = ora('Generating semantic embeddings...').start();
    
    try {
      let totalEmbeddings = 0;
      
      // Process files in batches to manage memory
      const batchSize = 10;
      const batches = this.chunkArray(codeFiles, batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        spinner.text = `Processing batch ${i + 1}/${batches.length}...`;
        
        const batchEmbeddings = [];
        
        for (const file of batch) {
          const embeddings = await this.semanticEmbedder.embedCodeFile(file);
          batchEmbeddings.push(...embeddings);
        }
        
        // Store embeddings in vector database
        if (batchEmbeddings.length > 0) {
          await this.vectorStore.storeEmbeddings(batchEmbeddings);
          totalEmbeddings += batchEmbeddings.length;
        }
      }
      
      spinner.succeed(`Generated and stored ${totalEmbeddings} embeddings`);
      
    } catch (error) {
      spinner.fail('Embedding generation failed');
      throw error;
    }
  }

  private async buildThreatGraph(codeFiles: CodeFile[], dependencyGraph: any): Promise<ThreatGraph> {
    const spinner = ora('Building threat graph...').start();
    
    try {
      const builder = new ThreatGraphBuilder(this.vectorStore);
      const threatGraph = await builder.buildThreatGraph(codeFiles, dependencyGraph);
      
      spinner.succeed(`Built threat graph: ${threatGraph.nodes.length} nodes, ${threatGraph.edges.length} edges`);
      
      if (threatGraph.criticalPaths.length > 0) {
        console.log(chalk.yellow(`🚨 Identified ${threatGraph.criticalPaths.length} critical attack paths`));
      }
      
      if (threatGraph.vulnerabilities.length > 0) {
        const critical = threatGraph.vulnerabilities.filter(v => v.severity === 'critical').length;
        const high = threatGraph.vulnerabilities.filter(v => v.severity === 'high').length;
        console.log(chalk.red(`🔴 Found ${critical} critical and ${high} high severity vulnerabilities`));
      }
      
      return threatGraph;
      
    } catch (error) {
      spinner.fail('Threat graph construction failed');
      throw error;
    }
  }

  private async runSecurityAgents(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<Agent[]> {
    const enabledAgents = this.config.agents.filter(a => a.enabled);
    console.log(`🤖 Running ${enabledAgents.length} security agents in parallel...`);
    
    const agentPromises = enabledAgents.map(async (agentConfig) => {
      const agent = this.agents.get(agentConfig.type);
      if (!agent) {
        console.warn(chalk.yellow(`⚠️ Agent not found: ${agentConfig.type}`));
        return null;
      }
      
      const spinner = ora(`Running ${agent.name}...`).start();
      
      try {
        const startTime = Date.now();
        await agent.execute(codeFiles, threatGraph);
        const executionTime = Date.now() - startTime;
        
        spinner.succeed(`${agent.name} completed: ${agent.findings.length} findings (${executionTime}ms)`);
        
        // Log critical findings
        const criticalFindings = agent.findings.filter(f => f.severity === 'critical');
        if (criticalFindings.length > 0) {
          console.log(chalk.red(`  🚨 ${criticalFindings.length} critical findings`));
        }
        
        return agent;
        
      } catch (error) {
        spinner.fail(`${agent.name} failed: ${error.message}`);
        console.error(error);
        return agent; // Return agent even if failed, to capture partial results
      }
    });
    
    const results = await Promise.allSettled(agentPromises);
    const successfulAgents = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<Agent>).value);
    
    console.log(chalk.green(`✅ Completed ${successfulAgents.length}/${enabledAgents.length} agents`));
    
    return successfulAgents;
  }

  private async performRiskAssessment(result: AnalysisResult): Promise<void> {
    const spinner = ora('Performing risk assessment...').start();
    
    try {
      // Calculate summary statistics
      result.summary = this.calculateSummary(result);
      
      // Calculate overall risk score
      result.overallRiskScore = this.calculateOverallRiskScore(result);
      
      // Generate recommendations
      result.recommendations = this.generateRecommendations(result);
      
      spinner.succeed(`Risk assessment completed: Overall risk score ${result.overallRiskScore.toFixed(1)}/10`);
      
    } catch (error) {
      spinner.fail('Risk assessment failed');
      throw error;
    }
  }

  private calculateSummary(result: AnalysisResult): AnalysisSummary {
    const allFindings = result.agentResults.flatMap(agent => agent.findings);
    
    return {
      totalFiles: this.getTotalFilesAnalyzed(),
      totalFunctions: this.getTotalFunctions(),
      totalEndpoints: this.getTotalEndpoints(result.threatGraph),
      criticalVulnerabilities: allFindings.filter(f => f.severity === 'critical').length,
      highRiskVulnerabilities: allFindings.filter(f => f.severity === 'high').length,
      mediumRiskVulnerabilities: allFindings.filter(f => f.severity === 'medium').length,
      lowRiskVulnerabilities: allFindings.filter(f => f.severity === 'low').length,
      businessCriticalRisks: allFindings.filter(f => f.businessImpact.financial >= 8).length,
      complianceViolations: allFindings.filter(f => f.type === 'compliance_violation').length,
      performanceIssues: allFindings.filter(f => f.type === 'performance_issue').length,
      architecturalWeaknesses: allFindings.filter(f => f.type === 'weakness').length
    };
  }

  private calculateOverallRiskScore(result: AnalysisResult): number {
    let riskScore = 0;
    let totalWeight = 0;
    
    // Threat graph contributes 40% to overall risk
    riskScore += result.threatGraph.riskScore * 0.4;
    totalWeight += 0.4;
    
    // Agent findings contribute 60% to overall risk
    const allFindings = result.agentResults.flatMap(agent => agent.findings);
    if (allFindings.length > 0) {
      const severityWeights = {
        'critical': 10,
        'high': 7,
        'medium': 4,
        'low': 1,
        'info': 0.5
      };
      
      const findingsRisk = allFindings.reduce((sum, finding) => {
        return sum + (severityWeights[finding.severity] || 1);
      }, 0) / allFindings.length;
      
      riskScore += findingsRisk * 0.6;
      totalWeight += 0.6;
    }
    
    return totalWeight > 0 ? Math.min(10, riskScore / totalWeight) : 0;
  }

  private generateRecommendations(result: AnalysisResult): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const allFindings = result.agentResults.flatMap(agent => agent.findings);
    
    // Group findings by type and severity
    const criticalFindings = allFindings.filter(f => f.severity === 'critical');
    const highFindings = allFindings.filter(f => f.severity === 'high');
    
    // Critical security recommendations
    if (criticalFindings.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: Priority.CRITICAL,
        category: RecommendationCategory.SECURITY,
        title: 'Address Critical Security Vulnerabilities',
        description: `${criticalFindings.length} critical security vulnerabilities require immediate attention`,
        implementation: 'Review and fix all critical findings before production deployment',
        estimatedEffort: '1-2 weeks',
        businessValue: 'Prevents potential security breaches and data loss',
        relatedFindings: criticalFindings.map(f => f.id)
      });
    }
    
    // Multi-tenant isolation recommendations
    const tenantIsolationFindings = allFindings.filter(f => 
      f.title.toLowerCase().includes('tenant') || 
      f.title.toLowerCase().includes('isolation')
    );
    
    if (tenantIsolationFindings.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: Priority.CRITICAL,
        category: RecommendationCategory.SECURITY,
        title: 'Implement Proper Multi-Tenant Isolation',
        description: 'Database queries missing tenant isolation can lead to data leakage',
        implementation: 'Add tenant_id filters to all database queries and implement RLS policies',
        estimatedEffort: '2-3 weeks',
        businessValue: 'Ensures customer data privacy and regulatory compliance',
        relatedFindings: tenantIsolationFindings.map(f => f.id)
      });
    }
    
    // Authentication and authorization recommendations
    const authFindings = allFindings.filter(f => 
      f.title.toLowerCase().includes('auth') || 
      f.title.toLowerCase().includes('guard')
    );
    
    if (authFindings.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: Priority.HIGH,
        category: RecommendationCategory.SECURITY,
        title: 'Strengthen Authentication and Authorization',
        description: 'Multiple endpoints lack proper authentication guards',
        implementation: 'Add authentication guards to all protected endpoints and implement RBAC',
        estimatedEffort: '1-2 weeks',
        businessValue: 'Prevents unauthorized access to sensitive functionality',
        relatedFindings: authFindings.map(f => f.id)
      });
    }
    
    // Business logic recommendations
    const businessLogicFindings = allFindings.filter(f => f.type === 'business_logic_flaw');
    
    if (businessLogicFindings.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: Priority.HIGH,
        category: RecommendationCategory.BUSINESS_LOGIC,
        title: 'Fix Business Logic Vulnerabilities',
        description: 'Business logic flaws can lead to financial loss',
        implementation: 'Implement server-side validation for all business operations',
        estimatedEffort: '2-4 weeks',
        businessValue: 'Prevents financial loss through price manipulation and payment bypass',
        relatedFindings: businessLogicFindings.map(f => f.id)
      });
    }
    
    // Performance recommendations
    if (result.threatGraph.criticalPaths.length > 10) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: Priority.MEDIUM,
        category: RecommendationCategory.PERFORMANCE,
        title: 'Optimize Critical Attack Paths',
        description: 'High number of critical paths indicates complex attack surface',
        implementation: 'Simplify architecture and reduce unnecessary dependencies',
        estimatedEffort: '3-4 weeks',
        businessValue: 'Reduces attack surface and improves system maintainability',
        relatedFindings: []
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async saveResults(result: AnalysisResult): Promise<void> {
    const outputDir = this.config.outputPath;
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save main results
    const resultsPath = path.join(outputDir, `analysis-${this.analysisId}.json`);
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));
    
    // Save threat graph separately for visualization
    const graphPath = path.join(outputDir, `threat-graph-${this.analysisId}.json`);
    await fs.writeFile(graphPath, JSON.stringify(result.threatGraph, null, 2));
    
    // Save executive summary
    const summaryPath = path.join(outputDir, `executive-summary-${this.analysisId}.md`);
    await fs.writeFile(summaryPath, this.generateExecutiveSummary(result));
    
    console.log(chalk.green(`📄 Results saved to: ${outputDir}`));
  }

  private generateExecutiveSummary(result: AnalysisResult): string {
    const duration = result.endTime.getTime() - result.startTime.getTime();
    
    return `# Enterprise-SERTA Security Analysis Report

## Executive Summary

**Project:** ${result.projectPath}
**Analysis ID:** ${result.id}
**Date:** ${result.startTime.toISOString()}
**Duration:** ${duration}ms
**Overall Risk Score:** ${result.overallRiskScore.toFixed(1)}/10

## Key Findings

- **Critical Vulnerabilities:** ${result.summary.criticalVulnerabilities}
- **High Risk Issues:** ${result.summary.highRiskVulnerabilities}
- **Business Critical Risks:** ${result.summary.businessCriticalRisks}
- **Compliance Violations:** ${result.summary.complianceViolations}

## Threat Landscape

- **Attack Surface:** ${result.threatGraph.nodes.length} nodes, ${result.threatGraph.edges.length} edges
- **Critical Attack Paths:** ${result.threatGraph.criticalPaths.length}
- **Identified Vulnerabilities:** ${result.threatGraph.vulnerabilities.length}

## Agent Results

${result.agentResults.map(agent => `
### ${agent.name}
- **Findings:** ${agent.findings.length}
- **Critical:** ${agent.findings.filter(f => f.severity === 'critical').length}
- **Execution Time:** ${agent.metrics.executionTime}ms
`).join('')}

## Top Recommendations

${result.recommendations.slice(0, 5).map((rec, i) => `
${i + 1}. **${rec.title}** (${rec.priority.toUpperCase()})
   - ${rec.description}
   - Estimated Effort: ${rec.estimatedEffort}
`).join('')}

## Next Steps

1. Address all critical vulnerabilities immediately
2. Implement multi-tenant isolation fixes
3. Strengthen authentication and authorization
4. Review and fix business logic flaws
5. Establish continuous security monitoring

---
*Generated by Enterprise-SERTA v1.0*
`;
  }

  private printSummary(result: AnalysisResult): void {
    console.log(chalk.blue('\n📊 Analysis Summary'));
    console.log(chalk.blue('═'.repeat(50)));
    
    console.log(`${chalk.bold('Overall Risk Score:')} ${this.getRiskColor(result.overallRiskScore)}${result.overallRiskScore.toFixed(1)}/10${chalk.reset()}`);
    console.log(`${chalk.bold('Files Analyzed:')} ${result.summary.totalFiles}`);
    console.log(`${chalk.bold('Functions:')} ${result.summary.totalFunctions}`);
    console.log(`${chalk.bold('Endpoints:')} ${result.summary.totalEndpoints}`);
    
    console.log(chalk.blue('\n🚨 Vulnerabilities'));
    console.log(`${chalk.red('Critical:')} ${result.summary.criticalVulnerabilities}`);
    console.log(`${chalk.yellow('High:')} ${result.summary.highRiskVulnerabilities}`);
    console.log(`${chalk.blue('Medium:')} ${result.summary.mediumRiskVulnerabilities}`);
    console.log(`${chalk.gray('Low:')} ${result.summary.lowRiskVulnerabilities}`);
    
    console.log(chalk.blue('\n🎯 Top Recommendations'));
    result.recommendations.slice(0, 3).forEach((rec, i) => {
      const priorityColor = rec.priority === 'critical' ? chalk.red : 
                           rec.priority === 'high' ? chalk.yellow : chalk.blue;
      console.log(`${i + 1}. ${priorityColor(rec.title)} (${rec.priority.toUpperCase()})`);
    });
    
    console.log(chalk.blue('\n' + '═'.repeat(50)));
  }

  private getRiskColor(score: number): string {
    if (score >= 8) return chalk.red.bold;
    if (score >= 6) return chalk.yellow.bold;
    if (score >= 4) return chalk.blue.bold;
    return chalk.green.bold;
  }

  private initializeAgents(): void {
    // Initialize Security Red-Team Agent
    this.agents.set(AgentType.SECURITY_REDTEAM, new SecurityRedTeamAgent(this.vectorStore));
    
    // Additional agents would be initialized here
    // this.agents.set(AgentType.ARCHITECTURE_DESTROYER, new ArchitectureDestroyerAgent(this.vectorStore));
    // this.agents.set(AgentType.DATABASE_BREACHER, new DatabaseBreacherAgent(this.vectorStore));
    // etc.
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getExecutionTime(startTime: Date): number {
    return Date.now() - startTime.getTime();
  }

  private createEmptySummary(): AnalysisSummary {
    return {
      totalFiles: 0,
      totalFunctions: 0,
      totalEndpoints: 0,
      criticalVulnerabilities: 0,
      highRiskVulnerabilities: 0,
      mediumRiskVulnerabilities: 0,
      lowRiskVulnerabilities: 0,
      businessCriticalRisks: 0,
      complianceViolations: 0,
      performanceIssues: 0,
      architecturalWeaknesses: 0
    };
  }

  private getTotalFilesAnalyzed(): number {
    // This would be tracked during analysis
    return 0; // Placeholder
  }

  private getTotalFunctions(): number {
    // This would be tracked during analysis
    return 0; // Placeholder
  }

  private getTotalEndpoints(threatGraph: ThreatGraph): number {
    return threatGraph.nodes.filter(n => n.type === 'endpoint').length;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up resources...');
    
    try {
      await this.semanticEmbedder.dispose();
      await this.vectorStore.cleanup();
      await this.vectorStore.close();
      
      console.log(chalk.green('✅ Cleanup completed'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Cleanup warning:'), error);
    }
  }
}
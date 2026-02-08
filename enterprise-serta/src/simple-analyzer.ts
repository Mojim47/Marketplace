#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
// Simple Enterprise-SERTA Analyzer - Standalone Executable Version
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

interface SecurityFinding {
  file: string;
  line: number;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

interface AnalysisResult {
  projectPath: string;
  totalFiles: number;
  findings: SecurityFinding[];
  riskScore: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

class SimpleSecurityAnalyzer {
  private findings: SecurityFinding[] = [];

  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    console.log(chalk.blue('🔍 Starting NextGen Marketplace Security Analysis...'));
    console.log(chalk.gray(`Project: ${projectPath}`));

    // Find all TypeScript/JavaScript files
    const files = await this.findFiles(projectPath);
    console.log(chalk.green(`📁 Found ${files.length} files to analyze`));

    // Analyze each file
    for (const file of files) {
      await this.analyzeFile(file);
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore();

    const result: AnalysisResult = {
      projectPath,
      totalFiles: files.length,
      findings: this.findings,
      riskScore,
      summary: {
        critical: this.findings.filter(f => f.severity === 'critical').length,
        high: this.findings.filter(f => f.severity === 'high').length,
        medium: this.findings.filter(f => f.severity === 'medium').length,
        low: this.findings.filter(f => f.severity === 'low').length,
      }
    };

    this.printResults(result);
    return result;
  }

  private async findFiles(projectPath: string): Promise<string[]> {
    const patterns = [
      '**/*.{ts,tsx,js,jsx}',
      '**/*.prisma',
      '**/*.yaml',
      '**/*.yml',
      '**/Dockerfile*',
      '**/.env*'
    ];

    const excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.turbo/**'
    ];

    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectPath,
        ignore: excludePatterns,
        absolute: true
      });
      allFiles.push(...files);
    }

    return [...new Set(allFiles)];
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(process.cwd(), filePath);

      // Security pattern detection
      this.detectSecurityPatterns(relativePath, lines);
      
      // NextGen Marketplace specific patterns
      this.detectNextGenPatterns(relativePath, lines);
      
    } catch (error: any) {
      console.warn(chalk.yellow(`⚠️ Could not analyze ${filePath}: ${error.message}`));
    }
  }

  private detectSecurityPatterns(filePath: string, lines: string[]): void {
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Hardcoded secrets
      if (this.isHardcodedSecret(trimmedLine)) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'hardcoded_secret',
          severity: 'critical',
          description: 'Hardcoded secret or credential detected',
          recommendation: 'Move secrets to environment variables or secure vault'
        });
      }

      // SQL Injection patterns
      if (this.isSQLInjectionRisk(trimmedLine)) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'sql_injection',
          severity: 'high',
          description: 'Potential SQL injection vulnerability',
          recommendation: 'Use parameterized queries or ORM methods'
        });
      }

      // Missing authentication guards
      if (this.isMissingAuthGuard(trimmedLine, lines, index)) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'missing_auth',
          severity: 'high',
          description: 'Endpoint missing authentication guard',
          recommendation: 'Add @UseGuards(JwtAuthGuard) decorator'
        });
      }

      // Tenant isolation bypass
      if (this.isTenantIsolationBypass(trimmedLine)) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'tenant_isolation_bypass',
          severity: 'critical',
          description: 'Database query missing tenant isolation',
          recommendation: 'Add tenant_id filter to all queries'
        });
      }

      // Weak JWT implementation
      if (this.isWeakJWT(trimmedLine)) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'weak_jwt',
          severity: 'high',
          description: 'Weak JWT implementation detected',
          recommendation: 'Use strong JWT secrets and proper expiration'
        });
      }
    });
  }

  private detectNextGenPatterns(filePath: string, lines: string[]): void {
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // ZarinPal security issues
      if (trimmedLine.includes('zarinpal') && trimmedLine.includes('sandbox')) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'payment_sandbox',
          severity: 'medium',
          description: 'ZarinPal sandbox mode detected',
          recommendation: 'Ensure production uses live ZarinPal gateway'
        });
      }

      // Moodian compliance issues
      if (trimmedLine.includes('moodian') && trimmedLine.includes('TODO')) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'compliance_incomplete',
          severity: 'high',
          description: 'Incomplete Moodian tax compliance implementation',
          recommendation: 'Complete Moodian integration for Iranian tax compliance'
        });
      }

      // Price manipulation risks
      if (this.isPriceManipulationRisk(trimmedLine)) {
        this.addFinding({
          file: filePath,
          line: lineNumber,
          type: 'price_manipulation',
          severity: 'critical',
          description: 'Price taken from client input without validation',
          recommendation: 'Validate prices server-side against product catalog'
        });
      }

      // B2B tier validation
      if (trimmedLine.includes('tier') && (trimmedLine.includes('Gold') || trimmedLine.includes('Silver'))) {
        if (!trimmedLine.includes('validate') && !trimmedLine.includes('check')) {
          this.addFinding({
            file: filePath,
            line: lineNumber,
            type: 'b2b_tier_bypass',
            severity: 'high',
            description: 'B2B tier assignment without proper validation',
            recommendation: 'Implement proper tier validation and authorization'
          });
        }
      }
    });
  }

  private isHardcodedSecret(line: string): boolean {
    const patterns = [
      /password\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
      /secret\s*[:=]\s*['"`][^'"`]{16,}['"`]/i,
      /api[_-]?key\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
      /token\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
      /[a-f0-9]{32,}/i,
      /[A-Za-z0-9+/]{40,}={0,2}/,
      /sk_[a-zA-Z0-9]{20,}/,
    ];

    return patterns.some(pattern => pattern.test(line));
  }

  private isSQLInjectionRisk(line: string): boolean {
    if (!line.includes('SELECT') && !line.includes('INSERT') && !line.includes('UPDATE') && !line.includes('DELETE')) {
      return false;
    }

    return line.includes('${') || line.includes('`') || line.includes('+');
  }

  private isMissingAuthGuard(line: string, lines: string[], index: number): boolean {
    const httpMethods = ['@Get', '@Post', '@Put', '@Delete', '@Patch'];
    
    if (!httpMethods.some(method => line.includes(method))) {
      return false;
    }

    // Check previous lines for guards
    const contextLines = lines.slice(Math.max(0, index - 5), index);
    const hasGuard = contextLines.some(l => 
      l.includes('@UseGuards') || l.includes('@Auth') || l.includes('@Public')
    );

    return !hasGuard;
  }

  private isTenantIsolationBypass(line: string): boolean {
    const queryMethods = ['findMany', 'findFirst', 'findUnique', 'update', 'delete'];
    
    if (!queryMethods.some(method => line.includes(method))) {
      return false;
    }

    return !line.includes('tenant_id') && !line.includes('tenantId');
  }

  private isWeakJWT(line: string): boolean {
    if (!line.includes('jwt') && !line.includes('JWT')) {
      return false;
    }

    return line.includes('123') || line.includes('test') || line.includes('dev') || line.includes('secret');
  }

  private isPriceManipulationRisk(line: string): boolean {
    if (!line.includes('price') && !line.includes('amount') && !line.includes('total')) {
      return false;
    }

    return (line.includes('req.body') || line.includes('dto.')) && 
           !line.includes('validate') && !line.includes('product.price');
  }

  private addFinding(finding: SecurityFinding): void {
    this.findings.push(finding);
  }

  private calculateRiskScore(): number {
    const weights = {
      critical: 10,
      high: 7,
      medium: 4,
      low: 1
    };

    const totalScore = this.findings.reduce((sum, finding) => {
      return sum + weights[finding.severity];
    }, 0);

    return Math.min(10, totalScore / Math.max(1, this.findings.length));
  }

  private printResults(result: AnalysisResult): void {
    console.log(chalk.blue('\n📊 Analysis Results'));
    console.log(chalk.blue('═'.repeat(50)));
    
    console.log(`${chalk.bold('Project:')} ${result.projectPath}`);
    console.log(`${chalk.bold('Files Analyzed:')} ${result.totalFiles}`);
    console.log(`${chalk.bold('Risk Score:')} ${this.getRiskColor(result.riskScore)}${result.riskScore.toFixed(1)}/10${chalk.reset()}`);
    
    console.log(chalk.blue('\n🚨 Security Findings'));
    console.log(`${chalk.red('Critical:')} ${result.summary.critical}`);
    console.log(`${chalk.yellow('High:')} ${result.summary.high}`);
    console.log(`${chalk.blue('Medium:')} ${result.summary.medium}`);
    console.log(`${chalk.gray('Low:')} ${result.summary.low}`);

    if (result.findings.length > 0) {
      console.log(chalk.blue('\n🔍 Top Findings:'));
      
      const topFindings = result.findings
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .slice(0, 10);

      topFindings.forEach((finding, i) => {
        const severityColor = this.getSeverityColor(finding.severity);
        console.log(`${i + 1}. ${severityColor(finding.type.toUpperCase())} in ${finding.file}:${finding.line}`);
        console.log(`   ${chalk.gray(finding.description)}`);
      });
    }

    console.log(chalk.blue('\n' + '═'.repeat(50)));
    
    if (result.summary.critical > 0) {
      console.log(chalk.red('⚠️ CRITICAL ISSUES FOUND - Address immediately!'));
    } else if (result.summary.high > 0) {
      console.log(chalk.yellow('⚠️ HIGH RISK ISSUES FOUND - Review before production'));
    } else {
      console.log(chalk.green('✅ No critical security issues found'));
    }
  }

  private getRiskColor(score: number): any {
    if (score >= 8) return chalk.red.bold;
    if (score >= 6) return chalk.yellow.bold;
    if (score >= 4) return chalk.blue.bold;
    return chalk.green.bold;
  }

  private getSeverityColor(severity: string): any {
    switch (severity) {
      case 'critical': return chalk.red.bold;
      case 'high': return chalk.yellow.bold;
      case 'medium': return chalk.blue.bold;
      case 'low': return chalk.gray.bold;
      default: return chalk.white;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const projectPath = args[0] || '../';

  console.log(chalk.cyan('🧠 Enterprise-SERTA Simple Security Analyzer'));
  console.log(chalk.cyan('═'.repeat(60)));

  try {
    const analyzer = new SimpleSecurityAnalyzer();
    const result = await analyzer.analyzeProject(path.resolve(projectPath));
    
    // Save results
    const outputPath = path.join(process.cwd(), 'serta-results');
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    const resultFile = path.join(outputPath, `analysis-${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    
    console.log(chalk.green(`\n📄 Results saved to: ${resultFile}`));
    
    // Exit with appropriate code
    if (result.summary.critical > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Analysis failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SimpleSecurityAnalyzer };
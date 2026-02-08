// ═══════════════════════════════════════════════════════════════════════════
// AST Parser - Abstract Syntax Tree Analysis for Deep Code Understanding
// ═══════════════════════════════════════════════════════════════════════════

import { parse as babelParse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { parse as acornParse } from 'acorn';
import { simple as acornWalk } from 'acorn-walk';
import { CodeFile, FunctionInfo, ClassInfo, VariableInfo, SecurityPattern, SecurityPatternType, SecuritySeverity } from '../types';

export class ASTParser {
  async parseFile(codeFile: CodeFile): Promise<CodeFile> {
    console.log(`🔍 Parsing AST for: ${codeFile.path}`);

    try {
      switch (codeFile.language) {
        case 'typescript':
        case 'javascript':
          return await this.parseTypeScript(codeFile);
        case 'python':
          return await this.parsePython(codeFile);
        default:
          console.warn(`⚠️ Unsupported language for AST parsing: ${codeFile.language}`);
          return codeFile;
      }
    } catch (error) {
      console.warn(`⚠️ Error parsing AST for ${codeFile.path}:`, error);
      return codeFile;
    }
  }

  private async parseTypeScript(codeFile: CodeFile): Promise<CodeFile> {
    try {
      const ast = babelParse(codeFile.content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });

      const functions: FunctionInfo[] = [];
      const classes: ClassInfo[] = [];
      const variables: VariableInfo[] = [];
      const imports: string[] = [];
      const exports: string[] = [];
      const securityPatterns: SecurityPattern[] = [];

      traverse(ast, {
        // Import declarations
        ImportDeclaration(path) {
          if (path.node.source.value) {
            imports.push(path.node.source.value);
          }
        },

        // Export declarations
        ExportNamedDeclaration(path) {
          if (path.node.specifiers) {
            path.node.specifiers.forEach(spec => {
              if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
                exports.push(spec.exported.name);
              }
            });
          }
        },

        ExportDefaultDeclaration(path) {
          exports.push('default');
        },

        // Function declarations and expressions
        FunctionDeclaration(path) {
          const func = this.extractFunctionInfo(path.node, path);
          if (func) functions.push(func);
        },

        FunctionExpression(path) {
          const func = this.extractFunctionInfo(path.node, path);
          if (func) functions.push(func);
        },

        ArrowFunctionExpression(path) {
          const func = this.extractFunctionInfo(path.node, path);
          if (func) functions.push(func);
        },

        // Method definitions
        ClassMethod(path) {
          const func = this.extractFunctionInfo(path.node, path);
          if (func) functions.push(func);
        },

        ObjectMethod(path) {
          const func = this.extractFunctionInfo(path.node, path);
          if (func) functions.push(func);
        },

        // Class declarations
        ClassDeclaration(path) {
          const classInfo = this.extractClassInfo(path.node, path);
          if (classInfo) classes.push(classInfo);
        },

        // Variable declarations
        VariableDeclarator(path) {
          const variable = this.extractVariableInfo(path.node, path);
          if (variable) variables.push(variable);
        },

        // Security pattern detection
        CallExpression(path) {
          const patterns = this.detectSecurityPatterns(path.node, path);
          securityPatterns.push(...patterns);
        },

        MemberExpression(path) {
          const patterns = this.detectMemberExpressionPatterns(path.node, path);
          securityPatterns.push(...patterns);
        },

        StringLiteral(path) {
          const patterns = this.detectStringLiteralPatterns(path.node, path);
          securityPatterns.push(...patterns);
        },

        TemplateLiteral(path) {
          const patterns = this.detectTemplateLiteralPatterns(path.node, path);
          securityPatterns.push(...patterns);
        }
      });

      return {
        ...codeFile,
        functions,
        classes,
        variables,
        imports,
        exports,
        securityPatterns
      };
    } catch (error) {
      console.warn(`⚠️ Babel parsing failed for ${codeFile.path}, trying Acorn:`, error);
      return this.parseWithAcorn(codeFile);
    }
  }

  private parseWithAcorn(codeFile: CodeFile): CodeFile {
    try {
      const ast = acornParse(codeFile.content, {
        ecmaVersion: 2022,
        sourceType: 'module',
        allowHashBang: true,
        allowReturnOutsideFunction: true
      });

      const functions: FunctionInfo[] = [];
      const variables: VariableInfo[] = [];
      const securityPatterns: SecurityPattern[] = [];

      acornWalk(ast, {
        FunctionDeclaration(node: any) {
          functions.push({
            name: node.id?.name || 'anonymous',
            startLine: node.loc?.start.line || 0,
            endLine: node.loc?.end.line || 0,
            parameters: node.params.map((param: any) => ({
              name: param.name || 'unknown',
              type: undefined,
              optional: false
            })),
            isAsync: node.async || false,
            isExported: false,
            complexity: 1,
            securityRisk: {
              level: SecuritySeverity.LOW,
              patterns: [],
              trustBoundary: false,
              dataFlow: {
                inputSources: [],
                outputSinks: [],
                sanitization: false,
                validation: false,
                encryption: false
              }
            }
          });
        },

        VariableDeclaration(node: any) {
          node.declarations.forEach((decl: any) => {
            if (decl.id?.name) {
              variables.push({
                name: decl.id.name,
                type: undefined,
                isConst: node.kind === 'const',
                isExported: false,
                line: node.loc?.start.line || 0,
                securitySensitive: false
              });
            }
          });
        }
      });

      return {
        ...codeFile,
        functions,
        variables,
        securityPatterns
      };
    } catch (error) {
      console.warn(`⚠️ Acorn parsing also failed for ${codeFile.path}:`, error);
      return codeFile;
    }
  }

  private extractFunctionInfo(node: any, path: any): FunctionInfo | null {
    const name = this.getFunctionName(node);
    const location = path.node.loc;

    if (!name || !location) return null;

    const parameters = node.params?.map((param: any) => ({
      name: this.getParameterName(param),
      type: this.getParameterType(param),
      optional: param.optional || false,
      defaultValue: param.default ? 'has_default' : undefined
    })) || [];

    const complexity = this.calculateComplexity(node);
    const securityRisk = this.analyzeSecurityRisk(node, path);

    return {
      name,
      startLine: location.start.line,
      endLine: location.end.line,
      parameters,
      returnType: this.getReturnType(node),
      isAsync: node.async || false,
      isExported: this.isExported(path),
      complexity,
      securityRisk
    };
  }

  private extractClassInfo(node: any, path: any): ClassInfo | null {
    const name = node.id?.name;
    const location = path.node.loc;

    if (!name || !location) return null;

    return {
      name,
      startLine: location.start.line,
      endLine: location.end.line,
      methods: [],
      properties: [],
      extends: node.superClass?.name,
      implements: node.implements?.map((impl: any) => impl.id?.name).filter(Boolean) || [],
      isExported: this.isExported(path)
    };
  }

  private extractVariableInfo(node: any, path: any): VariableInfo | null {
    const name = node.id?.name;
    const location = path.node.loc;

    if (!name || !location) return null;

    const parent = path.parent;
    const isConst = parent?.kind === 'const';
    const securitySensitive = this.isSecuritySensitive(name, node.init);

    return {
      name,
      type: this.getVariableType(node),
      isConst,
      isExported: this.isExported(path),
      line: location.start.line,
      securitySensitive
    };
  }

  private detectSecurityPatterns(node: any, path: any): SecurityPattern[] {
    const patterns: SecurityPattern[] = [];
    const location = path.node.loc;

    if (!location) return patterns;

    // SQL Injection patterns
    if (this.isSQLInjectionRisk(node)) {
      patterns.push({
        type: SecurityPatternType.SQL_INJECTION,
        severity: SecuritySeverity.HIGH,
        line: location.start.line,
        description: 'Potential SQL injection vulnerability detected',
        recommendation: 'Use parameterized queries or ORM methods',
        cweId: 'CWE-89'
      });
    }

    // Authentication bypass patterns
    if (this.isAuthBypassRisk(node)) {
      patterns.push({
        type: SecurityPatternType.AUTH_BYPASS,
        severity: SecuritySeverity.CRITICAL,
        line: location.start.line,
        description: 'Potential authentication bypass detected',
        recommendation: 'Implement proper authentication checks',
        cweId: 'CWE-287'
      });
    }

    // Missing authentication patterns
    if (this.isMissingAuthRisk(node)) {
      patterns.push({
        type: SecurityPatternType.MISSING_AUTH,
        severity: SecuritySeverity.HIGH,
        line: location.start.line,
        description: 'Endpoint missing authentication guard',
        recommendation: 'Add @UseGuards(JwtAuthGuard) decorator',
        cweId: 'CWE-306'
      });
    }

    // Tenant isolation bypass
    if (this.isTenantIsolationBypass(node)) {
      patterns.push({
        type: SecurityPatternType.TENANT_ISOLATION_BYPASS,
        severity: SecuritySeverity.CRITICAL,
        line: location.start.line,
        description: 'Query missing tenant isolation',
        recommendation: 'Add tenant_id filter to all queries',
        cweId: 'CWE-639'
      });
    }

    return patterns;
  }

  private detectMemberExpressionPatterns(node: any, path: any): SecurityPattern[] {
    const patterns: SecurityPattern[] = [];
    const location = path.node.loc;

    if (!location) return patterns;

    // Detect dangerous method calls
    if (node.property?.name === 'eval' || 
        (node.object?.name === 'JSON' && node.property?.name === 'parse')) {
      patterns.push({
        type: SecurityPatternType.UNSAFE_DESERIALIZATION,
        severity: SecuritySeverity.HIGH,
        line: location.start.line,
        description: 'Unsafe deserialization or code execution',
        recommendation: 'Validate input before parsing or avoid eval()',
        cweId: 'CWE-502'
      });
    }

    return patterns;
  }

  private detectStringLiteralPatterns(node: any, path: any): SecurityPattern[] {
    const patterns: SecurityPattern[] = [];
    const location = path.node.loc;
    const value = node.value;

    if (!location || typeof value !== 'string') return patterns;

    // Detect hardcoded secrets
    if (this.isHardcodedSecret(value)) {
      patterns.push({
        type: SecurityPatternType.HARDCODED_SECRET,
        severity: SecuritySeverity.HIGH,
        line: location.start.line,
        description: 'Hardcoded secret or credential detected',
        recommendation: 'Move secrets to environment variables or secure vault',
        cweId: 'CWE-798'
      });
    }

    return patterns;
  }

  private detectTemplateLiteralPatterns(node: any, path: any): SecurityPattern[] {
    const patterns: SecurityPattern[] = [];
    const location = path.node.loc;

    if (!location) return patterns;

    // Check for SQL-like template literals
    const hasSQL = node.quasis?.some((quasi: any) => 
      /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(quasi.value?.raw || '')
    );

    if (hasSQL && node.expressions?.length > 0) {
      patterns.push({
        type: SecurityPatternType.SQL_INJECTION,
        severity: SecuritySeverity.HIGH,
        line: location.start.line,
        description: 'Template literal with SQL and dynamic content',
        recommendation: 'Use parameterized queries instead of string interpolation',
        cweId: 'CWE-89'
      });
    }

    return patterns;
  }

  // Helper methods for security pattern detection
  private isSQLInjectionRisk(node: any): boolean {
    if (node.callee?.property?.name === 'query' || 
        node.callee?.property?.name === 'raw') {
      return node.arguments?.some((arg: any) => 
        arg.type === 'TemplateLiteral' || 
        arg.type === 'BinaryExpression'
      );
    }
    return false;
  }

  private isAuthBypassRisk(node: any): boolean {
    // Look for patterns like: if (user.role === 'admin' || true)
    return node.callee?.name === 'bypass' || 
           (node.arguments?.some((arg: any) => 
             arg.type === 'BooleanLiteral' && arg.value === true
           ));
  }

  private isMissingAuthRisk(node: any): boolean {
    // Check for controller methods without guards
    return node.callee?.name === 'Post' || 
           node.callee?.name === 'Get' || 
           node.callee?.name === 'Put' || 
           node.callee?.name === 'Delete';
  }

  private isTenantIsolationBypass(node: any): boolean {
    // Check for Prisma queries without tenant_id
    if (node.callee?.property?.name === 'findMany' || 
        node.callee?.property?.name === 'findFirst' ||
        node.callee?.property?.name === 'findUnique') {
      const whereArg = node.arguments?.[0]?.properties?.find((prop: any) => 
        prop.key?.name === 'where'
      );
      
      if (whereArg) {
        const hasTenantId = whereArg.value?.properties?.some((prop: any) => 
          prop.key?.name === 'tenant_id'
        );
        return !hasTenantId;
      }
      return true; // No where clause at all
    }
    return false;
  }

  private isHardcodedSecret(value: string): boolean {
    const secretPatterns = [
      /password\s*[:=]\s*['"]/i,
      /secret\s*[:=]\s*['"]/i,
      /api[_-]?key\s*[:=]\s*['"]/i,
      /token\s*[:=]\s*['"]/i,
      /[a-f0-9]{32,}/i, // Hex strings (potential hashes/keys)
      /[A-Za-z0-9+/]{20,}={0,2}/, // Base64 strings
      /sk_[a-zA-Z0-9]{20,}/, // Stripe-like secret keys
      /pk_[a-zA-Z0-9]{20,}/, // Stripe-like public keys
    ];

    return secretPatterns.some(pattern => pattern.test(value));
  }

  // Helper methods for extracting information
  private getFunctionName(node: any): string {
    if (node.id?.name) return node.id.name;
    if (node.key?.name) return node.key.name;
    if (node.key?.value) return node.key.value;
    return 'anonymous';
  }

  private getParameterName(param: any): string {
    if (param.name) return param.name;
    if (param.left?.name) return param.left.name; // Destructuring
    if (param.argument?.name) return param.argument.name; // Rest parameters
    return 'unknown';
  }

  private getParameterType(param: any): string | undefined {
    if (param.typeAnnotation?.typeAnnotation?.type) {
      return param.typeAnnotation.typeAnnotation.type;
    }
    return undefined;
  }

  private getReturnType(node: any): string | undefined {
    if (node.returnType?.typeAnnotation?.type) {
      return node.returnType.typeAnnotation.type;
    }
    return undefined;
  }

  private getVariableType(node: any): string | undefined {
    if (node.id?.typeAnnotation?.typeAnnotation?.type) {
      return node.id.typeAnnotation.typeAnnotation.type;
    }
    return undefined;
  }

  private isExported(path: any): boolean {
    let current = path;
    while (current) {
      if (current.isExportNamedDeclaration() || 
          current.isExportDefaultDeclaration()) {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  private isSecuritySensitive(name: string, init: any): boolean {
    const sensitiveNames = [
      'password', 'secret', 'token', 'key', 'auth', 'credential',
      'private', 'confidential', 'sensitive'
    ];
    
    return sensitiveNames.some(sensitive => 
      name.toLowerCase().includes(sensitive)
    ) || (init && this.containsSensitiveValue(init));
  }

  private containsSensitiveValue(node: any): boolean {
    if (node.type === 'StringLiteral') {
      return this.isHardcodedSecret(node.value);
    }
    return false;
  }

  private calculateComplexity(node: any): number {
    // Simple cyclomatic complexity calculation
    let complexity = 1;
    
    const complexityNodes = [
      'IfStatement', 'ConditionalExpression', 'SwitchCase',
      'WhileStatement', 'DoWhileStatement', 'ForStatement',
      'ForInStatement', 'ForOfStatement', 'CatchClause',
      'LogicalExpression'
    ];

    // This is a simplified version - in a real implementation,
    // you'd traverse the entire function body
    return complexity;
  }

  private analyzeSecurityRisk(node: any, path: any): any {
    // Simplified security risk analysis
    return {
      level: SecuritySeverity.LOW,
      patterns: [],
      trustBoundary: false,
      dataFlow: {
        inputSources: [],
        outputSinks: [],
        sanitization: false,
        validation: false,
        encryption: false
      }
    };
  }

  private async parsePython(codeFile: CodeFile): Promise<CodeFile> {
    // Python AST parsing would be implemented here
    // For now, return the original file
    console.warn('⚠️ Python AST parsing not yet implemented');
    return codeFile;
  }
}
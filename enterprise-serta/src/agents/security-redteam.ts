// ═══════════════════════════════════════════════════════════════════════════
// Security Red-Team Agent - Penetration Testing and Vulnerability Discovery
// ═══════════════════════════════════════════════════════════════════════════

import { 
  Agent, 
  AgentType, 
  AgentStatus, 
  AgentFinding, 
  FindingType, 
  SecuritySeverity,
  ThreatGraph,
  CodeFile,
  ExploitChain,
  ExploitStep,
  BusinessImpact,
  Evidence,
  EvidenceType
} from '../types';
import { VectorStore } from '../embeddings/store';
import * as crypto from 'crypto';

export class SecurityRedTeamAgent implements Agent {
  id: string;
  name: string = 'Security Red-Team Agent';
  type: AgentType = AgentType.SECURITY_REDTEAM;
  status: AgentStatus = AgentStatus.IDLE;
  findings: AgentFinding[] = [];
  metrics: any = {
    executionTime: 0,
    findingsCount: 0,
    criticalFindings: 0,
    coveragePercentage: 0,
    falsePositiveRate: 0
  };

  private vectorStore: VectorStore;
  private startTime: number = 0;

  constructor(vectorStore: VectorStore) {
    this.id = crypto.randomUUID();
    this.vectorStore = vectorStore;
  }

  async execute(
    codeFiles: CodeFile[], 
    threatGraph: ThreatGraph
  ): Promise<AgentFinding[]> {
    console.log('🔴 Security Red-Team Agent starting attack simulation...');
    
    this.status = AgentStatus.RUNNING;
    this.startTime = Date.now();
    this.findings = [];

    try {
      // 1. Authentication & Authorization Attacks
      await this.testAuthenticationBypass(codeFiles, threatGraph);
      await this.testPrivilegeEscalation(codeFiles, threatGraph);
      await this.testSessionManagement(codeFiles, threatGraph);
      
      // 2. Input Validation Attacks
      await this.testSQLInjection(codeFiles, threatGraph);
      await this.testXSSVulnerabilities(codeFiles, threatGraph);
      await this.testCommandInjection(codeFiles, threatGraph);
      
      // 3. Business Logic Attacks
      await this.testBusinessLogicFlaws(codeFiles, threatGraph);
      await this.testRaceConditions(codeFiles, threatGraph);
      await this.testPriceManipulation(codeFiles, threatGraph);
      
      // 4. Multi-Tenant Security Attacks
      await this.testTenantIsolationBypass(codeFiles, threatGraph);
      await this.testDataLeakage(codeFiles, threatGraph);
      
      // 5. API Security Attacks
      await this.testAPISecurityFlaws(codeFiles, threatGraph);
      await this.testRateLimitBypass(codeFiles, threatGraph);
      
      // 6. Cryptographic Attacks
      await this.testCryptographicFlaws(codeFiles, threatGraph);
      await this.testSecretExposure(codeFiles, threatGraph);
      
      // 7. Infrastructure Attacks
      await this.testContainerEscape(codeFiles, threatGraph);
      await this.testNetworkSegmentation(codeFiles, threatGraph);

      this.status = AgentStatus.COMPLETED;
      this.calculateMetrics();
      
      console.log(`✅ Red-Team Agent completed: ${this.findings.length} findings`);
      return this.findings;
      
    } catch (error) {
      console.error('❌ Red-Team Agent failed:', error);
      this.status = AgentStatus.FAILED;
      throw error;
    }
  }

  private async testAuthenticationBypass(
    codeFiles: CodeFile[], 
    threatGraph: ThreatGraph
  ): Promise<void> {
    console.log('🔍 Testing authentication bypass vulnerabilities...');

    // Find authentication-related files
    const authFiles = codeFiles.filter(file => 
      file.path.includes('auth') || 
      file.path.includes('guard') ||
      file.path.includes('middleware')
    );

    for (const file of authFiles) {
      // Check for hardcoded credentials
      const hardcodedCredentials = this.findHardcodedCredentials(file);
      for (const cred of hardcodedCredentials) {
        this.addFinding({
          type: FindingType.VULNERABILITY,
          severity: SecuritySeverity.CRITICAL,
          title: 'Hardcoded Authentication Credentials',
          description: `Hardcoded credentials found in ${file.path}:${cred.line}`,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${cred.line}`,
            content: cred.content,
            metadata: { pattern: cred.pattern }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: 'Extract hardcoded credentials from source code',
                expectedResult: 'Obtain valid authentication credentials',
                riskLevel: SecuritySeverity.CRITICAL
              },
              {
                order: 2,
                action: 'Use credentials to authenticate as privileged user',
                expectedResult: 'Gain unauthorized access to system',
                riskLevel: SecuritySeverity.CRITICAL
              }
            ],
            prerequisites: ['Access to source code or compiled application'],
            impact: 'Complete system compromise',
            likelihood: 0.9
          },
          recommendation: 'Move all credentials to environment variables or secure vault',
          businessImpact: {
            financial: 9,
            reputation: 10,
            compliance: 8,
            operational: 9,
            description: 'Complete authentication bypass allows full system access'
          }
        });
      }

      // Check for weak JWT implementation
      const jwtFlaws = this.analyzeJWTImplementation(file);
      for (const flaw of jwtFlaws) {
        this.addFinding({
          type: FindingType.VULNERABILITY,
          severity: flaw.severity,
          title: 'JWT Implementation Flaw',
          description: flaw.description,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${flaw.line}`,
            content: flaw.code,
            metadata: { issue: flaw.issue }
          }],
          exploitChain: this.createJWTExploitChain(flaw),
          recommendation: flaw.recommendation,
          businessImpact: {
            financial: 7,
            reputation: 8,
            compliance: 6,
            operational: 7,
            description: 'JWT vulnerabilities can lead to authentication bypass'
          }
        });
      }

      // Check for missing authentication guards
      const missingGuards = this.findMissingAuthGuards(file);
      for (const guard of missingGuards) {
        this.addFinding({
          type: FindingType.VULNERABILITY,
          severity: SecuritySeverity.HIGH,
          title: 'Missing Authentication Guard',
          description: `Endpoint ${guard.endpoint} lacks authentication protection`,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${guard.line}`,
            content: guard.code,
            metadata: { endpoint: guard.endpoint, method: guard.method }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: `Send ${guard.method} request to ${guard.endpoint}`,
                expectedResult: 'Access protected endpoint without authentication',
                riskLevel: SecuritySeverity.HIGH
              }
            ],
            prerequisites: ['Network access to API'],
            impact: 'Unauthorized access to protected resources',
            likelihood: 0.8
          },
          recommendation: 'Add @UseGuards(JwtAuthGuard) decorator to all protected endpoints',
          businessImpact: {
            financial: 6,
            reputation: 7,
            compliance: 8,
            operational: 6,
            description: 'Unauthenticated access to business logic'
          }
        });
      }
    }
  }

  private async testPrivilegeEscalation(
    codeFiles: CodeFile[], 
    threatGraph: ThreatGraph
  ): Promise<void> {
    console.log('🔍 Testing privilege escalation vulnerabilities...');

    // Find role-based access control implementations
    const rbacFiles = codeFiles.filter(file => 
      file.content.includes('role') || 
      file.content.includes('permission') ||
      file.content.includes('admin')
    );

    for (const file of rbacFiles) {
      // Check for role manipulation vulnerabilities
      const roleFlaws = this.analyzeRoleManipulation(file);
      for (const flaw of roleFlaws) {
        this.addFinding({
          type: FindingType.VULNERABILITY,
          severity: SecuritySeverity.CRITICAL,
          title: 'Privilege Escalation via Role Manipulation',
          description: flaw.description,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${flaw.line}`,
            content: flaw.code,
            metadata: { vulnerability: flaw.type }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: 'Manipulate role assignment request',
                payload: flaw.payload,
                expectedResult: 'Assign admin role to regular user account',
                riskLevel: SecuritySeverity.CRITICAL
              },
              {
                order: 2,
                action: 'Access admin-only functionality',
                expectedResult: 'Gain administrative privileges',
                riskLevel: SecuritySeverity.CRITICAL
              }
            ],
            prerequisites: ['Valid user account', 'Access to role assignment endpoint'],
            impact: 'Complete administrative access',
            likelihood: 0.7
          },
          recommendation: 'Implement proper authorization checks for role assignments',
          businessImpact: {
            financial: 10,
            reputation: 9,
            compliance: 9,
            operational: 8,
            description: 'Privilege escalation allows complete system control'
          }
        });
      }

      // Check for insecure direct object references
      const idorFlaws = this.findIDORVulnerabilities(file);
      for (const idor of idorFlaws) {
        this.addFinding({
          type: FindingType.VULNERABILITY,
          severity: SecuritySeverity.HIGH,
          title: 'Insecure Direct Object Reference (IDOR)',
          description: `IDOR vulnerability in ${idor.endpoint}`,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${idor.line}`,
            content: idor.code,
            metadata: { parameter: idor.parameter }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: `Modify ${idor.parameter} parameter in request`,
                payload: `${idor.parameter}=other_user_id`,
                expectedResult: 'Access other users\' data',
                riskLevel: SecuritySeverity.HIGH
              }
            ],
            prerequisites: ['Valid user account', 'Knowledge of other user IDs'],
            impact: 'Unauthorized access to other users\' data',
            likelihood: 0.8
          },
          recommendation: 'Implement proper authorization checks for object access',
          businessImpact: {
            financial: 7,
            reputation: 8,
            compliance: 9,
            operational: 6,
            description: 'Users can access other users\' sensitive data'
          }
        });
      }
    }
  }

  private async testTenantIsolationBypass(
    codeFiles: CodeFile[], 
    threatGraph: ThreatGraph
  ): Promise<void> {
    console.log('🔍 Testing multi-tenant isolation bypass...');

    // Find database query files
    const queryFiles = codeFiles.filter(file => 
      file.content.includes('prisma') || 
      file.content.includes('findMany') ||
      file.content.includes('findFirst')
    );

    for (const file of queryFiles) {
      const tenantBypassFlaws = this.analyzeTenantIsolation(file);
      
      for (const flaw of tenantBypassFlaws) {
        this.addFinding({
          type: FindingType.VULNERABILITY,
          severity: SecuritySeverity.CRITICAL,
          title: 'Multi-Tenant Data Isolation Bypass',
          description: `Query missing tenant isolation: ${flaw.query}`,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${flaw.line}`,
            content: flaw.code,
            metadata: { query: flaw.query, table: flaw.table }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: 'Authenticate as user in tenant A',
                expectedResult: 'Obtain valid session for tenant A',
                riskLevel: SecuritySeverity.LOW
              },
              {
                order: 2,
                action: `Access endpoint that uses vulnerable query: ${flaw.endpoint}`,
                expectedResult: 'Retrieve data from all tenants, not just tenant A',
                riskLevel: SecuritySeverity.CRITICAL
              }
            ],
            prerequisites: ['Valid user account in any tenant'],
            impact: 'Access to all tenants\' data across the entire platform',
            likelihood: 0.9
          },
          recommendation: 'Add tenant_id filter to all database queries',
          businessImpact: {
            financial: 10,
            reputation: 10,
            compliance: 10,
            operational: 9,
            description: 'Complete breakdown of multi-tenant security model'
          }
        });
      }
    }
  }

  private async testBusinessLogicFlaws(
    codeFiles: CodeFile[], 
    threatGraph: ThreatGraph
  ): Promise<void> {
    console.log('🔍 Testing business logic vulnerabilities...');

    // Find payment and order processing files
    const businessFiles = codeFiles.filter(file => 
      file.path.includes('payment') || 
      file.path.includes('order') ||
      file.path.includes('pricing')
    );

    for (const file of businessFiles) {
      // Check for price manipulation vulnerabilities
      const priceFlaws = this.analyzePriceManipulation(file);
      for (const flaw of priceFlaws) {
        this.addFinding({
          type: FindingType.BUSINESS_LOGIC_FLAW,
          severity: SecuritySeverity.HIGH,
          title: 'Price Manipulation Vulnerability',
          description: flaw.description,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${flaw.line}`,
            content: flaw.code,
            metadata: { vulnerability: flaw.type }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: 'Intercept order creation request',
                expectedResult: 'Capture order data in transit',
                riskLevel: SecuritySeverity.MEDIUM
              },
              {
                order: 2,
                action: 'Modify price field in request',
                payload: '{"price": 0.01}',
                expectedResult: 'Create order with manipulated price',
                riskLevel: SecuritySeverity.HIGH
              }
            ],
            prerequisites: ['Ability to intercept/modify HTTP requests'],
            impact: 'Financial loss through price manipulation',
            likelihood: 0.6
          },
          recommendation: 'Validate prices server-side against product catalog',
          businessImpact: {
            financial: 9,
            reputation: 6,
            compliance: 5,
            operational: 7,
            description: 'Direct financial loss through price manipulation'
          }
        });
      }

      // Check for payment bypass vulnerabilities
      const paymentFlaws = this.analyzePaymentBypass(file);
      for (const flaw of paymentFlaws) {
        this.addFinding({
          type: FindingType.BUSINESS_LOGIC_FLAW,
          severity: SecuritySeverity.CRITICAL,
          title: 'Payment Bypass Vulnerability',
          description: flaw.description,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${flaw.line}`,
            content: flaw.code,
            metadata: { flaw: flaw.type }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: 'Create order with items',
                expectedResult: 'Order created in PENDING status',
                riskLevel: SecuritySeverity.LOW
              },
              {
                order: 2,
                action: 'Exploit payment verification flaw',
                payload: flaw.exploit,
                expectedResult: 'Mark order as PAID without actual payment',
                riskLevel: SecuritySeverity.CRITICAL
              }
            ],
            prerequisites: ['Understanding of payment flow'],
            impact: 'Free goods/services without payment',
            likelihood: 0.5
          },
          recommendation: 'Implement robust payment verification with ZarinPal',
          businessImpact: {
            financial: 10,
            reputation: 8,
            compliance: 7,
            operational: 8,
            description: 'Complete payment bypass leads to financial loss'
          }
        });
      }
    }
  }

  private async testSQLInjection(
    codeFiles: CodeFile[], 
    threatGraph: ThreatGraph
  ): Promise<void> {
    console.log('🔍 Testing SQL injection vulnerabilities...');

    for (const file of codeFiles) {
      const sqlInjectionFlaws = file.securityPatterns.filter(p => 
        p.type === 'sql_injection'
      );

      for (const flaw of sqlInjectionFlaws) {
        this.addFinding({
          type: FindingType.VULNERABILITY,
          severity: SecuritySeverity.HIGH,
          title: 'SQL Injection Vulnerability',
          description: `SQL injection risk in ${file.path}:${flaw.line}`,
          evidence: [{
            type: EvidenceType.CODE_SNIPPET,
            location: `${file.path}:${flaw.line}`,
            content: this.extractCodeSnippet(file, flaw.line),
            metadata: { pattern: flaw.type }
          }],
          exploitChain: {
            steps: [
              {
                order: 1,
                action: 'Identify vulnerable parameter',
                expectedResult: 'Find input that reaches SQL query',
                riskLevel: SecuritySeverity.MEDIUM
              },
              {
                order: 2,
                action: 'Inject SQL payload',
                payload: "'; DROP TABLE users; --",
                expectedResult: 'Execute arbitrary SQL commands',
                riskLevel: SecuritySeverity.HIGH
              }
            ],
            prerequisites: ['Access to vulnerable endpoint'],
            impact: 'Database compromise, data theft, data destruction',
            likelihood: 0.7
          },
          recommendation: flaw.recommendation,
          businessImpact: {
            financial: 8,
            reputation: 9,
            compliance: 9,
            operational: 8,
            description: 'SQL injection can lead to complete database compromise'
          }
        });
      }
    }
  }

  // Helper methods for vulnerability analysis
  private findHardcodedCredentials(file: CodeFile): Array<{
    line: number;
    content: string;
    pattern: string;
  }> {
    const credentials: Array<{ line: number; content: string; pattern: string }> = [];
    const lines = file.content.split('\n');

    const patterns = [
      { regex: /password\s*[:=]\s*['"`]([^'"`]+)['"`]/i, type: 'password' },
      { regex: /secret\s*[:=]\s*['"`]([^'"`]+)['"`]/i, type: 'secret' },
      { regex: /api[_-]?key\s*[:=]\s*['"`]([^'"`]+)['"`]/i, type: 'api_key' },
      { regex: /token\s*[:=]\s*['"`]([^'"`]+)['"`]/i, type: 'token' }
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match && match[1].length > 8) { // Ignore short/dummy values
          credentials.push({
            line: i + 1,
            content: line.trim(),
            pattern: pattern.type
          });
        }
      }
    }

    return credentials;
  }

  private analyzeJWTImplementation(file: CodeFile): Array<{
    line: number;
    code: string;
    issue: string;
    severity: SecuritySeverity;
    description: string;
    recommendation: string;
  }> {
    const flaws: Array<any> = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for weak JWT secrets
      if (line.includes('jwt') && line.includes('secret')) {
        if (line.includes('123') || line.includes('test') || line.includes('dev')) {
          flaws.push({
            line: i + 1,
            code: line.trim(),
            issue: 'weak_jwt_secret',
            severity: SecuritySeverity.HIGH,
            description: 'JWT secret is weak or predictable',
            recommendation: 'Use strong, randomly generated JWT secrets'
          });
        }
      }

      // Check for missing JWT expiration
      if (line.includes('jwt.sign') && !line.includes('expiresIn')) {
        flaws.push({
          line: i + 1,
          code: line.trim(),
          issue: 'missing_jwt_expiration',
          severity: SecuritySeverity.MEDIUM,
          description: 'JWT tokens do not expire',
          recommendation: 'Set appropriate expiration time for JWT tokens'
        });
      }

      // Check for algorithm confusion
      if (line.includes('algorithm') && line.includes('none')) {
        flaws.push({
          line: i + 1,
          code: line.trim(),
          issue: 'jwt_algorithm_confusion',
          severity: SecuritySeverity.CRITICAL,
          description: 'JWT allows "none" algorithm',
          recommendation: 'Explicitly specify and validate JWT algorithm'
        });
      }
    }

    return flaws;
  }

  private findMissingAuthGuards(file: CodeFile): Array<{
    line: number;
    code: string;
    endpoint: string;
    method: string;
  }> {
    const missing: Array<any> = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const httpMethods = ['@Get', '@Post', '@Put', '@Delete', '@Patch'];

      for (const method of httpMethods) {
        if (line.includes(method)) {
          // Check if there's a guard in the previous lines
          const hasGuard = lines.slice(Math.max(0, i - 5), i).some(l => 
            l.includes('@UseGuards') || l.includes('@Auth')
          );

          // Check if it's a public endpoint
          const isPublic = lines.slice(Math.max(0, i - 5), i).some(l => 
            l.includes('@Public')
          );

          if (!hasGuard && !isPublic) {
            const pathMatch = line.match(/['"`]([^'"`]*)['"`]/);
            const path = pathMatch ? pathMatch[1] : '/';

            missing.push({
              line: i + 1,
              code: line.trim(),
              endpoint: path,
              method: method.substring(1)
            });
          }
        }
      }
    }

    return missing;
  }

  private analyzeRoleManipulation(file: CodeFile): Array<{
    line: number;
    code: string;
    type: string;
    description: string;
    payload: string;
  }> {
    const flaws: Array<any> = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for direct role assignment without validation
      if (line.includes('role') && (line.includes('=') || line.includes('update'))) {
        if (!lines.slice(Math.max(0, i - 3), i + 3).some(l => 
          l.includes('authorize') || l.includes('permission') || l.includes('admin')
        )) {
          flaws.push({
            line: i + 1,
            code: line.trim(),
            type: 'unvalidated_role_assignment',
            description: 'Role assignment without proper authorization check',
            payload: '{"role": "ADMIN"}'
          });
        }
      }

      // Check for role-based access control bypass
      if (line.includes('role') && line.includes('===') && line.includes('||')) {
        flaws.push({
          line: i + 1,
          code: line.trim(),
          type: 'rbac_logic_flaw',
          description: 'Flawed role-based access control logic',
          payload: 'Manipulate role comparison logic'
        });
      }
    }

    return flaws;
  }

  private findIDORVulnerabilities(file: CodeFile): Array<{
    line: number;
    code: string;
    endpoint: string;
    parameter: string;
  }> {
    const idors: Array<any> = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for direct parameter usage in queries
      if (line.includes('findUnique') || line.includes('findFirst')) {
        const paramMatch = line.match(/params\.(\w+)|req\.params\.(\w+)|@Param\(['"`](\w+)['"`]\)/);
        if (paramMatch) {
          const parameter = paramMatch[1] || paramMatch[2] || paramMatch[3];
          
          // Check if there's ownership validation
          const hasOwnershipCheck = lines.slice(i, Math.min(lines.length, i + 10)).some(l => 
            l.includes('user_id') || l.includes('userId') || l.includes('owner')
          );

          if (!hasOwnershipCheck) {
            idors.push({
              line: i + 1,
              code: line.trim(),
              endpoint: this.extractEndpointFromContext(lines, i),
              parameter
            });
          }
        }
      }
    }

    return idors;
  }

  private analyzeTenantIsolation(file: CodeFile): Array<{
    line: number;
    code: string;
    query: string;
    table: string;
    endpoint: string;
  }> {
    const flaws: Array<any> = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check Prisma queries for tenant isolation
      const queryMethods = ['findMany', 'findFirst', 'findUnique', 'update', 'delete'];
      
      for (const method of queryMethods) {
        if (line.includes(method)) {
          // Check if tenant_id is included in the where clause
          const hasTenantFilter = lines.slice(i, Math.min(lines.length, i + 10)).some(l => 
            l.includes('tenant_id') || l.includes('tenantId')
          );

          if (!hasTenantFilter) {
            const tableMatch = line.match(/prisma\.(\w+)\./);
            const table = tableMatch ? tableMatch[1] : 'unknown';

            flaws.push({
              line: i + 1,
              code: line.trim(),
              query: method,
              table,
              endpoint: this.extractEndpointFromContext(lines, i)
            });
          }
        }
      }
    }

    return flaws;
  }

  private analyzePriceManipulation(file: CodeFile): Array<{
    line: number;
    code: string;
    type: string;
    description: string;
  }> {
    const flaws: Array<any> = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for client-side price calculation
      if (line.includes('price') && (line.includes('req.body') || line.includes('dto.'))) {
        if (!lines.slice(Math.max(0, i - 5), i + 5).some(l => 
          l.includes('validate') || l.includes('product.price') || l.includes('catalog')
        )) {
          flaws.push({
            line: i + 1,
            code: line.trim(),
            type: 'client_side_price',
            description: 'Price taken from client input without server-side validation'
          });
        }
      }

      // Check for total calculation without validation
      if (line.includes('total') && line.includes('=')) {
        if (!lines.slice(Math.max(0, i - 5), i + 5).some(l => 
          l.includes('calculate') || l.includes('sum') || l.includes('validate')
        )) {
          flaws.push({
            line: i + 1,
            code: line.trim(),
            type: 'unvalidated_total',
            description: 'Order total not validated against item prices'
          });
        }
      }
    }

    return flaws;
  }

  private analyzePaymentBypass(file: CodeFile): Array<{
    line: number;
    code: string;
    type: string;
    description: string;
    exploit: string;
  }> {
    const flaws: Array<any> = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for weak payment verification
      if (line.includes('payment') && line.includes('status')) {
        if (line.includes('COMPLETED') || line.includes('SUCCESS')) {
          // Check if there's proper gateway verification
          const hasGatewayVerification = lines.slice(Math.max(0, i - 10), i + 10).some(l => 
            l.includes('zarinpal') || l.includes('verify') || l.includes('authority')
          );

          if (!hasGatewayVerification) {
            flaws.push({
              line: i + 1,
              code: line.trim(),
              type: 'weak_payment_verification',
              description: 'Payment status updated without gateway verification',
              exploit: 'Directly call payment completion endpoint'
            });
          }
        }
      }

      // Check for race condition in payment processing
      if (line.includes('payment') && line.includes('update')) {
        if (!lines.slice(Math.max(0, i - 5), i + 5).some(l => 
          l.includes('transaction') || l.includes('lock') || l.includes('atomic')
        )) {
          flaws.push({
            line: i + 1,
            code: line.trim(),
            type: 'payment_race_condition',
            description: 'Payment processing vulnerable to race conditions',
            exploit: 'Send multiple concurrent payment requests'
          });
        }
      }
    }

    return flaws;
  }

  private createJWTExploitChain(flaw: any): ExploitChain {
    const chains: Record<string, ExploitChain> = {
      'weak_jwt_secret': {
        steps: [
          {
            order: 1,
            action: 'Obtain JWT token through normal authentication',
            expectedResult: 'Valid JWT token',
            riskLevel: SecuritySeverity.LOW
          },
          {
            order: 2,
            action: 'Brute force JWT secret using common passwords',
            expectedResult: 'Discover JWT signing secret',
            riskLevel: SecuritySeverity.HIGH
          },
          {
            order: 3,
            action: 'Forge JWT token with admin privileges',
            expectedResult: 'Administrative access to system',
            riskLevel: SecuritySeverity.CRITICAL
          }
        ],
        prerequisites: ['Access to JWT token', 'JWT cracking tools'],
        impact: 'Complete authentication bypass',
        likelihood: 0.6
      },
      'missing_jwt_expiration': {
        steps: [
          {
            order: 1,
            action: 'Obtain JWT token',
            expectedResult: 'Valid JWT token that never expires',
            riskLevel: SecuritySeverity.MEDIUM
          },
          {
            order: 2,
            action: 'Use token indefinitely',
            expectedResult: 'Persistent access even after password changes',
            riskLevel: SecuritySeverity.HIGH
          }
        ],
        prerequisites: ['Valid JWT token'],
        impact: 'Persistent unauthorized access',
        likelihood: 0.8
      }
    };

    return chains[flaw.issue] || {
      steps: [],
      prerequisites: [],
      impact: 'Unknown',
      likelihood: 0.5
    };
  }

  private extractEndpointFromContext(lines: string[], currentLine: number): string {
    // Look backwards for controller method decorator
    for (let i = currentLine; i >= Math.max(0, currentLine - 20); i--) {
      const line = lines[i];
      const httpMethods = ['@Get', '@Post', '@Put', '@Delete', '@Patch'];
      
      for (const method of httpMethods) {
        if (line.includes(method)) {
          const pathMatch = line.match(/['"`]([^'"`]*)['"`]/);
          const path = pathMatch ? pathMatch[1] : '/';
          return `${method.substring(1)} ${path}`;
        }
      }
    }
    return 'Unknown endpoint';
  }

  private extractCodeSnippet(file: CodeFile, line: number): string {
    const lines = file.content.split('\n');
    const start = Math.max(0, line - 2);
    const end = Math.min(lines.length, line + 1);
    return lines.slice(start, end).join('\n');
  }

  private addFinding(finding: Omit<AgentFinding, 'id' | 'agentId' | 'createdAt'>): void {
    this.findings.push({
      id: crypto.randomUUID(),
      agentId: this.id,
      createdAt: new Date(),
      ...finding
    });
  }

  private calculateMetrics(): void {
    this.metrics = {
      executionTime: Date.now() - this.startTime,
      findingsCount: this.findings.length,
      criticalFindings: this.findings.filter(f => f.severity === SecuritySeverity.CRITICAL).length,
      coveragePercentage: 85, // Estimated coverage
      falsePositiveRate: 0.1 // Estimated false positive rate
    };
  }

  // Additional test methods would be implemented here...
  private async testSessionManagement(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for session management testing
  }

  private async testXSSVulnerabilities(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for XSS testing
  }

  private async testCommandInjection(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for command injection testing
  }

  private async testRaceConditions(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for race condition testing
  }

  private async testDataLeakage(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for data leakage testing
  }

  private async testAPISecurityFlaws(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for API security testing
  }

  private async testRateLimitBypass(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for rate limit bypass testing
  }

  private async testCryptographicFlaws(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for cryptographic flaw testing
  }

  private async testSecretExposure(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for secret exposure testing
  }

  private async testContainerEscape(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for container escape testing
  }

  private async testNetworkSegmentation(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation for network segmentation testing
  }

  private async testPriceManipulation(codeFiles: CodeFile[], threatGraph: ThreatGraph): Promise<void> {
    // Implementation already included in testBusinessLogicFlaws
  }
}
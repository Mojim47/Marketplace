// ═══════════════════════════════════════════════════════════════════════════
// Threat Graph Builder - Adversarial Graph Engine for Risk Propagation
// ═══════════════════════════════════════════════════════════════════════════

import { 
  CodeFile, 
  ThreatGraph, 
  ThreatNode, 
  ThreatEdge, 
  NodeType, 
  EdgeType, 
  ExposureLevel,
  SecuritySeverity,
  CriticalPath,
  Vulnerability
} from '../types';
import { DependencyGraph, DependencyNode } from '../collector/dependency-graph';
import { VectorStore, VectorSearchResult } from '../embeddings/store';
import * as crypto from 'crypto';

export class ThreatGraphBuilder {
  private graph: ThreatGraph;
  private vectorStore: VectorStore;
  private nodeIdMap: Map<string, string> = new Map();

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
    this.graph = {
      nodes: [],
      edges: [],
      riskScore: 0,
      criticalPaths: [],
      vulnerabilities: []
    };
  }

  async buildThreatGraph(
    codeFiles: CodeFile[],
    dependencyGraph: DependencyGraph
  ): Promise<ThreatGraph> {
    console.log('🕸️ Building threat graph...');

    try {
      // 1. Build nodes from code files and dependencies
      await this.buildNodes(codeFiles, dependencyGraph);
      
      // 2. Build edges representing relationships and data flows
      await this.buildEdges(codeFiles, dependencyGraph);
      
      // 3. Analyze trust boundaries and exposure levels
      await this.analyzeTrustBoundaries();
      
      // 4. Calculate risk propagation
      await this.calculateRiskPropagation();
      
      // 5. Identify critical attack paths
      await this.identifyCriticalPaths();
      
      // 6. Extract vulnerabilities from security patterns
      await this.extractVulnerabilities(codeFiles);
      
      // 7. Calculate overall risk score
      this.calculateOverallRiskScore();

      console.log(`✅ Built threat graph with ${this.graph.nodes.length} nodes and ${this.graph.edges.length} edges`);
      return this.graph;
    } catch (error) {
      console.error('❌ Error building threat graph:', error);
      throw error;
    }
  }

  private async buildNodes(
    codeFiles: CodeFile[],
    dependencyGraph: DependencyGraph
  ): Promise<void> {
    console.log('🔗 Building threat nodes...');

    // Build file nodes
    for (const file of codeFiles) {
      const fileNode = this.createFileNode(file);
      this.graph.nodes.push(fileNode);
      this.nodeIdMap.set(file.id, fileNode.id);

      // Build function nodes for security-relevant functions
      for (const func of file.functions) {
        if (this.isSecurityRelevantFunction(func)) {
          const funcNode = this.createFunctionNode(file, func);
          this.graph.nodes.push(funcNode);
        }
      }

      // Build endpoint nodes for controllers
      if (this.isControllerFile(file)) {
        const endpoints = this.extractEndpoints(file);
        for (const endpoint of endpoints) {
          const endpointNode = this.createEndpointNode(file, endpoint);
          this.graph.nodes.push(endpointNode);
        }
      }

      // Build database query nodes
      const dbQueries = this.extractDatabaseQueries(file);
      for (const query of dbQueries) {
        const queryNode = this.createDatabaseQueryNode(file, query);
        this.graph.nodes.push(queryNode);
      }
    }

    // Build external service nodes
    const externalServices = this.identifyExternalServices(codeFiles);
    for (const service of externalServices) {
      const serviceNode = this.createExternalServiceNode(service);
      this.graph.nodes.push(serviceNode);
    }

    // Build secret nodes
    const secrets = this.identifySecrets(codeFiles);
    for (const secret of secrets) {
      const secretNode = this.createSecretNode(secret);
      this.graph.nodes.push(secretNode);
    }

    // Build trust boundary nodes
    const trustBoundaries = this.identifyTrustBoundaries(codeFiles);
    for (const boundary of trustBoundaries) {
      const boundaryNode = this.createTrustBoundaryNode(boundary);
      this.graph.nodes.push(boundaryNode);
    }
  }

  private async buildEdges(
    codeFiles: CodeFile[],
    dependencyGraph: DependencyGraph
  ): Promise<void> {
    console.log('🔗 Building threat edges...');

    // Build dependency edges
    for (const [nodeId, depNode] of dependencyGraph.nodes) {
      const sourceNodeId = this.nodeIdMap.get(nodeId);
      if (!sourceNodeId) continue;

      for (const dep of depNode.dependencies) {
        const targetNode = this.findNodeByImport(dep);
        if (targetNode) {
          const edge = this.createDependencyEdge(sourceNodeId, targetNode.id, dep);
          this.graph.edges.push(edge);
        }
      }
    }

    // Build data flow edges
    for (const file of codeFiles) {
      const dataFlows = this.analyzeDataFlows(file);
      for (const flow of dataFlows) {
        const edge = this.createDataFlowEdge(flow);
        if (edge) this.graph.edges.push(edge);
      }
    }

    // Build authentication edges
    const authEdges = this.identifyAuthenticationFlows(codeFiles);
    this.graph.edges.push(...authEdges);

    // Build privilege escalation edges
    const escalationEdges = this.identifyPrivilegeEscalationPaths(codeFiles);
    this.graph.edges.push(...escalationEdges);

    // Build exposure edges (public endpoints, external APIs)
    const exposureEdges = this.identifyExposurePaths(codeFiles);
    this.graph.edges.push(...exposureEdges);
  }

  private createFileNode(file: CodeFile): ThreatNode {
    const riskScore = this.calculateFileRiskScore(file);
    const exposureLevel = this.determineExposureLevel(file);

    return {
      id: this.generateNodeId('file', file.id),
      type: NodeType.FILE,
      name: file.path,
      riskScore,
      metadata: {
        filePath: file.path,
        securityPatterns: file.securityPatterns,
        businessCriticality: this.calculateBusinessCriticality(file),
        exposureLevel,
        tenantIsolation: this.checkTenantIsolation(file)
      },
      position: { x: 0, y: 0 } // Will be calculated later for visualization
    };
  }

  private createFunctionNode(file: CodeFile, func: any): ThreatNode {
    const riskScore = this.calculateFunctionRiskScore(func);

    return {
      id: this.generateNodeId('function', `${file.id}_${func.name}`),
      type: NodeType.FUNCTION,
      name: func.name,
      riskScore,
      metadata: {
        filePath: file.path,
        lineNumber: func.startLine,
        securityPatterns: func.securityRisk?.patterns || [],
        businessCriticality: this.calculateBusinessCriticality(file),
        exposureLevel: func.securityRisk?.trustBoundary ? ExposureLevel.PUBLIC : ExposureLevel.INTERNAL,
        tenantIsolation: this.checkFunctionTenantIsolation(func)
      },
      position: { x: 0, y: 0 }
    };
  }

  private createEndpointNode(file: CodeFile, endpoint: any): ThreatNode {
    const riskScore = this.calculateEndpointRiskScore(endpoint);

    return {
      id: this.generateNodeId('endpoint', `${file.id}_${endpoint.path}_${endpoint.method}`),
      type: NodeType.ENDPOINT,
      name: `${endpoint.method} ${endpoint.path}`,
      riskScore,
      metadata: {
        filePath: file.path,
        lineNumber: endpoint.line,
        securityPatterns: endpoint.securityPatterns || [],
        businessCriticality: this.calculateEndpointBusinessCriticality(endpoint),
        exposureLevel: endpoint.isPublic ? ExposureLevel.PUBLIC : ExposureLevel.AUTHENTICATED,
        tenantIsolation: endpoint.hasTenantIsolation || false
      },
      position: { x: 0, y: 0 }
    };
  }

  private createDatabaseQueryNode(file: CodeFile, query: any): ThreatNode {
    const riskScore = this.calculateQueryRiskScore(query);

    return {
      id: this.generateNodeId('query', `${file.id}_${query.hash}`),
      type: NodeType.DATABASE_QUERY,
      name: query.operation || 'Database Query',
      riskScore,
      metadata: {
        filePath: file.path,
        lineNumber: query.line,
        securityPatterns: query.securityPatterns || [],
        businessCriticality: this.calculateBusinessCriticality(file),
        exposureLevel: ExposureLevel.INTERNAL,
        tenantIsolation: query.hasTenantFilter || false
      },
      position: { x: 0, y: 0 }
    };
  }

  private createExternalServiceNode(service: any): ThreatNode {
    return {
      id: this.generateNodeId('external', service.name),
      type: NodeType.EXTERNAL_SERVICE,
      name: service.name,
      riskScore: service.riskScore || 5,
      metadata: {
        securityPatterns: [],
        businessCriticality: service.businessCriticality || 5,
        exposureLevel: ExposureLevel.PUBLIC,
        tenantIsolation: false
      },
      position: { x: 0, y: 0 }
    };
  }

  private createSecretNode(secret: any): ThreatNode {
    return {
      id: this.generateNodeId('secret', secret.name),
      type: NodeType.SECRET,
      name: secret.name,
      riskScore: 9, // Secrets are always high risk
      metadata: {
        filePath: secret.filePath,
        lineNumber: secret.line,
        securityPatterns: secret.securityPatterns || [],
        businessCriticality: 10,
        exposureLevel: ExposureLevel.PRIVATE,
        tenantIsolation: true
      },
      position: { x: 0, y: 0 }
    };
  }

  private createTrustBoundaryNode(boundary: any): ThreatNode {
    return {
      id: this.generateNodeId('boundary', boundary.name),
      type: NodeType.TRUST_BOUNDARY,
      name: boundary.name,
      riskScore: boundary.riskScore || 7,
      metadata: {
        filePath: boundary.filePath,
        securityPatterns: boundary.securityPatterns || [],
        businessCriticality: 8,
        exposureLevel: ExposureLevel.PUBLIC,
        tenantIsolation: boundary.tenantIsolation || false
      },
      position: { x: 0, y: 0 }
    };
  }

  private createDependencyEdge(sourceId: string, targetId: string, importPath: string): ThreatEdge {
    const riskMultiplier = this.calculateDependencyRisk(importPath);

    return {
      id: this.generateEdgeId(sourceId, targetId, 'depends_on'),
      source: sourceId,
      target: targetId,
      type: EdgeType.DEPENDS_ON,
      weight: 1,
      riskMultiplier,
      metadata: {
        dataType: 'code_dependency',
        validationLevel: 0,
        encryptionLevel: 0,
        auditTrail: false
      }
    };
  }

  private createDataFlowEdge(flow: any): ThreatEdge | null {
    if (!flow.source || !flow.target) return null;

    return {
      id: this.generateEdgeId(flow.source, flow.target, 'data_flows_to'),
      source: flow.source,
      target: flow.target,
      type: EdgeType.DATA_FLOWS_TO,
      weight: flow.weight || 1,
      riskMultiplier: flow.riskMultiplier || 1,
      metadata: {
        dataType: flow.dataType || 'unknown',
        validationLevel: flow.validationLevel || 0,
        encryptionLevel: flow.encryptionLevel || 0,
        auditTrail: flow.auditTrail || false
      }
    };
  }

  private async analyzeTrustBoundaries(): Promise<void> {
    // Identify nodes that cross trust boundaries
    for (const node of this.graph.nodes) {
      if (node.type === NodeType.ENDPOINT || 
          node.type === NodeType.EXTERNAL_SERVICE ||
          node.metadata.exposureLevel === ExposureLevel.PUBLIC) {
        
        // Mark as trust boundary and increase risk
        node.riskScore = Math.min(10, node.riskScore + 2);
        
        // Find all nodes reachable from this trust boundary
        const reachableNodes = this.findReachableNodes(node.id);
        for (const reachableId of reachableNodes) {
          const reachableNode = this.graph.nodes.find(n => n.id === reachableId);
          if (reachableNode) {
            reachableNode.riskScore = Math.min(10, reachableNode.riskScore + 1);
          }
        }
      }
    }
  }

  private async calculateRiskPropagation(): Promise<void> {
    // Implement risk propagation algorithm
    const maxIterations = 10;
    let iteration = 0;
    let hasChanges = true;

    while (hasChanges && iteration < maxIterations) {
      hasChanges = false;
      iteration++;

      for (const edge of this.graph.edges) {
        const sourceNode = this.graph.nodes.find(n => n.id === edge.source);
        const targetNode = this.graph.nodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
          // Calculate propagated risk
          const propagatedRisk = sourceNode.riskScore * edge.riskMultiplier * 0.8;
          const newTargetRisk = Math.min(10, Math.max(targetNode.riskScore, propagatedRisk));

          if (newTargetRisk > targetNode.riskScore) {
            targetNode.riskScore = newTargetRisk;
            hasChanges = true;
          }
        }
      }
    }
  }

  private async identifyCriticalPaths(): Promise<void> {
    const criticalPaths: CriticalPath[] = [];

    // Find paths from public endpoints to sensitive resources
    const publicNodes = this.graph.nodes.filter(n => 
      n.metadata.exposureLevel === ExposureLevel.PUBLIC
    );

    const sensitiveNodes = this.graph.nodes.filter(n => 
      n.type === NodeType.SECRET || 
      n.type === NodeType.DATABASE_QUERY ||
      n.riskScore >= 8
    );

    for (const publicNode of publicNodes) {
      for (const sensitiveNode of sensitiveNodes) {
        const paths = this.findPathsBetweenNodes(publicNode.id, sensitiveNode.id);
        
        for (const path of paths) {
          const riskScore = this.calculatePathRiskScore(path);
          const exploitability = this.calculatePathExploitability(path);
          const impact = this.calculatePathImpact(path);

          if (riskScore >= 6) { // Only include high-risk paths
            criticalPaths.push({
              id: this.generatePathId(path),
              nodes: path,
              edges: this.getEdgesForPath(path),
              riskScore,
              exploitability,
              impact,
              description: this.generatePathDescription(path)
            });
          }
        }
      }
    }

    // Sort by risk score and take top 50
    this.graph.criticalPaths = criticalPaths
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 50);
  }

  private async extractVulnerabilities(codeFiles: CodeFile[]): Promise<void> {
    const vulnerabilities: Vulnerability[] = [];

    for (const file of codeFiles) {
      for (const pattern of file.securityPatterns) {
        const nodeId = this.nodeIdMap.get(file.id);
        if (!nodeId) continue;

        const vulnerability: Vulnerability = {
          id: this.generateVulnerabilityId(file.id, pattern),
          type: pattern.type,
          severity: pattern.severity as SecuritySeverity,
          nodeId,
          description: pattern.description,
          exploitScenario: this.generateExploitScenario(pattern),
          mitigation: pattern.recommendation,
          cweId: pattern.cweId
        };

        vulnerabilities.push(vulnerability);
      }
    }

    this.graph.vulnerabilities = vulnerabilities;
  }

  private calculateOverallRiskScore(): void {
    if (this.graph.nodes.length === 0) {
      this.graph.riskScore = 0;
      return;
    }

    // Calculate weighted average risk score
    const totalRisk = this.graph.nodes.reduce((sum, node) => {
      const weight = this.getNodeWeight(node);
      return sum + (node.riskScore * weight);
    }, 0);

    const totalWeight = this.graph.nodes.reduce((sum, node) => 
      sum + this.getNodeWeight(node), 0
    );

    this.graph.riskScore = totalWeight > 0 ? totalRisk / totalWeight : 0;

    // Apply multipliers for critical vulnerabilities and paths
    const criticalVulns = this.graph.vulnerabilities.filter(v => 
      v.severity === SecuritySeverity.CRITICAL
    ).length;

    const highRiskPaths = this.graph.criticalPaths.filter(p => 
      p.riskScore >= 8
    ).length;

    // Increase overall risk for critical issues
    this.graph.riskScore += (criticalVulns * 0.5) + (highRiskPaths * 0.3);
    this.graph.riskScore = Math.min(10, this.graph.riskScore);
  }

  // Helper methods
  private generateNodeId(type: string, identifier: string): string {
    return crypto.createHash('md5').update(`${type}_${identifier}`).digest('hex');
  }

  private generateEdgeId(source: string, target: string, type: string): string {
    return crypto.createHash('md5').update(`${source}_${target}_${type}`).digest('hex');
  }

  private generatePathId(path: string[]): string {
    return crypto.createHash('md5').update(path.join('_')).digest('hex');
  }

  private generateVulnerabilityId(fileId: string, pattern: any): string {
    return crypto.createHash('md5').update(`${fileId}_${pattern.type}_${pattern.line}`).digest('hex');
  }

  private isSecurityRelevantFunction(func: any): boolean {
    const securityKeywords = ['auth', 'validate', 'guard', 'check', 'verify', 'sanitize', 'encrypt', 'decrypt'];
    return securityKeywords.some(keyword => 
      func.name.toLowerCase().includes(keyword)
    ) || func.securityRisk?.level !== 'low';
  }

  private isControllerFile(file: CodeFile): boolean {
    return file.path.includes('controller') || 
           file.path.includes('resolver') || 
           file.path.includes('gateway');
  }

  private extractEndpoints(file: CodeFile): any[] {
    // Extract HTTP endpoints from controller files
    const endpoints: any[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const httpMethods = ['@Get', '@Post', '@Put', '@Delete', '@Patch'];
      
      for (const method of httpMethods) {
        if (line.includes(method)) {
          const pathMatch = line.match(/['"`]([^'"`]*)['"`]/);
          const path = pathMatch ? pathMatch[1] : '/';
          
          endpoints.push({
            method: method.substring(1).toUpperCase(),
            path,
            line: i + 1,
            isPublic: !lines.slice(Math.max(0, i - 5), i).some(l => 
              l.includes('@UseGuards') || l.includes('@Auth')
            ),
            hasTenantIsolation: lines.slice(i, Math.min(lines.length, i + 10)).some(l =>
              l.includes('tenant_id') || l.includes('tenantId')
            )
          });
        }
      }
    }

    return endpoints;
  }

  private extractDatabaseQueries(file: CodeFile): any[] {
    const queries: any[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Prisma query patterns
      const prismaPatterns = [
        'findMany', 'findFirst', 'findUnique', 'create', 'update', 'delete', 'upsert'
      ];

      for (const pattern of prismaPatterns) {
        if (line.includes(pattern)) {
          queries.push({
            operation: pattern,
            line: i + 1,
            hash: crypto.createHash('md5').update(`${file.id}_${i}_${pattern}`).digest('hex'),
            hasTenantFilter: line.includes('tenant_id') || line.includes('tenantId')
          });
        }
      }
    }

    return queries;
  }

  private identifyExternalServices(codeFiles: CodeFile[]): any[] {
    const services = new Set<string>();
    
    for (const file of codeFiles) {
      // Look for external API calls
      const externalPatterns = [
        'zarinpal', 'moodian', 'kavenegar', 'fetch(', 'axios.', 'http.'
      ];

      for (const pattern of externalPatterns) {
        if (file.content.toLowerCase().includes(pattern)) {
          services.add(pattern);
        }
      }
    }

    return Array.from(services).map(service => ({
      name: service,
      riskScore: this.getExternalServiceRisk(service),
      businessCriticality: this.getExternalServiceCriticality(service)
    }));
  }

  private identifySecrets(codeFiles: CodeFile[]): any[] {
    const secrets: any[] = [];

    for (const file of codeFiles) {
      const secretPatterns = file.securityPatterns.filter(p => 
        p.type === 'hardcoded_secret'
      );

      for (const pattern of secretPatterns) {
        secrets.push({
          name: `Secret in ${file.path}:${pattern.line}`,
          filePath: file.path,
          line: pattern.line,
          securityPatterns: [pattern]
        });
      }
    }

    return secrets;
  }

  private identifyTrustBoundaries(codeFiles: CodeFile[]): any[] {
    const boundaries: any[] = [];

    for (const file of codeFiles) {
      if (this.isControllerFile(file) || 
          file.path.includes('middleware') || 
          file.path.includes('guard')) {
        
        boundaries.push({
          name: `Trust Boundary: ${file.path}`,
          filePath: file.path,
          riskScore: this.calculateFileRiskScore(file),
          tenantIsolation: this.checkTenantIsolation(file)
        });
      }
    }

    return boundaries;
  }

  // Risk calculation methods
  private calculateFileRiskScore(file: CodeFile): number {
    let risk = 0;
    
    // Security patterns contribute to risk
    risk += file.securityPatterns.length * 2;
    
    // Critical patterns add more risk
    const criticalPatterns = file.securityPatterns.filter(p => 
      p.severity === 'critical' || p.severity === 'high'
    );
    risk += criticalPatterns.length * 3;
    
    // File type risk
    if (file.path.includes('auth') || file.path.includes('security')) risk += 3;
    if (file.path.includes('payment') || file.path.includes('order')) risk += 2;
    if (file.path.includes('admin') || file.path.includes('config')) risk += 2;
    
    return Math.min(10, risk);
  }

  private calculateFunctionRiskScore(func: any): number {
    let risk = func.complexity || 1;
    
    if (func.securityRisk) {
      const severityMap: Record<string, number> = {
        'critical': 5,
        'high': 4,
        'medium': 2,
        'low': 1
      };
      risk += severityMap[func.securityRisk.level] || 1;
    }
    
    return Math.min(10, risk);
  }

  private calculateEndpointRiskScore(endpoint: any): number {
    let risk = 3; // Base risk for endpoints
    
    if (endpoint.isPublic) risk += 3;
    if (!endpoint.hasTenantIsolation) risk += 2;
    if (endpoint.method === 'POST' || endpoint.method === 'PUT') risk += 1;
    
    return Math.min(10, risk);
  }

  private calculateQueryRiskScore(query: any): number {
    let risk = 2; // Base risk for database queries
    
    if (!query.hasTenantFilter) risk += 4; // Major risk for missing tenant isolation
    if (query.operation === 'delete' || query.operation === 'update') risk += 2;
    
    return Math.min(10, risk);
  }

  private calculateBusinessCriticality(file: CodeFile): number {
    const businessPaths = ['order', 'payment', 'product', 'user', 'invoice', 'moodian'];
    let criticality = 1;
    
    for (const path of businessPaths) {
      if (file.path.includes(path)) {
        criticality += 3;
        break;
      }
    }
    
    if (file.path.includes('controller') || file.path.includes('service')) {
      criticality += 2;
    }
    
    return Math.min(10, criticality);
  }

  private calculateEndpointBusinessCriticality(endpoint: any): number {
    const criticalPaths = ['/payment', '/order', '/admin', '/auth'];
    let criticality = 3;
    
    for (const path of criticalPaths) {
      if (endpoint.path.includes(path)) {
        criticality += 4;
        break;
      }
    }
    
    return Math.min(10, criticality);
  }

  private determineExposureLevel(file: CodeFile): ExposureLevel {
    if (this.isControllerFile(file)) return ExposureLevel.PUBLIC;
    if (file.path.includes('auth') || file.path.includes('guard')) return ExposureLevel.AUTHENTICATED;
    if (file.path.includes('admin')) return ExposureLevel.PRIVILEGED;
    return ExposureLevel.INTERNAL;
  }

  private checkTenantIsolation(file: CodeFile): boolean {
    return file.content.includes('tenant_id') || 
           file.content.includes('tenantId') ||
           file.content.includes('RLS');
  }

  private checkFunctionTenantIsolation(func: any): boolean {
    // This would need to analyze the function body for tenant isolation
    return false; // Simplified for now
  }

  // Additional helper methods would be implemented here...
  private findNodeByImport(importPath: string): ThreatNode | undefined {
    return this.graph.nodes.find(node => 
      node.metadata.filePath?.includes(importPath) ||
      node.name.includes(importPath)
    );
  }

  private analyzeDataFlows(file: CodeFile): any[] {
    // Analyze data flows within the file
    return []; // Simplified for now
  }

  private identifyAuthenticationFlows(codeFiles: CodeFile[]): ThreatEdge[] {
    return []; // Simplified for now
  }

  private identifyPrivilegeEscalationPaths(codeFiles: CodeFile[]): ThreatEdge[] {
    return []; // Simplified for now
  }

  private identifyExposurePaths(codeFiles: CodeFile[]): ThreatEdge[] {
    return []; // Simplified for now
  }

  private findReachableNodes(nodeId: string): string[] {
    const reachable = new Set<string>();
    const visited = new Set<string>();
    
    const dfs = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      reachable.add(currentId);
      
      const outgoingEdges = this.graph.edges.filter(e => e.source === currentId);
      for (const edge of outgoingEdges) {
        dfs(edge.target);
      }
    };
    
    dfs(nodeId);
    reachable.delete(nodeId); // Remove the starting node
    return Array.from(reachable);
  }

  private findPathsBetweenNodes(sourceId: string, targetId: string): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();
    
    const dfs = (currentId: string, currentPath: string[]) => {
      if (currentId === targetId) {
        paths.push([...currentPath, currentId]);
        return;
      }
      
      if (visited.has(currentId) || currentPath.length > 10) return; // Prevent infinite loops and limit depth
      
      visited.add(currentId);
      currentPath.push(currentId);
      
      const outgoingEdges = this.graph.edges.filter(e => e.source === currentId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, [...currentPath]);
      }
      
      visited.delete(currentId);
    };
    
    dfs(sourceId, []);
    return paths.slice(0, 10); // Limit to 10 paths per source-target pair
  }

  private calculatePathRiskScore(path: string[]): number {
    let totalRisk = 0;
    
    for (const nodeId of path) {
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        totalRisk += node.riskScore;
      }
    }
    
    return totalRisk / path.length; // Average risk
  }

  private calculatePathExploitability(path: string[]): number {
    // Calculate how easily this path can be exploited
    let exploitability = 10;
    
    for (const nodeId of path) {
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        if (node.metadata.exposureLevel === ExposureLevel.PRIVATE) exploitability -= 3;
        if (node.metadata.exposureLevel === ExposureLevel.PRIVILEGED) exploitability -= 2;
        if (node.metadata.tenantIsolation) exploitability -= 1;
      }
    }
    
    return Math.max(1, exploitability);
  }

  private calculatePathImpact(path: string[]): number {
    let maxImpact = 0;
    
    for (const nodeId of path) {
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        maxImpact = Math.max(maxImpact, node.metadata.businessCriticality || 0);
      }
    }
    
    return maxImpact;
  }

  private getEdgesForPath(path: string[]): string[] {
    const edges: string[] = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.graph.edges.find(e => 
        e.source === path[i] && e.target === path[i + 1]
      );
      if (edge) {
        edges.push(edge.id);
      }
    }
    
    return edges;
  }

  private generatePathDescription(path: string[]): string {
    const sourceNode = this.graph.nodes.find(n => n.id === path[0]);
    const targetNode = this.graph.nodes.find(n => n.id === path[path.length - 1]);
    
    return `Attack path from ${sourceNode?.name || 'unknown'} to ${targetNode?.name || 'unknown'}`;
  }

  private generateExploitScenario(pattern: any): string {
    const scenarios: Record<string, string> = {
      'sql_injection': 'Attacker can inject malicious SQL to access unauthorized data',
      'auth_bypass': 'Attacker can bypass authentication to access protected resources',
      'missing_auth': 'Unauthenticated attacker can access protected endpoints',
      'tenant_isolation_bypass': 'Attacker can access data from other tenants',
      'hardcoded_secret': 'Attacker can extract secrets from source code'
    };
    
    return scenarios[pattern.type] || 'Security vulnerability allows unauthorized access';
  }

  private calculateDependencyRisk(importPath: string): number {
    // External dependencies are riskier
    if (!importPath.startsWith('.') && 
        !importPath.startsWith('@nextgen/') && 
        !importPath.startsWith('@libs/')) {
      return 1.5;
    }
    
    // Internal dependencies have lower risk
    return 1.0;
  }

  private getExternalServiceRisk(service: string): number {
    const riskMap: Record<string, number> = {
      'zarinpal': 7, // Payment gateway - high risk
      'moodian': 6,  // Tax authority - medium-high risk
      'kavenegar': 4, // SMS service - medium risk
      'fetch(': 5,   // Generic HTTP calls - medium risk
      'axios.': 5,   // HTTP client - medium risk
      'http.': 5     // HTTP calls - medium risk
    };
    
    return riskMap[service] || 5;
  }

  private getExternalServiceCriticality(service: string): number {
    const criticalityMap: Record<string, number> = {
      'zarinpal': 9, // Payment is critical
      'moodian': 8,  // Tax compliance is critical
      'kavenegar': 5, // SMS is moderately critical
      'fetch(': 6,   // Generic calls
      'axios.': 6,   // HTTP client
      'http.': 6     // HTTP calls
    };
    
    return criticalityMap[service] || 5;
  }

  private getNodeWeight(node: ThreatNode): number {
    // Weight nodes based on their importance
    const typeWeights: Record<NodeType, number> = {
      [NodeType.ENDPOINT]: 3,
      [NodeType.DATABASE_QUERY]: 2.5,
      [NodeType.SECRET]: 3,
      [NodeType.EXTERNAL_SERVICE]: 2,
      [NodeType.TRUST_BOUNDARY]: 2.5,
      [NodeType.FUNCTION]: 1.5,
      [NodeType.FILE]: 1,
      [NodeType.CONTAINER]: 2,
      [NodeType.ROLE]: 2,
      [NodeType.POLICY]: 2
    };
    
    return typeWeights[node.type] || 1;
  }

  exportGraph(): any {
    return {
      nodes: this.graph.nodes,
      edges: this.graph.edges,
      riskScore: this.graph.riskScore,
      criticalPaths: this.graph.criticalPaths,
      vulnerabilities: this.graph.vulnerabilities,
      metadata: {
        nodeCount: this.graph.nodes.length,
        edgeCount: this.graph.edges.length,
        criticalPathCount: this.graph.criticalPaths.length,
        vulnerabilityCount: this.graph.vulnerabilities.length,
        averageNodeRisk: this.graph.nodes.reduce((sum, n) => sum + n.riskScore, 0) / this.graph.nodes.length
      }
    };
  }
}
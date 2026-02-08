// ═══════════════════════════════════════════════════════════════════════════
// Dependency Graph Builder - Maps Code Dependencies and Trust Boundaries
// ═══════════════════════════════════════════════════════════════════════════

import * as madge from 'madge';
import { CodeFile } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface DependencyNode {
  id: string;
  name: string;
  type: 'file' | 'package' | 'external';
  path: string;
  dependencies: string[];
  dependents: string[];
  isEntryPoint: boolean;
  isCritical: boolean;
  trustBoundary: boolean;
  securityRisk: number;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string; type: string }>;
  cycles: string[][];
  entryPoints: string[];
  criticalPaths: string[][];
}

export class DependencyGraphBuilder {
  private projectPath: string;
  private graph: DependencyGraph;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.graph = {
      nodes: new Map(),
      edges: [],
      cycles: [],
      entryPoints: [],
      criticalPaths: []
    };
  }

  async buildGraph(codeFiles: CodeFile[]): Promise<DependencyGraph> {
    console.log('🔗 Building dependency graph...');

    try {
      // Build nodes from code files
      await this.buildNodes(codeFiles);
      
      // Analyze dependencies using madge
      await this.analyzeDependencies();
      
      // Detect cycles
      await this.detectCycles();
      
      // Identify entry points
      this.identifyEntryPoints();
      
      // Find critical paths
      this.findCriticalPaths();
      
      // Analyze trust boundaries
      this.analyzeTrustBoundaries();

      console.log(`✅ Built dependency graph with ${this.graph.nodes.size} nodes and ${this.graph.edges.length} edges`);
      return this.graph;
    } catch (error) {
      console.error('❌ Error building dependency graph:', error);
      throw error;
    }
  }

  private async buildNodes(codeFiles: CodeFile[]): Promise<void> {
    for (const file of codeFiles) {
      const node: DependencyNode = {
        id: file.id,
        name: path.basename(file.path),
        type: 'file',
        path: file.path,
        dependencies: file.imports || [],
        dependents: [],
        isEntryPoint: this.isEntryPoint(file),
        isCritical: this.isCriticalFile(file),
        trustBoundary: this.isTrustBoundary(file),
        securityRisk: this.calculateSecurityRisk(file)
      };

      this.graph.nodes.set(file.id, node);
    }

    // Build reverse dependencies (dependents)
    for (const [nodeId, node] of this.graph.nodes) {
      for (const dep of node.dependencies) {
        const depNode = this.findNodeByImport(dep);
        if (depNode) {
          depNode.dependents.push(nodeId);
          this.graph.edges.push({
            from: nodeId,
            to: depNode.id,
            type: 'imports'
          });
        }
      }
    }
  }

  private async analyzeDependencies(): Promise<void> {
    try {
      const config = {
        fileExtensions: ['ts', 'js', 'tsx', 'jsx'],
        excludeRegExp: [
          /node_modules/,
          /dist/,
          /build/,
          /coverage/,
          /\.test\./,
          /\.spec\./
        ],
        tsConfig: path.join(this.projectPath, 'tsconfig.json')
      };

      const res = await madge(this.projectPath, config);
      const dependencies = res.obj();

      // Update nodes with madge results
      for (const [filePath, deps] of Object.entries(dependencies)) {
        const node = this.findNodeByPath(filePath);
        if (node && Array.isArray(deps)) {
          node.dependencies = deps;
        }
      }

      // Detect circular dependencies
      const circular = res.circular();
      this.graph.cycles = circular;

    } catch (error) {
      console.warn('⚠️ Madge analysis failed, using basic dependency analysis:', error);
    }
  }

  private async detectCycles(): Promise<void> {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = this.graph.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          const depNode = this.findNodeByImport(dep);
          if (depNode) {
            dfs(depNode.id, [...path]);
          }
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    this.graph.cycles = cycles;
  }

  private identifyEntryPoints(): void {
    const entryPoints: string[] = [];

    // Common entry point patterns
    const entryPatterns = [
      /main\.(ts|js)$/,
      /index\.(ts|js)$/,
      /app\.(ts|js)$/,
      /server\.(ts|js)$/,
      /\.controller\.(ts|js)$/,
      /\.gateway\.(ts|js)$/,
      /\.resolver\.(ts|js)$/
    ];

    for (const [nodeId, node] of this.graph.nodes) {
      // Check if it's an entry point by pattern
      const isEntryByPattern = entryPatterns.some(pattern => 
        pattern.test(node.path)
      );

      // Check if it has no dependents (leaf node in reverse)
      const hasNoDependents = node.dependents.length === 0;

      // Check if it's in apps/ directory (application entry points)
      const isAppEntry = node.path.startsWith('apps/');

      if (isEntryByPattern || (hasNoDependents && isAppEntry)) {
        entryPoints.push(nodeId);
        node.isEntryPoint = true;
      }
    }

    this.graph.entryPoints = entryPoints;
  }

  private findCriticalPaths(): void {
    const criticalPaths: string[][] = [];

    // Find paths from entry points to critical nodes
    for (const entryPointId of this.graph.entryPoints) {
      const paths = this.findPathsToTarget(entryPointId, (node) => 
        node.isCritical || node.trustBoundary || node.securityRisk > 7
      );
      criticalPaths.push(...paths);
    }

    // Sort by risk score
    criticalPaths.sort((a, b) => {
      const riskA = a.reduce((sum, nodeId) => {
        const node = this.graph.nodes.get(nodeId);
        return sum + (node?.securityRisk || 0);
      }, 0);
      const riskB = b.reduce((sum, nodeId) => {
        const node = this.graph.nodes.get(nodeId);
        return sum + (node?.securityRisk || 0);
      }, 0);
      return riskB - riskA;
    });

    this.graph.criticalPaths = criticalPaths.slice(0, 20); // Top 20 critical paths
  }

  private findPathsToTarget(
    startNodeId: string, 
    targetPredicate: (node: DependencyNode) => boolean,
    visited: Set<string> = new Set(),
    currentPath: string[] = []
  ): string[][] {
    if (visited.has(startNodeId)) return [];

    visited.add(startNodeId);
    currentPath.push(startNodeId);

    const node = this.graph.nodes.get(startNodeId);
    if (!node) return [];

    const paths: string[][] = [];

    // Check if current node matches target
    if (targetPredicate(node)) {
      paths.push([...currentPath]);
    }

    // Recursively search dependencies
    for (const dep of node.dependencies) {
      const depNode = this.findNodeByImport(dep);
      if (depNode && !visited.has(depNode.id)) {
        const subPaths = this.findPathsToTarget(
          depNode.id, 
          targetPredicate, 
          new Set(visited), 
          [...currentPath]
        );
        paths.push(...subPaths);
      }
    }

    return paths;
  }

  private analyzeTrustBoundaries(): void {
    for (const [nodeId, node] of this.graph.nodes) {
      // Update trust boundary analysis based on dependencies
      const hasTrustBoundaryDeps = node.dependencies.some(dep => {
        const depNode = this.findNodeByImport(dep);
        return depNode?.trustBoundary || this.isExternalDependency(dep);
      });

      if (hasTrustBoundaryDeps) {
        node.trustBoundary = true;
        node.securityRisk = Math.min(10, node.securityRisk + 2);
      }
    }
  }

  private isEntryPoint(file: CodeFile): boolean {
    const entryPatterns = [
      /main\.(ts|js)$/,
      /index\.(ts|js)$/,
      /app\.(ts|js)$/,
      /server\.(ts|js)$/
    ];

    return entryPatterns.some(pattern => pattern.test(file.path)) ||
           file.path.startsWith('apps/');
  }

  private isCriticalFile(file: CodeFile): boolean {
    const criticalPatterns = [
      /auth/i,
      /security/i,
      /payment/i,
      /order/i,
      /user/i,
      /admin/i,
      /config/i,
      /secret/i,
      /key/i,
      /token/i
    ];

    return criticalPatterns.some(pattern => 
      pattern.test(file.path) || pattern.test(file.content)
    ) || file.securityPatterns.length > 0;
  }

  private isTrustBoundary(file: CodeFile): boolean {
    const trustBoundaryPatterns = [
      /\.controller\.(ts|js)$/,
      /\.gateway\.(ts|js)$/,
      /\.resolver\.(ts|js)$/,
      /auth/i,
      /middleware/i,
      /guard/i,
      /interceptor/i
    ];

    return trustBoundaryPatterns.some(pattern => pattern.test(file.path)) ||
           file.functions.some(func => 
             func.name.includes('auth') || 
             func.name.includes('guard') ||
             func.name.includes('validate')
           );
  }

  private calculateSecurityRisk(file: CodeFile): number {
    let risk = 0;

    // Base risk from security patterns
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

    // Function complexity risk
    const complexFunctions = file.functions.filter(f => f.complexity > 10);
    risk += complexFunctions.length;

    // External dependencies risk
    const externalDeps = file.imports.filter(imp => this.isExternalDependency(imp));
    risk += externalDeps.length * 0.5;

    return Math.min(10, risk); // Cap at 10
  }

  private isExternalDependency(importPath: string): boolean {
    return !importPath.startsWith('.') && 
           !importPath.startsWith('@nextgen/') && 
           !importPath.startsWith('@libs/') &&
           !importPath.startsWith('~/');
  }

  private findNodeByImport(importPath: string): DependencyNode | undefined {
    // Try to resolve import to actual file path
    for (const [nodeId, node] of this.graph.nodes) {
      if (node.path.includes(importPath) || 
          node.name === importPath ||
          node.path.endsWith(importPath + '.ts') ||
          node.path.endsWith(importPath + '.js')) {
        return node;
      }
    }
    return undefined;
  }

  private findNodeByPath(filePath: string): DependencyNode | undefined {
    for (const [nodeId, node] of this.graph.nodes) {
      if (node.path === filePath || node.path.endsWith(filePath)) {
        return node;
      }
    }
    return undefined;
  }

  // Analysis methods
  async getGraphMetrics(): Promise<{
    totalNodes: number;
    totalEdges: number;
    cyclicDependencies: number;
    entryPoints: number;
    criticalNodes: number;
    trustBoundaries: number;
    averageRisk: number;
    maxDepth: number;
  }> {
    const criticalNodes = Array.from(this.graph.nodes.values()).filter(n => n.isCritical).length;
    const trustBoundaries = Array.from(this.graph.nodes.values()).filter(n => n.trustBoundary).length;
    const totalRisk = Array.from(this.graph.nodes.values()).reduce((sum, n) => sum + n.securityRisk, 0);
    const averageRisk = totalRisk / this.graph.nodes.size;

    return {
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.length,
      cyclicDependencies: this.graph.cycles.length,
      entryPoints: this.graph.entryPoints.length,
      criticalNodes,
      trustBoundaries,
      averageRisk,
      maxDepth: this.calculateMaxDepth()
    };
  }

  private calculateMaxDepth(): number {
    let maxDepth = 0;

    const calculateDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const node = this.graph.nodes.get(nodeId);
      if (!node) return 0;

      let depth = 0;
      for (const dep of node.dependencies) {
        const depNode = this.findNodeByImport(dep);
        if (depNode) {
          depth = Math.max(depth, calculateDepth(depNode.id, new Set(visited)));
        }
      }

      return depth + 1;
    };

    for (const entryPoint of this.graph.entryPoints) {
      const depth = calculateDepth(entryPoint);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  exportGraph(): any {
    return {
      nodes: Array.from(this.graph.nodes.values()),
      edges: this.graph.edges,
      cycles: this.graph.cycles,
      entryPoints: this.graph.entryPoints,
      criticalPaths: this.graph.criticalPaths
    };
  }
}
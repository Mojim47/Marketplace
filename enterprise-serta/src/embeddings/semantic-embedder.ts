// ═══════════════════════════════════════════════════════════════════════════
// Semantic Embedder - 4096-Dimensional Code Intelligence Layer
// ═══════════════════════════════════════════════════════════════════════════

import * as crypto from 'node:crypto';
import * as tf from '@tensorflow/tfjs-node';
import {
  type CodeEmbedding,
  type CodeFile,
  type EmbeddingMetadata,
  EmbeddingType,
  type FunctionInfo,
  type SecurityPattern,
} from '../types';

export class SemanticEmbedder {
  private model: tf.LayersModel | null = null;
  private vocabulary: Map<string, number> = new Map();
  private readonly embeddingDimensions = 4096;
  private readonly maxSequenceLength = 512;

  constructor() {
    this.initializeVocabulary();
  }

  async initialize(): Promise<void> {
    try {
      // Create a simplified transformer-like model for code embeddings
      this.model = await this.createCodeEmbeddingModel();
    } catch (error) {
      console.error('❌ Failed to initialize embedding model:', error);
      throw error;
    }
  }

  async embedCodeFile(codeFile: CodeFile): Promise<CodeEmbedding[]> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const embeddings: CodeEmbedding[] = [];

    try {
      // 1. Semantic Code Embedding - Overall file structure and patterns
      const semanticEmbedding = await this.createSemanticCodeEmbedding(codeFile);
      embeddings.push(semanticEmbedding);

      // 2. Security Pattern Embeddings - Security-specific patterns
      const securityEmbeddings = await this.createSecurityPatternEmbeddings(codeFile);
      embeddings.push(...securityEmbeddings);

      // 3. Function-level Embeddings - Individual function analysis
      const functionEmbeddings = await this.createFunctionEmbeddings(codeFile);
      embeddings.push(...functionEmbeddings);

      // 4. Dependency Flow Embeddings - Import/export patterns
      const dependencyEmbedding = await this.createDependencyFlowEmbedding(codeFile);
      embeddings.push(dependencyEmbedding);

      // 5. Business Logic Embeddings - Domain-specific patterns
      const businessEmbedding = await this.createBusinessLogicEmbedding(codeFile);
      embeddings.push(businessEmbedding);
      return embeddings;
    } catch (error) {
      console.error(`❌ Error creating embeddings for ${codeFile.path}:`, error);
      return [];
    }
  }

  private async createSemanticCodeEmbedding(codeFile: CodeFile): Promise<CodeEmbedding> {
    // Tokenize the entire file content
    const tokens = this.tokenizeCode(codeFile.content);
    const tokenIds = this.tokensToIds(tokens);
    const paddedTokens = this.padSequence(tokenIds, this.maxSequenceLength);

    // Create input tensor
    const inputTensor = tf.tensor2d([paddedTokens], [1, this.maxSequenceLength]);

    // Get embeddings from model
    const embeddings = this.model?.predict(inputTensor) as tf.Tensor;
    const embeddingArray = await embeddings.data();

    // Clean up tensors
    inputTensor.dispose();
    embeddings.dispose();

    const metadata: EmbeddingMetadata = {
      fileName: codeFile.path,
      securityRelevance: this.calculateSecurityRelevance(codeFile),
      businessCriticality: this.calculateBusinessCriticality(codeFile),
      complexity: this.calculateComplexity(codeFile),
      trustBoundary: this.isTrustBoundary(codeFile),
    };

    return {
      id: this.generateEmbeddingId(codeFile.id, 'semantic_code'),
      fileId: codeFile.id,
      type: EmbeddingType.SEMANTIC_CODE,
      vector: Array.from(embeddingArray),
      metadata,
      createdAt: new Date(),
    };
  }

  private async createSecurityPatternEmbeddings(codeFile: CodeFile): Promise<CodeEmbedding[]> {
    const embeddings: CodeEmbedding[] = [];

    // Group security patterns by type
    const patternGroups = this.groupSecurityPatterns(codeFile.securityPatterns);

    for (const [patternType, patterns] of patternGroups) {
      // Create a combined text representation of all patterns of this type
      const patternText = patterns
        .map((p) => `${p.type} ${p.severity} ${p.description} ${p.recommendation}`)
        .join(' ');

      const tokens = this.tokenizeCode(patternText);
      const tokenIds = this.tokensToIds(tokens);
      const paddedTokens = this.padSequence(tokenIds, this.maxSequenceLength);

      const inputTensor = tf.tensor2d([paddedTokens], [1, this.maxSequenceLength]);
      const embeddings_tensor = this.model?.predict(inputTensor) as tf.Tensor;
      const embeddingArray = await embeddings_tensor.data();

      inputTensor.dispose();
      embeddings_tensor.dispose();

      const metadata: EmbeddingMetadata = {
        fileName: codeFile.path,
        securityRelevance: 10, // Security patterns are always highly relevant
        businessCriticality: this.calculateBusinessCriticality(codeFile),
        complexity: patterns.length,
        trustBoundary: true,
      };

      embeddings.push({
        id: this.generateEmbeddingId(codeFile.id, `security_${patternType}`),
        fileId: codeFile.id,
        type: EmbeddingType.SECURITY_PATTERN,
        vector: Array.from(embeddingArray),
        metadata,
        createdAt: new Date(),
      });
    }

    return embeddings;
  }

  private async createFunctionEmbeddings(codeFile: CodeFile): Promise<CodeEmbedding[]> {
    const embeddings: CodeEmbedding[] = [];

    // Only embed functions that are security-relevant or complex
    const relevantFunctions = codeFile.functions.filter(
      (func) =>
        func.complexity > 5 ||
        func.securityRisk.level !== 'low' ||
        this.isSecurityRelevantFunction(func)
    );

    for (const func of relevantFunctions) {
      // Extract function code from file content
      const functionCode = this.extractFunctionCode(codeFile.content, func);

      const tokens = this.tokenizeCode(functionCode);
      const tokenIds = this.tokensToIds(tokens);
      const paddedTokens = this.padSequence(tokenIds, this.maxSequenceLength);

      const inputTensor = tf.tensor2d([paddedTokens], [1, this.maxSequenceLength]);
      const embeddings_tensor = this.model?.predict(inputTensor) as tf.Tensor;
      const embeddingArray = await embeddings_tensor.data();

      inputTensor.dispose();
      embeddings_tensor.dispose();

      const metadata: EmbeddingMetadata = {
        fileName: codeFile.path,
        functionName: func.name,
        securityRelevance: this.mapSecurityLevel(func.securityRisk.level),
        businessCriticality: this.calculateBusinessCriticality(codeFile),
        complexity: func.complexity,
        trustBoundary: func.securityRisk.trustBoundary,
      };

      embeddings.push({
        id: this.generateEmbeddingId(codeFile.id, `function_${func.name}`),
        fileId: codeFile.id,
        type: EmbeddingType.SEMANTIC_CODE,
        vector: Array.from(embeddingArray),
        metadata,
        createdAt: new Date(),
      });
    }

    return embeddings;
  }

  private async createDependencyFlowEmbedding(codeFile: CodeFile): Promise<CodeEmbedding> {
    // Create a representation of import/export patterns
    const dependencyText = [
      ...codeFile.imports.map((imp) => `import ${imp}`),
      ...codeFile.exports.map((exp) => `export ${exp}`),
    ].join(' ');

    const tokens = this.tokenizeCode(dependencyText);
    const tokenIds = this.tokensToIds(tokens);
    const paddedTokens = this.padSequence(tokenIds, this.maxSequenceLength);

    const inputTensor = tf.tensor2d([paddedTokens], [1, this.maxSequenceLength]);
    const embeddings = this.model?.predict(inputTensor) as tf.Tensor;
    const embeddingArray = await embeddings.data();

    inputTensor.dispose();
    embeddings.dispose();

    const metadata: EmbeddingMetadata = {
      fileName: codeFile.path,
      securityRelevance: this.calculateDependencySecurityRelevance(codeFile),
      businessCriticality: this.calculateBusinessCriticality(codeFile),
      complexity: codeFile.imports.length + codeFile.exports.length,
      trustBoundary: this.hasTrustBoundaryDependencies(codeFile),
    };

    return {
      id: this.generateEmbeddingId(codeFile.id, 'dependency_flow'),
      fileId: codeFile.id,
      type: EmbeddingType.DEPENDENCY_FLOW,
      vector: Array.from(embeddingArray),
      metadata,
      createdAt: new Date(),
    };
  }

  private async createBusinessLogicEmbedding(codeFile: CodeFile): Promise<CodeEmbedding> {
    // Extract business domain keywords and patterns
    const businessKeywords = this.extractBusinessKeywords(codeFile);
    const businessText = businessKeywords.join(' ');

    const tokens = this.tokenizeCode(businessText);
    const tokenIds = this.tokensToIds(tokens);
    const paddedTokens = this.padSequence(tokenIds, this.maxSequenceLength);

    const inputTensor = tf.tensor2d([paddedTokens], [1, this.maxSequenceLength]);
    const embeddings = this.model?.predict(inputTensor) as tf.Tensor;
    const embeddingArray = await embeddings.data();

    inputTensor.dispose();
    embeddings.dispose();

    const metadata: EmbeddingMetadata = {
      fileName: codeFile.path,
      securityRelevance: this.calculateSecurityRelevance(codeFile),
      businessCriticality: this.calculateBusinessCriticality(codeFile),
      complexity: businessKeywords.length,
      trustBoundary: this.isTrustBoundary(codeFile),
    };

    return {
      id: this.generateEmbeddingId(codeFile.id, 'business_logic'),
      fileId: codeFile.id,
      type: EmbeddingType.BUSINESS_LOGIC,
      vector: Array.from(embeddingArray),
      metadata,
      createdAt: new Date(),
    };
  }

  private async createCodeEmbeddingModel(): Promise<tf.LayersModel> {
    // Create a simplified transformer-like model for code embeddings
    const vocabularySize = this.vocabulary.size;

    const input = tf.input({ shape: [this.maxSequenceLength] });

    // Embedding layer
    const embedding = tf.layers
      .embedding({
        inputDim: vocabularySize,
        outputDim: 256,
        inputLength: this.maxSequenceLength,
      })
      .apply(input) as tf.SymbolicTensor;

    // Multi-head attention (simplified)
    const attention = tf.layers
      .dense({ units: 512, activation: 'relu' })
      .apply(embedding) as tf.SymbolicTensor;

    // Global average pooling
    const pooled = tf.layers.globalAveragePooling1d().apply(attention) as tf.SymbolicTensor;

    // Dense layers for final embedding
    const dense1 = tf.layers
      .dense({ units: 2048, activation: 'relu' })
      .apply(pooled) as tf.SymbolicTensor;
    const dropout = tf.layers.dropout({ rate: 0.1 }).apply(dense1) as tf.SymbolicTensor;
    const output = tf.layers
      .dense({ units: this.embeddingDimensions, activation: 'tanh' })
      .apply(dropout) as tf.SymbolicTensor;

    const model = tf.model({ inputs: input, outputs: output });

    // Compile with a simple optimizer (we're not training, just using for inference)
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });

    return model;
  }

  private initializeVocabulary(): void {
    // Initialize with common programming tokens
    const commonTokens = [
      // JavaScript/TypeScript keywords
      'function',
      'const',
      'let',
      'var',
      'if',
      'else',
      'for',
      'while',
      'return',
      'class',
      'interface',
      'type',
      'import',
      'export',
      'async',
      'await',
      'try',
      'catch',
      'throw',
      'new',
      'this',
      'super',
      'extends',
      'implements',

      // Security-related tokens
      'auth',
      'authentication',
      'authorization',
      'token',
      'jwt',
      'password',
      'secret',
      'key',
      'encrypt',
      'decrypt',
      'hash',
      'salt',
      'validate',
      'sanitize',
      'escape',
      'csrf',
      'xss',
      'sql',
      'injection',
      'guard',

      // Business domain tokens (NextGen Marketplace specific)
      'order',
      'payment',
      'product',
      'user',
      'tenant',
      'zarinpal',
      'moodian',
      'invoice',
      'executor',
      'vendor',
      'marketplace',
      'b2b',
      'b2c',

      // Common symbols and operators
      '(',
      ')',
      '{',
      '}',
      '[',
      ']',
      ';',
      ':',
      ',',
      '.',
      '=',
      '+',
      '-',
      '*',
      '/',
      '==',
      '===',
      '!=',
      '!==',
      '<',
      '>',
      '<=',
      '>=',
      '&&',
      '||',
      '!',

      // Special tokens
      '<UNK>',
      '<PAD>',
      '<START>',
      '<END>',
    ];

    commonTokens.forEach((token, index) => {
      this.vocabulary.set(token, index);
    });
  }

  private tokenizeCode(code: string): string[] {
    // Simple tokenization - in production, use a proper code tokenizer
    return code
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  private tokensToIds(tokens: string[]): number[] {
    return tokens.map((token) => this.vocabulary.get(token) ?? this.vocabulary.get('<UNK>')!);
  }

  private padSequence(sequence: number[], maxLength: number): number[] {
    const padToken = this.vocabulary.get('<PAD>')!;

    if (sequence.length >= maxLength) {
      return sequence.slice(0, maxLength);
    }

    return [...sequence, ...Array(maxLength - sequence.length).fill(padToken)];
  }

  // Helper methods for calculating metadata
  private calculateSecurityRelevance(codeFile: CodeFile): number {
    let relevance = 0;

    // Security patterns add relevance
    relevance += codeFile.securityPatterns.length * 2;

    // Security-related file paths
    const securityPaths = ['auth', 'security', 'guard', 'middleware', 'validation'];
    if (securityPaths.some((path) => codeFile.path.includes(path))) {
      relevance += 5;
    }

    // Security-related functions
    const securityFunctions = codeFile.functions.filter(
      (f) => f.name.includes('auth') || f.name.includes('validate') || f.name.includes('guard')
    );
    relevance += securityFunctions.length;

    return Math.min(10, relevance);
  }

  private calculateBusinessCriticality(codeFile: CodeFile): number {
    let criticality = 0;

    // Business domain paths
    const businessPaths = ['order', 'payment', 'product', 'user', 'invoice', 'moodian'];
    if (businessPaths.some((path) => codeFile.path.includes(path))) {
      criticality += 5;
    }

    // Controller/service files are more critical
    if (codeFile.path.includes('controller') || codeFile.path.includes('service')) {
      criticality += 3;
    }

    // Files with many functions are more critical
    criticality += Math.min(3, Math.floor(codeFile.functions.length / 5));

    return Math.min(10, criticality);
  }

  private calculateComplexity(codeFile: CodeFile): number {
    const avgComplexity =
      codeFile.functions.reduce((sum, f) => sum + f.complexity, 0) /
      Math.max(1, codeFile.functions.length);
    return Math.min(10, Math.floor(avgComplexity));
  }

  private isTrustBoundary(codeFile: CodeFile): boolean {
    const trustBoundaryPatterns = [
      'controller',
      'gateway',
      'resolver',
      'middleware',
      'guard',
      'interceptor',
    ];
    return trustBoundaryPatterns.some((pattern) => codeFile.path.includes(pattern));
  }

  private groupSecurityPatterns(patterns: SecurityPattern[]): Map<string, SecurityPattern[]> {
    const groups = new Map<string, SecurityPattern[]>();

    for (const pattern of patterns) {
      const key = pattern.type;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(pattern);
    }

    return groups;
  }

  private isSecurityRelevantFunction(func: FunctionInfo): boolean {
    const securityKeywords = ['auth', 'validate', 'guard', 'check', 'verify', 'sanitize'];
    return securityKeywords.some((keyword) => func.name.toLowerCase().includes(keyword));
  }

  private extractFunctionCode(content: string, func: FunctionInfo): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, func.startLine - 1);
    const endLine = Math.min(lines.length, func.endLine);
    return lines.slice(startLine, endLine).join('\n');
  }

  private mapSecurityLevel(level: string): number {
    const mapping: Record<string, number> = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 2,
      info: 1,
    };
    return mapping[level] || 1;
  }

  private calculateDependencySecurityRelevance(codeFile: CodeFile): number {
    let relevance = 0;

    // External dependencies add risk
    const externalDeps = codeFile.imports.filter(
      (imp) => !imp.startsWith('.') && !imp.startsWith('@nextgen/') && !imp.startsWith('@libs/')
    );
    relevance += externalDeps.length * 0.5;

    // Security-related imports
    const securityImports = codeFile.imports.filter(
      (imp) => imp.includes('auth') || imp.includes('security') || imp.includes('crypto')
    );
    relevance += securityImports.length * 2;

    return Math.min(10, relevance);
  }

  private hasTrustBoundaryDependencies(codeFile: CodeFile): boolean {
    return codeFile.imports.some(
      (imp) => imp.includes('auth') || imp.includes('security') || imp.includes('guard')
    );
  }

  private extractBusinessKeywords(codeFile: CodeFile): string[] {
    const businessKeywords = [
      'order',
      'payment',
      'product',
      'user',
      'tenant',
      'vendor',
      'executor',
      'invoice',
      'zarinpal',
      'moodian',
      'marketplace',
      'b2b',
      'b2c',
      'pricing',
      'discount',
      'inventory',
      'shipping',
      'warranty',
    ];

    const foundKeywords: string[] = [];
    const content = codeFile.content.toLowerCase();

    for (const keyword of businessKeywords) {
      if (content.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    return foundKeywords;
  }

  private generateEmbeddingId(fileId: string, suffix: string): string {
    return crypto.createHash('md5').update(`${fileId}_${suffix}`).digest('hex');
  }

  async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

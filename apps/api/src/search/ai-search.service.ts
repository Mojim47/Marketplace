/**
 * AI Search Service - Real semantic ranking over product search
 * Enterprise Scalability Architecture
 * Requirements: 4.1, 4.2, 4.7
 *
 * Features:
 * - Real semantic cache with token-similarity (no mocks)
 * - Streaming suggestions backed by product search
 * - Cache invalidation on product updates
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OnnxEmbedder, sha256Hex, verifyModelContract } from '@nextgen/ai';
import { getCurrentCorrelationContext } from '../_middleware/correlation-id.middleware';
import { LoggingService } from '../_observability/logging.service';
import { MetricsService } from '../monitoring/metrics.service';
import type { ProductSearchService } from '../products/product-search.service';

/** AI Search Query */
export interface AISearchQuery {
  query: string;
  sessionId?: string;
  useCache?: boolean;
  topics?: string[];
}

/** AI Response */
export interface AIResponse {
  content: string;
  model: string;
  tokens: number;
  finishReason: 'stop' | 'length';
  metadata: Record<string, unknown>;
}

/** AI Search Result */
export interface AISearchResult {
  response: AIResponse;
  fromCache: boolean;
  processingTimeMs: number;
  similarity?: number;
}

/** Streaming prediction result */
export interface StreamingPredictionResult {
  sessionId: string;
  predictions: string[];
  confidence: number;
}

export interface StreamingChunk {
  sessionId: string;
  content: string;
  isComplete: boolean;
  timestamp: number;
}

export interface PredictionState {
  sessionId: string;
  partialQuery: string;
  predictions: string[];
  confidence: number;
  lastUpdated: number;
}

interface CacheEntry {
  query: string;
  tokens: string[];
  response: AIResponse;
  createdAt: number;
  topics?: string[];
}

interface ShadowEvaluationResult {
  driftScore: number;
  detected: boolean;
  reason: 'none' | 'shadow_drift_exceeded';
  shadowModelVersion: string;
}

class SemanticCache {
  private readonly entries: CacheEntry[] = [];

  constructor(
    private readonly similarityThreshold: number,
    private readonly ttlMs: number,
    private readonly maxEntries: number
  ) {}

  getCachedResponse(tokens: string[]): { response: AIResponse; similarity: number } | null {
    const now = Date.now();
    this.evictExpired(now);

    let best: { entry: CacheEntry; similarity: number } | null = null;

    for (const entry of this.entries) {
      const similarity = jaccardSimilarity(tokens, entry.tokens);
      if (similarity >= this.similarityThreshold) {
        if (!best || similarity > best.similarity) {
          best = { entry, similarity };
        }
      }
    }

    return best ? { response: best.entry.response, similarity: best.similarity } : null;
  }

  cacheResponse(query: string, tokens: string[], response: AIResponse, topics?: string[]) {
    this.entries.unshift({ query, tokens, response, createdAt: Date.now(), topics });
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }
  }

  invalidateByTopic(topic: string): number {
    const before = this.entries.length;
    const filtered = this.entries.filter((entry) => !(entry.topics || []).includes(topic));
    this.entries.length = 0;
    this.entries.push(...filtered);
    return before - filtered.length;
  }

  stats() {
    return {
      entries: this.entries.length,
      ttlMs: this.ttlMs,
      similarityThreshold: this.similarityThreshold,
    };
  }

  private evictExpired(now: number) {
    const cutoff = now - this.ttlMs;
    while (this.entries.length > 0 && this.entries[this.entries.length - 1].createdAt < cutoff) {
      this.entries.pop();
    }
  }
}

class EmbeddingCache {
  private readonly map = new Map<string, Float32Array>();
  constructor(private readonly maxEntries: number) {}

  get(key: string): Float32Array | null {
    const value = this.map.get(key);
    if (!value) {
      return null;
    }
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: Float32Array): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest) {
        this.map.delete(oldest);
      }
    }
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

@Injectable()
export class AISearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AISearchService.name);
  private readonly semanticCache = new SemanticCache(0.82, 1000 * 60 * 60 * 24, 5000);
  private readonly predictionSessions = new Map<string, PredictionState>();
  private readonly embeddingCache = new EmbeddingCache(2000);
  private embedder: OnnxEmbedder | null = null;
  private canaryEmbedder: OnnxEmbedder | null = null;
  private isInitialized = false;
  private modelVersion = 'unversioned';
  private canaryModelVersion = 'none';
  private previousModelVersion = process.env.AI_PREVIOUS_MODEL_VERSION ?? 'none';
  private canaryTrafficPercent = clampPercent(process.env.AI_MODEL_CANARY_PERCENT);
  private readonly shadowDriftThreshold = Number(process.env.AI_SHADOW_DRIFT_THRESHOLD ?? 0.45);
  private readonly shadowWindowSize = Number(process.env.AI_SHADOW_DRIFT_WINDOW_SIZE ?? 20);
  private readonly driftWindow: number[] = [];
  private rollbackTriggered = false;
  private driftBlocked = false;

  constructor(
    private readonly productSearchService: ProductSearchService,
    @Optional() private readonly structuredLogger?: LoggingService,
    @Optional() private readonly metricsService?: MetricsService
  ) {}

  async onModuleInit() {
    const embeddingEnabled = process.env.AI_EMBEDDING_ENABLED !== 'false';
    if (embeddingEnabled) {
      const requireContract = process.env.AI_EMBEDDING_REQUIRE_CONTRACT === 'true';
      const contractPath =
        process.env.AI_EMBEDDING_CONTRACT_PATH ??
        path.join('ops', 'assets', 'ai', 'models', 'model.contract.json');

      const resolvedContractPath = resolvePath(contractPath);
      let modelPath = process.env.AI_EMBEDDING_MODEL_PATH;
      let tokenizerPath = process.env.AI_EMBEDDING_TOKENIZER_PATH;

      if (fs.existsSync(resolvedContractPath)) {
        const verified = verifyModelContract({
          contractPath: resolvedContractPath,
          strictSignature: process.env.AI_EMBEDDING_STRICT_SIGNATURE === 'true',
          signaturePublicKeyPem: process.env.MODEL_CONTRACT_PUBLIC_KEY_PEM,
        });
        this.modelVersion = verified.contract.modelVersion;
        modelPath = modelPath ?? verified.artifactPath;
        tokenizerPath =
          tokenizerPath ??
          verified.tokenizerPath ??
          path.join(path.dirname(verified.artifactPath), 'tokenizer.json');
      } else if (requireContract) {
        throw new Error(`AI embedding contract is required but missing: ${resolvedContractPath}`);
      } else {
        this.logger.warn(`AI model contract missing (non-strict mode): ${resolvedContractPath}`);
      }

      modelPath = modelPath ?? path.join('public', 'models', 'ai', 'all-MiniLM-L6-v2.onnx');
      tokenizerPath = tokenizerPath ?? path.join('public', 'models', 'ai', 'tokenizer.json');
      const tokenizerConfigPath =
        process.env.AI_EMBEDDING_TOKENIZER_CONFIG_PATH ??
        path.join(path.dirname(tokenizerPath), 'tokenizer_config.json');
      const maxLength = Number(process.env.AI_EMBEDDING_MAX_LEN ?? 128);

      this.embedder = new OnnxEmbedder({
        modelPath,
        tokenizerPath,
        tokenizerConfigPath,
        maxLength: Number.isFinite(maxLength) ? maxLength : 128,
        normalize: true,
      });
      await this.embedder.ready();
      this.logger.log('AI Embedding engine loaded');
      await this.initializeCanaryEmbedder();
    } else {
      this.logger.warn('AI embedding disabled via AI_EMBEDDING_ENABLED=false');
    }
    this.isInitialized = true;
    this.logger.log('AI Search Service initialized');
  }

  async onModuleDestroy() {
    this.predictionSessions.clear();
  }

  /**
   * Search with semantic caching
   */
  async search(query: AISearchQuery): Promise<AISearchResult> {
    const startTime = Date.now();
    if (!this.isInitialized) {
      throw new Error('AI Search Service not initialized');
    }
    if (this.driftBlocked) {
      throw new ServiceUnavailableException('AI inference blocked by drift guard');
    }
    const cleanedQuery = query.query.trim();
    if (!cleanedQuery) {
      throw new BadRequestException('query is required');
    }

    const tokens = tokenize(cleanedQuery);
    if (query.useCache !== false) {
      const cached = this.semanticCache.getCachedResponse(tokens);
      if (cached) {
        const latencyMs = Date.now() - startTime;
        this.recordInferenceAudit({
          query: cleanedQuery,
          response: cached.response,
          fromCache: true,
          latencyMs,
          topConfidence: cached.similarity,
        });
        return {
          response: cached.response,
          fromCache: true,
          processingTimeMs: latencyMs,
          similarity: cached.similarity,
        };
      }
    }

    const searchResult = await this.productSearchService.search({
      query: cleanedQuery,
      limit: 10,
    });

    const traceSeed =
      query.sessionId || getCurrentCorrelationContext()?.traceId || cleanedQuery || `${Date.now()}`;
    const useCanary = this.shouldRouteCanary(traceSeed);
    const primaryModelVersion = useCanary ? this.canaryModelVersion : this.modelVersion;
    const primaryEmbedder = useCanary ? this.canaryEmbedder : this.embedder;
    const shadowEmbedder = useCanary ? this.embedder : this.canaryEmbedder;
    const shadowModelVersion = useCanary ? this.modelVersion : this.canaryModelVersion;

    const rankedHits = primaryEmbedder
      ? await this.rankByEmbedding(
          cleanedQuery,
          searchResult.hits,
          primaryEmbedder,
          primaryModelVersion
        )
      : searchResult.hits;

    const shadowHits = shadowEmbedder
      ? await this.rankByEmbedding(
          cleanedQuery,
          searchResult.hits,
          shadowEmbedder,
          shadowModelVersion
        )
      : searchResult.hits;
    const shadowEvaluation = this.evaluateShadowDrift(rankedHits, shadowHits, shadowModelVersion);
    this.updateShadowDriftWindow(shadowEvaluation.driftScore);
    if (shadowEvaluation.detected) {
      await this.onDriftDetected({
        traceSeed,
        primaryModelVersion,
        shadowModelVersion: shadowEvaluation.shadowModelVersion,
        driftScore: shadowEvaluation.driftScore,
      });
      if (process.env.AI_DRIFT_FAIL_CLOSED === 'true') {
        throw new ServiceUnavailableException('AI inference blocked: drift threshold exceeded');
      }
    }

    const response = this.buildResponse(cleanedQuery, rankedHits, searchResult.suggestions);
    this.semanticCache.cacheResponse(cleanedQuery, tokens, response, query.topics);
    const latencyMs = Date.now() - startTime;
    this.recordInferenceAudit({
      query: cleanedQuery,
      response,
      fromCache: false,
      latencyMs,
      topConfidence: rankedHits[0]?.similarity,
      modelVersion: primaryModelVersion,
      shadowEvaluation,
    });

    return {
      response,
      fromCache: false,
      processingTimeMs: latencyMs,
    };
  }

  /**
   * Start streaming predictions
   */
  async startPrediction(
    partialQuery: string,
    sessionId: string
  ): Promise<StreamingPredictionResult> {
    const predictions = await this.productSearchService.getSuggestions(partialQuery, 5);
    const confidence = Math.min(1, predictions.length / 5);
    const state: PredictionState = {
      sessionId,
      partialQuery,
      predictions,
      confidence,
      lastUpdated: Date.now(),
    };
    this.predictionSessions.set(sessionId, state);

    return { sessionId, predictions, confidence };
  }

  /**
   * Update prediction with streaming chunk
   */
  async updatePrediction(sessionId: string, chunk: StreamingChunk): Promise<void> {
    const state = this.predictionSessions.get(sessionId);
    const partialQuery = state ? `${state.partialQuery}${chunk.content}` : chunk.content;
    const predictions = await this.productSearchService.getSuggestions(partialQuery, 5);
    const confidence = Math.min(1, predictions.length / 5);

    this.predictionSessions.set(sessionId, {
      sessionId,
      partialQuery,
      predictions,
      confidence,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Finalize prediction and get merged response
   */
  async finalizePrediction(sessionId: string, finalQuery: string): Promise<AIResponse> {
    this.predictionSessions.delete(sessionId);
    const result = await this.search({ query: finalQuery, useCache: true });
    return result.response;
  }

  /**
   * Cancel prediction session
   */
  async cancelPrediction(sessionId: string): Promise<void> {
    this.predictionSessions.delete(sessionId);
  }

  /**
   * Get prediction state
   */
  async getPredictionState(sessionId: string): Promise<PredictionState | null> {
    return this.predictionSessions.get(sessionId) ?? null;
  }

  /**
   * Invalidate cache entries by topic
   */
  async invalidateByTopic(topic: string): Promise<number> {
    const count = this.semanticCache.invalidateByTopic(topic);
    this.logger.log(`Invalidated ${count} cache entries for topic: ${topic}`);
    return count;
  }

  async invalidateProductCache(productId: string): Promise<void> {
    await this.invalidateByTopic(`product:${productId}`);
    await this.invalidateByTopic('products');
  }

  async invalidateCategoryCache(categoryId: string): Promise<void> {
    await this.invalidateByTopic(`category:${categoryId}`);
    await this.invalidateByTopic('categories');
  }

  async getCacheStats() {
    return this.semanticCache.stats();
  }

  async calculateSimilarity(query1: string, query2: string): Promise<number> {
    return jaccardSimilarity(tokenize(query1), tokenize(query2));
  }

  isHealthy(): boolean {
    return this.isInitialized;
  }

  private recordInferenceAudit(params: {
    query: string;
    response: AIResponse;
    fromCache: boolean;
    latencyMs: number;
    topConfidence?: number;
    modelVersion?: string;
    shadowEvaluation?: ShadowEvaluationResult;
  }): void {
    const correlation = getCurrentCorrelationContext();
    const promptHash = sha256Hex(params.query);
    const outputHash = sha256Hex(params.response.content);
    const confidenceScore =
      typeof params.topConfidence === 'number' && Number.isFinite(params.topConfidence)
        ? params.topConfidence
        : 0;

    const modelVersion = params.modelVersion ?? this.modelVersion;
    const shadow = params.shadowEvaluation;

    this.metricsService?.aiInferenceTotal.inc({
      model_version: modelVersion,
      outcome: 'ok',
      cache: params.fromCache ? 'hit' : 'miss',
    });
    this.metricsService?.aiInferenceLatency.observe(
      { model_version: modelVersion, cache: params.fromCache ? 'hit' : 'miss' },
      params.latencyMs / 1000
    );
    if (shadow) {
      this.metricsService?.aiShadowEvalTotal.inc({
        model_version: modelVersion,
        shadow_model_version: shadow.shadowModelVersion,
        outcome: shadow.detected ? 'drift' : 'healthy',
      });
      this.metricsService?.aiDriftScore.observe(
        {
          model_version: modelVersion,
          shadow_model_version: shadow.shadowModelVersion,
        },
        shadow.driftScore
      );
    }

    this.structuredLogger?.log('ai.search.inference.completed', AISearchService.name, {
      traceId: correlation?.traceId,
      modelVersion,
      inferenceLatencyMs: params.latencyMs,
      confidenceScore,
      promptHash,
      inputHash: promptHash,
      outputHash,
      tokenUsage: params.response.tokens,
      cache: params.fromCache ? 'hit' : 'miss',
      guardReason: confidenceScore < 0.01 ? 'low_similarity' : 'none',
      shadowModelVersion: shadow?.shadowModelVersion ?? 'none',
      driftScore: shadow?.driftScore ?? 0,
      driftDetected: shadow?.detected ?? false,
    });
  }

  private buildResponse(
    query: string,
    hits: Array<{
      id: string;
      name: string;
      price: number;
      images?: string[];
      score?: number;
      similarity?: number;
    }>,
    suggestions?: string[]
  ): AIResponse {
    const lines: string[] = [];
    lines.push(`نتایج مرتبط برای «${query}»`);

    if (hits.length === 0) {
      lines.push('هیچ نتیجه دقیقی پیدا نشد.');
    } else {
      hits.slice(0, 5).forEach((hit, index) => {
        const price = Number.isFinite(hit.price)
          ? `${Math.round(hit.price).toLocaleString('fa-IR')} ریال`
          : 'قیمت نامشخص';
        const score = hit.similarity ? ` (شباهت: ${(hit.similarity * 100).toFixed(1)}٪)` : '';
        lines.push(`${index + 1}. ${hit.name} — ${price}${score}`);
      });
    }

    if (suggestions && suggestions.length > 0) {
      lines.push(`پیشنهاد جستجو: ${suggestions.join('، ')}`);
    }

    return {
      content: lines.join('\n'),
      model: 'semantic-ranking-v1',
      tokens: tokenize(query).length * 2 + hits.length * 6,
      finishReason: 'stop',
      metadata: {
        query,
        hitCount: hits.length,
        suggestions: suggestions ?? [],
        topHits: hits.slice(0, 5).map((hit) => ({
          id: hit.id,
          name: hit.name,
          price: hit.price,
          similarity: hit.similarity,
          images: hit.images ?? [],
        })),
      },
    };
  }

  private async rankByEmbedding(
    query: string,
    hits: Array<{
      id: string;
      name: string;
      description?: string;
      price: number;
      images?: string[];
    }>,
    embedder: OnnxEmbedder,
    modelVersion: string
  ) {
    const queryVector = await embedder.embed(query);

    const scored = await Promise.all(
      hits.map(async (hit) => {
        const text = `${hit.name}\n${hit.description ?? ''}`.trim();
        const cacheKey = `product:${modelVersion}:${hit.id}`;
        let vector = this.embeddingCache.get(cacheKey);
        if (!vector) {
          vector = await embedder.embed(text);
          this.embeddingCache.set(cacheKey, vector);
        }
        const similarity = cosineSimilarity(queryVector, vector);
        return { ...hit, similarity };
      })
    );

    return scored.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }

  private shouldRouteCanary(seed: string): boolean {
    if (!this.canaryEmbedder || this.canaryTrafficPercent <= 0) {
      return false;
    }
    const bucket = stableBucket(seed);
    return bucket < this.canaryTrafficPercent;
  }

  private evaluateShadowDrift(
    primaryHits: Array<{ id: string }>,
    shadowHits: Array<{ id: string }>,
    shadowModelVersion: string
  ): ShadowEvaluationResult {
    const topK = 3;
    const primaryTop = primaryHits.slice(0, topK).map((hit) => hit.id);
    const shadowTop = shadowHits.slice(0, topK).map((hit) => hit.id);
    const overlap = primaryTop.filter((id) => shadowTop.includes(id)).length / Math.max(1, topK);
    const driftScore = 1 - overlap;
    const detected = driftScore > this.shadowDriftThreshold;
    return {
      driftScore,
      detected,
      reason: detected ? 'shadow_drift_exceeded' : 'none',
      shadowModelVersion,
    };
  }

  private updateShadowDriftWindow(driftScore: number): void {
    this.driftWindow.push(driftScore);
    if (this.driftWindow.length > this.shadowWindowSize) {
      this.driftWindow.shift();
    }
  }

  private async onDriftDetected(params: {
    traceSeed: string;
    primaryModelVersion: string;
    shadowModelVersion: string;
    driftScore: number;
  }): Promise<void> {
    const avgDrift =
      this.driftWindow.length > 0
        ? this.driftWindow.reduce((sum, item) => sum + item, 0) / this.driftWindow.length
        : params.driftScore;
    if (avgDrift <= this.shadowDriftThreshold) {
      return;
    }

    this.structuredLogger?.warn('ai.search.drift.detected', AISearchService.name, {
      traceId: getCurrentCorrelationContext()?.traceId,
      driftScore: params.driftScore,
      averageDriftScore: avgDrift,
      primaryModelVersion: params.primaryModelVersion,
      shadowModelVersion: params.shadowModelVersion,
      threshold: this.shadowDriftThreshold,
    });

    if (this.rollbackTriggered) {
      return;
    }
    this.rollbackTriggered = true;
    this.metricsService?.aiAutoRollbackTotal.inc({
      model_version: params.primaryModelVersion,
      reason: 'shadow_drift_exceeded',
    });

    this.canaryEmbedder = null;
    this.canaryTrafficPercent = 0;

    const rollbackScript =
      process.env.AI_AUTO_ROLLBACK_SCRIPT_PATH ||
      path.join('scripts', 'ai', 'auto-rollback-model.mjs');
    try {
      execFileSync('node', [rollbackScript], {
        stdio: 'pipe',
        env: {
          ...process.env,
          AI_ROLLBACK_REASON: 'shadow_drift_exceeded',
          AI_ROLLBACK_TRACE_ID: params.traceSeed,
          AI_ROLLBACK_TARGET_VERSION: this.previousModelVersion,
        },
      });
      this.structuredLogger?.warn('ai.search.auto.rollback.executed', AISearchService.name, {
        traceId: params.traceSeed,
        rollbackTargetVersion: this.previousModelVersion,
      });
    } catch (error) {
      this.structuredLogger?.error(
        'ai.search.auto.rollback.failed',
        error instanceof Error ? error : new Error('rollback_failed'),
        AISearchService.name,
        {
          traceId: params.traceSeed,
          rollbackScript,
        }
      );
    }

    if (process.env.AI_DRIFT_FAIL_CLOSED === 'true') {
      this.driftBlocked = true;
    }
  }

  private async initializeCanaryEmbedder(): Promise<void> {
    if (this.canaryTrafficPercent <= 0) {
      return;
    }

    const contractPath =
      process.env.AI_CANARY_EMBEDDING_CONTRACT_PATH ??
      path.join('ops', 'assets', 'ai', 'models', 'model.contract.json');
    const resolvedContractPath = resolvePath(contractPath);
    if (!fs.existsSync(resolvedContractPath)) {
      this.logger.warn(`AI canary contract missing: ${resolvedContractPath}`);
      return;
    }

    const verified = verifyModelContract({
      contractPath: resolvedContractPath,
      strictSignature: process.env.AI_CANARY_EMBEDDING_STRICT_SIGNATURE === 'true',
      signaturePublicKeyPem: process.env.MODEL_CONTRACT_PUBLIC_KEY_PEM,
    });
    this.canaryModelVersion = verified.contract.modelVersion;

    const canary = new OnnxEmbedder({
      modelPath:
        process.env.AI_CANARY_EMBEDDING_MODEL_PATH ??
        verified.artifactPath ??
        path.join('public', 'models', 'ai', 'all-MiniLM-L6-v2.onnx'),
      tokenizerPath:
        process.env.AI_CANARY_EMBEDDING_TOKENIZER_PATH ??
        verified.tokenizerPath ??
        path.join('public', 'models', 'ai', 'tokenizer.json'),
      tokenizerConfigPath:
        process.env.AI_CANARY_EMBEDDING_TOKENIZER_CONFIG_PATH ??
        path.join(
          path.dirname(verified.tokenizerPath ?? verified.artifactPath),
          'tokenizer_config.json'
        ),
      maxLength: Number(
        process.env.AI_CANARY_EMBEDDING_MAX_LEN ?? process.env.AI_EMBEDDING_MAX_LEN ?? 128
      ),
      normalize: true,
    });
    await canary.ready();
    this.canaryEmbedder = canary;
    this.logger.log(
      `AI canary embedding engine loaded (${this.canaryModelVersion}) with traffic=${this.canaryTrafficPercent}%`
    );
  }
}

function resolvePath(inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function stableBucket(seed: string): number {
  const digest = sha256Hex(seed);
  const head = digest.slice(0, 8);
  const value = Number.parseInt(head, 16);
  return Number.isFinite(value) ? value % 100 : 0;
}

function clampPercent(input: string | undefined): number {
  const value = Number(input ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / Math.sqrt(normA * normB);
}

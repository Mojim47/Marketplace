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

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ProductSearchService } from "../products/product-search.service";
import { OnnxEmbedder } from "@nextgen/ai";
import path from "node:path";

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
  finishReason: "stop" | "length";
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

class SemanticCache {
  private readonly entries: CacheEntry[] = [];

  constructor(
    private readonly similarityThreshold: number,
    private readonly ttlMs: number,
    private readonly maxEntries: number,
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
    if (!value) return null;
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
      if (oldest) this.map.delete(oldest);
    }
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
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
  private isInitialized = false;

  constructor(private readonly productSearchService: ProductSearchService) {}

  async onModuleInit() {
    const embeddingEnabled = process.env.AI_EMBEDDING_ENABLED !== "false";
    if (embeddingEnabled) {
      const modelPath =
        process.env.AI_EMBEDDING_MODEL_PATH ??
        path.join("public", "models", "ai", "all-MiniLM-L6-v2.onnx");
      const tokenizerPath =
        process.env.AI_EMBEDDING_TOKENIZER_PATH ??
        path.join("public", "models", "ai", "tokenizer.json");
      const tokenizerConfigPath =
        process.env.AI_EMBEDDING_TOKENIZER_CONFIG_PATH ??
        path.join("public", "models", "ai", "tokenizer_config.json");
      const maxLength = Number(process.env.AI_EMBEDDING_MAX_LEN ?? 128);

      this.embedder = new OnnxEmbedder({
        modelPath,
        tokenizerPath,
        tokenizerConfigPath,
        maxLength: Number.isFinite(maxLength) ? maxLength : 128,
        normalize: true,
      });
      await this.embedder.ready();
      this.logger.log("AI Embedding engine loaded");
    } else {
      this.logger.warn("AI embedding disabled via AI_EMBEDDING_ENABLED=false");
    }
    this.isInitialized = true;
    this.logger.log("AI Search Service initialized");
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
      throw new Error("AI Search Service not initialized");
    }

    const tokens = tokenize(query.query);
    if (query.useCache !== false) {
      const cached = this.semanticCache.getCachedResponse(tokens);
      if (cached) {
        return {
          response: cached.response,
          fromCache: true,
          processingTimeMs: Date.now() - startTime,
          similarity: cached.similarity,
        };
      }
    }

    const searchResult = await this.productSearchService.search({
      query: query.query,
      limit: 10,
    });

    const rankedHits = this.embedder
      ? await this.rankByEmbedding(query.query, searchResult.hits)
      : searchResult.hits;

    const response = this.buildResponse(query.query, rankedHits, searchResult.suggestions);
    this.semanticCache.cacheResponse(query.query, tokens, response, query.topics);

    return {
      response,
      fromCache: false,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Start streaming predictions
   */
  async startPrediction(partialQuery: string, sessionId: string): Promise<StreamingPredictionResult> {
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
    await this.invalidateByTopic("products");
  }

  async invalidateCategoryCache(categoryId: string): Promise<void> {
    await this.invalidateByTopic(`category:${categoryId}`);
    await this.invalidateByTopic("categories");
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

  private buildResponse(
    query: string,
    hits: Array<{ id: string; name: string; price: number; images?: string[]; score?: number; similarity?: number }>,
    suggestions?: string[],
  ): AIResponse {
    const lines: string[] = [];
    lines.push(`نتایج مرتبط برای «${query}»`);

    if (hits.length === 0) {
      lines.push("هیچ نتیجه دقیقی پیدا نشد.");
    } else {
      hits.slice(0, 5).forEach((hit, index) => {
        const price = Number.isFinite(hit.price) ? `${Math.round(hit.price).toLocaleString("fa-IR")} ریال` : "قیمت نامشخص";
        const score = hit.similarity ? ` (شباهت: ${(hit.similarity * 100).toFixed(1)}٪)` : "";
        lines.push(`${index + 1}. ${hit.name} — ${price}${score}`);
      });
    }

    if (suggestions && suggestions.length > 0) {
      lines.push("پیشنهاد جستجو: " + suggestions.join("، "));
    }

    return {
      content: lines.join("\n"),
      model: "semantic-ranking-v1",
      tokens: tokenize(query).length * 2 + hits.length * 6,
      finishReason: "stop",
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
    hits: Array<{ id: string; name: string; description?: string; price: number; images?: string[] }>,
  ) {
    if (!this.embedder) return hits;
    const queryVector = await this.embedder.embed(query);

    const scored = await Promise.all(
      hits.map(async (hit) => {
        const text = `${hit.name}\n${hit.description ?? ""}`.trim();
        const cacheKey = `product:${hit.id}`;
        let vector = this.embeddingCache.get(cacheKey);
        if (!vector) {
          vector = await this.embedder!.embed(text);
          this.embeddingCache.set(cacheKey, vector);
        }
        const similarity = cosineSimilarity(queryVector, vector);
        return { ...hit, similarity };
      }),
    );

    return scored.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }
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
  if (!normA || !normB) return 0;
  return dot / Math.sqrt(normA * normB);
}

// ═══════════════════════════════════════════════════════════════════════════
// Vector Store - Qdrant Integration for 4096-Dimensional Code Embeddings
// ═══════════════════════════════════════════════════════════════════════════

import { QdrantClient } from '@qdrant/js-client-rest';
import { CodeEmbedding, EmbeddingType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface VectorSearchResult {
  id: string;
  score: number;
  embedding: CodeEmbedding;
}

export interface SearchQuery {
  vector?: number[];
  filter?: Record<string, any>;
  limit?: number;
  threshold?: number;
}

export class VectorStore {
  private client: QdrantClient;
  private collectionName: string;
  private readonly dimensions = 4096;

  constructor(
    url: string = 'http://localhost:6333',
    collectionName: string = 'enterprise_serta_embeddings'
  ) {
    this.client = new QdrantClient({ url });
    this.collectionName = collectionName;
  }

  async initialize(): Promise<void> {
    console.log('🗄️ Initializing vector store...');

    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        // Create collection with optimized settings for code embeddings
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.dimensions,
            distance: 'Cosine', // Cosine similarity for semantic similarity
            on_disk: true // Store vectors on disk for large datasets
          },
          optimizers_config: {
            default_segment_number: 2,
            max_segment_size: 20000,
            memmap_threshold: 50000,
            indexing_threshold: 10000,
            flush_interval_sec: 30,
            max_optimization_threads: 2
          },
          hnsw_config: {
            m: 16, // Number of bi-directional links for each node
            ef_construct: 200, // Size of the dynamic candidate list
            full_scan_threshold: 10000,
            max_indexing_threads: 2,
            on_disk: true
          }
        });

        console.log(`✅ Created collection: ${this.collectionName}`);
      } else {
        console.log(`✅ Collection already exists: ${this.collectionName}`);
      }

      // Create indexes for efficient filtering
      await this.createIndexes();

    } catch (error) {
      console.error('❌ Error initializing vector store:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // Create payload indexes for efficient filtering
      const indexes = [
        { field: 'fileId', type: 'keyword' },
        { field: 'type', type: 'keyword' },
        { field: 'metadata.fileName', type: 'keyword' },
        { field: 'metadata.functionName', type: 'keyword' },
        { field: 'metadata.className', type: 'keyword' },
        { field: 'metadata.securityRelevance', type: 'integer' },
        { field: 'metadata.businessCriticality', type: 'integer' },
        { field: 'metadata.complexity', type: 'integer' },
        { field: 'metadata.trustBoundary', type: 'bool' },
        { field: 'createdAt', type: 'datetime' }
      ];

      for (const index of indexes) {
        try {
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: index.field,
            field_schema: index.type as any
          });
        } catch (error) {
          // Index might already exist, continue
          console.warn(`⚠️ Index creation warning for ${index.field}:`, error);
        }
      }

      console.log('✅ Created payload indexes');
    } catch (error) {
      console.warn('⚠️ Error creating indexes:', error);
    }
  }

  async storeEmbeddings(embeddings: CodeEmbedding[]): Promise<void> {
    if (embeddings.length === 0) return;

    console.log(`💾 Storing ${embeddings.length} embeddings...`);

    try {
      // Prepare points for batch upsert
      const points = embeddings.map(embedding => ({
        id: uuidv4(),
        vector: embedding.vector,
        payload: {
          embeddingId: embedding.id,
          fileId: embedding.fileId,
          type: embedding.type,
          metadata: embedding.metadata,
          createdAt: embedding.createdAt.toISOString()
        }
      }));

      // Batch upsert with chunking for large datasets
      const chunkSize = 100;
      for (let i = 0; i < points.length; i += chunkSize) {
        const chunk = points.slice(i, i + chunkSize);
        await this.client.upsert(this.collectionName, {
          wait: true,
          points: chunk
        });
      }

      console.log(`✅ Stored ${embeddings.length} embeddings`);
    } catch (error) {
      console.error('❌ Error storing embeddings:', error);
      throw error;
    }
  }

  async searchSimilar(query: SearchQuery): Promise<VectorSearchResult[]> {
    try {
      const searchParams: any = {
        limit: query.limit || 10,
        with_payload: true,
        with_vector: false
      };

      if (query.vector) {
        searchParams.vector = query.vector;
      }

      if (query.filter) {
        searchParams.filter = this.buildQdrantFilter(query.filter);
      }

      if (query.threshold) {
        searchParams.score_threshold = query.threshold;
      }

      const results = await this.client.search(this.collectionName, searchParams);

      return results.map(result => ({
        id: result.id as string,
        score: result.score,
        embedding: this.payloadToEmbedding(result.payload as any)
      }));
    } catch (error) {
      console.error('❌ Error searching embeddings:', error);
      throw error;
    }
  }

  async findSimilarSecurityPatterns(
    embedding: CodeEmbedding,
    limit: number = 20
  ): Promise<VectorSearchResult[]> {
    return this.searchSimilar({
      vector: embedding.vector,
      filter: {
        type: EmbeddingType.SECURITY_PATTERN,
        'metadata.securityRelevance': { gte: 5 }
      },
      limit,
      threshold: 0.7
    });
  }

  async findSimilarBusinessLogic(
    embedding: CodeEmbedding,
    limit: number = 15
  ): Promise<VectorSearchResult[]> {
    return this.searchSimilar({
      vector: embedding.vector,
      filter: {
        type: EmbeddingType.BUSINESS_LOGIC,
        'metadata.businessCriticality': { gte: 5 }
      },
      limit,
      threshold: 0.6
    });
  }

  async findTrustBoundaryViolations(
    embedding: CodeEmbedding,
    limit: number = 10
  ): Promise<VectorSearchResult[]> {
    return this.searchSimilar({
      vector: embedding.vector,
      filter: {
        'metadata.trustBoundary': true,
        'metadata.securityRelevance': { gte: 7 }
      },
      limit,
      threshold: 0.8
    });
  }

  async findComplexFunctions(
    minComplexity: number = 8,
    limit: number = 25
  ): Promise<VectorSearchResult[]> {
    return this.searchSimilar({
      filter: {
        type: EmbeddingType.SEMANTIC_CODE,
        'metadata.complexity': { gte: minComplexity },
        'metadata.functionName': { exists: true }
      },
      limit
    });
  }

  async findCriticalDependencies(
    limit: number = 20
  ): Promise<VectorSearchResult[]> {
    return this.searchSimilar({
      filter: {
        type: EmbeddingType.DEPENDENCY_FLOW,
        'metadata.securityRelevance': { gte: 6 }
      },
      limit
    });
  }

  async getEmbeddingsByFile(fileId: string): Promise<VectorSearchResult[]> {
    return this.searchSimilar({
      filter: { fileId },
      limit: 100
    });
  }

  async getEmbeddingsByType(type: EmbeddingType): Promise<VectorSearchResult[]> {
    return this.searchSimilar({
      filter: { type },
      limit: 1000
    });
  }

  async deleteEmbeddingsByFile(fileId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'fileId',
              match: { value: fileId }
            }
          ]
        }
      });
      console.log(`🗑️ Deleted embeddings for file: ${fileId}`);
    } catch (error) {
      console.error('❌ Error deleting embeddings:', error);
      throw error;
    }
  }

  async getCollectionInfo(): Promise<{
    pointsCount: number;
    indexedVectorsCount: number;
    memoryUsage: number;
    diskUsage: number;
  }> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        pointsCount: info.points_count || 0,
        indexedVectorsCount: info.indexed_vectors_count || 0,
        memoryUsage: 0, // Qdrant doesn't provide this directly
        diskUsage: 0    // Qdrant doesn't provide this directly
      };
    } catch (error) {
      console.error('❌ Error getting collection info:', error);
      return {
        pointsCount: 0,
        indexedVectorsCount: 0,
        memoryUsage: 0,
        diskUsage: 0
      };
    }
  }

  async performClusterAnalysis(
    embeddingType: EmbeddingType,
    numClusters: number = 10
  ): Promise<Array<{
    clusterId: number;
    centroid: number[];
    members: VectorSearchResult[];
    riskScore: number;
  }>> {
    // This is a simplified clustering implementation
    // In production, you'd use more sophisticated clustering algorithms
    
    const embeddings = await this.getEmbeddingsByType(embeddingType);
    
    if (embeddings.length < numClusters) {
      return [];
    }

    // Simple k-means clustering (simplified)
    const clusters: Array<{
      clusterId: number;
      centroid: number[];
      members: VectorSearchResult[];
      riskScore: number;
    }> = [];

    // Initialize centroids randomly
    for (let i = 0; i < numClusters; i++) {
      const randomEmbedding = embeddings[Math.floor(Math.random() * embeddings.length)];
      clusters.push({
        clusterId: i,
        centroid: [...randomEmbedding.embedding.vector],
        members: [],
        riskScore: 0
      });
    }

    // Assign embeddings to nearest centroids
    for (const embedding of embeddings) {
      let nearestCluster = 0;
      let minDistance = Infinity;

      for (let i = 0; i < clusters.length; i++) {
        const distance = this.cosineSimilarity(
          embedding.embedding.vector,
          clusters[i].centroid
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = i;
        }
      }

      clusters[nearestCluster].members.push(embedding);
    }

    // Calculate risk scores for each cluster
    for (const cluster of clusters) {
      if (cluster.members.length > 0) {
        cluster.riskScore = cluster.members.reduce((sum, member) => 
          sum + (member.embedding.metadata.securityRelevance || 0), 0
        ) / cluster.members.length;
      }
    }

    return clusters.sort((a, b) => b.riskScore - a.riskScore);
  }

  private buildQdrantFilter(filter: Record<string, any>): any {
    const conditions: any[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        // Handle range queries
        if (value.gte !== undefined) {
          conditions.push({
            key,
            range: { gte: value.gte }
          });
        } else if (value.lte !== undefined) {
          conditions.push({
            key,
            range: { lte: value.lte }
          });
        } else if (value.exists !== undefined) {
          // Handle existence queries
          conditions.push({
            key,
            match: { any: [null] }
          });
        }
      } else {
        // Handle exact matches
        conditions.push({
          key,
          match: { value }
        });
      }
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  private payloadToEmbedding(payload: any): CodeEmbedding {
    return {
      id: payload.embeddingId,
      fileId: payload.fileId,
      type: payload.type,
      vector: [], // Vector not included in search results by default
      metadata: payload.metadata,
      createdAt: new Date(payload.createdAt)
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async cleanup(): Promise<void> {
    try {
      // Optimize collection
      await this.client.updateCollection(this.collectionName, {
        optimizers_config: {
          deleted_threshold: 0.2,
          vacuum_min_vector_number: 1000,
          default_segment_number: 2,
          max_segment_size: 20000,
          memmap_threshold: 50000,
          indexing_threshold: 10000,
          flush_interval_sec: 30,
          max_optimization_threads: 2
        }
      });
      console.log('✅ Collection optimized');
    } catch (error) {
      console.warn('⚠️ Error optimizing collection:', error);
    }
  }

  async close(): Promise<void> {
    // Qdrant client doesn't need explicit closing
    console.log('✅ Vector store connection closed');
  }
}
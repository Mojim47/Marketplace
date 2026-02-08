// ═══════════════════════════════════════════════════════════════════════════
// In-Memory Search Adapter
// ═══════════════════════════════════════════════════════════════════════════
// For testing and development - implements full search interface in memory
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ISearchProvider,
  SearchSchema,
  SearchQuery,
  SearchResult,
  SearchHit,
  FilterCondition,
  AggregationQuery,
  AggregationResult,
  Suggestion,
  IndexStats,
  SearchHealthCheck,
  MemorySearchConfig,
} from '../interfaces/search.interface';
import { SearchProviderType, FilterOperator, AggregationType } from '../interfaces/search.interface';

interface IndexData {
  schema: SearchSchema;
  documents: Map<string, Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory search adapter for testing and development
 */
export class MemorySearchAdapter implements ISearchProvider {
  readonly providerType = SearchProviderType.MEMORY;

  private readonly indices: Map<string, IndexData> = new Map();
  private readonly indexPrefix: string;

  constructor(config: MemorySearchConfig) {
    this.indexPrefix = config.indexPrefix || '';
  }

  private getFullIndexName(index: string): string {
    return this.indexPrefix ? `${this.indexPrefix}_${index}` : index;
  }

  private getIndex(index: string): IndexData {
    const fullName = this.getFullIndexName(index);
    const data = this.indices.get(fullName);
    if (!data) {
      throw new Error(`Index not found: ${index}`);
    }
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Index Management
  // ═══════════════════════════════════════════════════════════════════════

  async createIndex(index: string, schema: SearchSchema): Promise<void> {
    const fullName = this.getFullIndexName(index);
    if (this.indices.has(fullName)) {
      throw new Error(`Index already exists: ${index}`);
    }
    this.indices.set(fullName, {
      schema,
      documents: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async deleteIndex(index: string): Promise<void> {
    const fullName = this.getFullIndexName(index);
    this.indices.delete(fullName);
  }

  async indexExists(index: string): Promise<boolean> {
    return this.indices.has(this.getFullIndexName(index));
  }

  async getIndexSchema(index: string): Promise<SearchSchema | null> {
    const fullName = this.getFullIndexName(index);
    const data = this.indices.get(fullName);
    return data?.schema || null;
  }

  async updateIndexSettings(index: string, settings: SearchSchema['settings']): Promise<void> {
    const data = this.getIndex(index);
    data.schema.settings = { ...data.schema.settings, ...settings };
    data.updatedAt = new Date();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Document Operations
  // ═══════════════════════════════════════════════════════════════════════

  async index<T extends Record<string, unknown>>(index: string, id: string, document: T): Promise<void> {
    const data = this.getIndex(index);
    data.documents.set(id, { ...document, _id: id });
    data.updatedAt = new Date();
  }

  async bulkIndex<T extends Record<string, unknown>>(
    index: string,
    documents: Array<{ id: string; doc: T }>
  ): Promise<{ success: number; failed: number; errors?: string[] }> {
    const data = this.getIndex(index);
    let success = 0;
    const errors: string[] = [];

    for (const { id, doc } of documents) {
      try {
        data.documents.set(id, { ...doc, _id: id });
        success++;
      } catch (error) {
        errors.push(`Failed to index ${id}: ${(error as Error).message}`);
      }
    }

    data.updatedAt = new Date();
    return { success, failed: documents.length - success, errors: errors.length > 0 ? errors : undefined };
  }

  async get<T>(index: string, id: string): Promise<T | null> {
    const data = this.getIndex(index);
    const doc = data.documents.get(id);
    return doc ? (doc as T) : null;
  }

  async delete(index: string, id: string): Promise<boolean> {
    const data = this.getIndex(index);
    const existed = data.documents.has(id);
    data.documents.delete(id);
    data.updatedAt = new Date();
    return existed;
  }

  async update<T extends Record<string, unknown>>(index: string, id: string, partial: Partial<T>): Promise<void> {
    const data = this.getIndex(index);
    const existing = data.documents.get(id);
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }
    data.documents.set(id, { ...existing, ...partial });
    data.updatedAt = new Date();
  }

  async deleteByQuery(index: string, filters: FilterCondition[]): Promise<number> {
    const data = this.getIndex(index);
    let deleted = 0;

    for (const [id, doc] of data.documents) {
      if (this.matchesFilters(doc, filters)) {
        data.documents.delete(id);
        deleted++;
      }
    }

    data.updatedAt = new Date();
    return deleted;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Search Operations
  // ═══════════════════════════════════════════════════════════════════════

  async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
    const startTime = Date.now();
    const data = this.getIndex(index);
    let results: Array<{ id: string; doc: Record<string, unknown>; score: number }> = [];

    // Search all documents
    for (const [id, doc] of data.documents) {
      let score = 0;

      // Text search
      if (query.query) {
        const searchFields = query.fields || Object.keys(doc);
        for (const field of searchFields) {
          const value = this.getFieldValue(doc, field);
          if (value !== undefined) {
            const textScore = this.calculateTextScore(String(value), query.query, query.fuzzy);
            if (textScore > 0) {
              const boost = query.boost?.[field] || 1;
              score += textScore * boost;
            }
          }
        }
      } else {
        score = 1; // No query means match all
      }

      // Apply filters
      if (query.filters && !this.matchesFilters(doc, query.filters)) {
        continue;
      }

      // Apply minimum score
      if (query.minScore && score < query.minScore) {
        continue;
      }

      if (score > 0 || !query.query) {
        results.push({ id, doc, score });
      }
    }

    // Sort results
    if (query.sort && query.sort.length > 0) {
      results.sort((a, b) => {
        for (const sort of query.sort!) {
          const aVal = this.getFieldValue(a.doc, sort.field);
          const bVal = this.getFieldValue(b.doc, sort.field);
          const cmp = this.compareValues(aVal, bVal);
          if (cmp !== 0) {
            return sort.order === 'desc' ? -cmp : cmp;
          }
        }
        return 0;
      });
    } else {
      // Sort by score descending
      results.sort((a, b) => b.score - a.score);
    }

    const total = results.length;

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 10;
    results = results.slice(offset, offset + limit);

    // Build hits
    const hits: SearchHit<T>[] = results.map(({ id, doc, score }) => {
      const hit: SearchHit<T> = {
        id,
        document: (query.select ? this.selectFields(doc, query.select) : doc) as T,
        score,
      };

      // Add highlights
      if (query.highlight && query.query) {
        hit.highlights = this.generateHighlights(doc, query.query, query.highlight);
      }

      return hit;
    });

    // Calculate facets
    let facets: Record<string, { buckets: Array<{ value: string | number; count: number }> }> | undefined;
    if (query.facets) {
      facets = {};
      for (const facetField of query.facets) {
        facets[facetField] = this.calculateFacet(data.documents, facetField, query.filters);
      }
    }

    return {
      hits,
      total,
      took: Date.now() - startTime,
      facets,
      maxScore: hits[0]?.score,
    };
  }

  async searchByField<T>(index: string, field: string, value: unknown): Promise<SearchResult<T>> {
    return this.search<T>(index, {
      filters: [{ field, operator: FilterOperator.EQUALS, value }],
    });
  }

  async autocomplete(index: string, field: string, prefix: string, limit: number = 10): Promise<string[]> {
    const data = this.getIndex(index);
    const suggestions = new Set<string>();
    const lowerPrefix = prefix.toLowerCase();

    for (const doc of data.documents.values()) {
      const value = this.getFieldValue(doc, field);
      if (typeof value === 'string' && value.toLowerCase().startsWith(lowerPrefix)) {
        suggestions.add(value);
        if (suggestions.size >= limit) break;
      }
    }

    return Array.from(suggestions);
  }

  async fuzzySearch<T>(index: string, field: string, term: string, fuzziness: number = 2): Promise<SearchResult<T>> {
    return this.search<T>(index, {
      query: term,
      fields: [field],
      fuzzy: { maxEdits: fuzziness },
    });
  }

  async moreLikeThis<T>(index: string, id: string, fields?: string[]): Promise<SearchResult<T>> {
    const doc = await this.get<Record<string, unknown>>(index, id);
    if (!doc) {
      return { hits: [], total: 0, took: 0 };
    }

    const searchFields = fields || Object.keys(doc);
    const terms: string[] = [];

    for (const field of searchFields) {
      const value = this.getFieldValue(doc, field);
      if (typeof value === 'string') {
        terms.push(...value.split(/\s+/).slice(0, 5));
      }
    }

    return this.search<T>(index, {
      query: terms.join(' '),
      fields: searchFields,
      filters: [{ field: '_id', operator: FilterOperator.NOT_EQUALS, value: id }],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Aggregations
  // ═══════════════════════════════════════════════════════════════════════

  async aggregate(index: string, aggregations: AggregationQuery[]): Promise<AggregationResult[]> {
    const data = this.getIndex(index);
    const results: AggregationResult[] = [];

    for (const agg of aggregations) {
      results.push(this.computeAggregation(data.documents, agg));
    }

    return results;
  }

  async suggest(index: string, field: string, text: string, limit: number = 5): Promise<Suggestion[]> {
    const data = this.getIndex(index);
    const suggestions: Suggestion[] = [];
    const lowerText = text.toLowerCase();

    for (const doc of data.documents.values()) {
      const value = this.getFieldValue(doc, field);
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes(lowerText)) {
          const score = lowerValue.startsWith(lowerText) ? 2 : 1;
          suggestions.push({
            text: value,
            score,
            highlighted: value.replace(new RegExp(text, 'gi'), `<em>${text}</em>`),
          });
        }
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Analytics & Health
  // ═══════════════════════════════════════════════════════════════════════

  async getStats(index: string): Promise<IndexStats> {
    const data = this.getIndex(index);
    let sizeInBytes = 0;

    for (const doc of data.documents.values()) {
      sizeInBytes += JSON.stringify(doc).length;
    }

    return {
      documentCount: data.documents.size,
      sizeInBytes,
      lastUpdated: data.updatedAt,
    };
  }

  async healthCheck(): Promise<SearchHealthCheck> {
    const startTime = Date.now();

    return {
      healthy: true,
      provider: this.providerType,
      latencyMs: Date.now() - startTime,
      indexCount: this.indices.size,
      timestamp: new Date(),
    };
  }

  async refresh(_index: string): Promise<void> {
    // No-op for memory adapter
  }

  async close(): Promise<void> {
    this.indices.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════

  private getFieldValue(doc: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = doc;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private matchesFilters(doc: Record<string, unknown>, filters: FilterCondition[]): boolean {
    for (const filter of filters) {
      const value = this.getFieldValue(doc, filter.field);
      if (!this.matchesFilter(value, filter)) {
        return false;
      }
    }
    return true;
  }

  private matchesFilter(value: unknown, filter: FilterCondition): boolean {
    const { operator, value: filterValue } = filter;

    switch (operator) {
      case FilterOperator.EQUALS:
        return value === filterValue;
      case FilterOperator.NOT_EQUALS:
        return value !== filterValue;
      case FilterOperator.GREATER_THAN:
        return typeof value === 'number' && value > (filterValue as number);
      case FilterOperator.GREATER_THAN_OR_EQUALS:
        return typeof value === 'number' && value >= (filterValue as number);
      case FilterOperator.LESS_THAN:
        return typeof value === 'number' && value < (filterValue as number);
      case FilterOperator.LESS_THAN_OR_EQUALS:
        return typeof value === 'number' && value <= (filterValue as number);
      case FilterOperator.IN:
        return Array.isArray(filterValue) && filterValue.includes(value);
      case FilterOperator.NOT_IN:
        return Array.isArray(filterValue) && !filterValue.includes(value);
      case FilterOperator.CONTAINS:
        return typeof value === 'string' && value.toLowerCase().includes(String(filterValue).toLowerCase());
      case FilterOperator.STARTS_WITH:
        return typeof value === 'string' && value.toLowerCase().startsWith(String(filterValue).toLowerCase());
      case FilterOperator.ENDS_WITH:
        return typeof value === 'string' && value.toLowerCase().endsWith(String(filterValue).toLowerCase());
      case FilterOperator.EXISTS:
        return filterValue ? value !== undefined && value !== null : value === undefined || value === null;
      case FilterOperator.RANGE:
        if (typeof value !== 'number' || !filterValue || typeof filterValue !== 'object') return false;
        const range = filterValue as { from?: number; to?: number };
        if (range.from !== undefined && value < range.from) return false;
        if (range.to !== undefined && value > range.to) return false;
        return true;
      default:
        return true;
    }
  }

  private calculateTextScore(text: string, query: string, fuzzy?: boolean | { maxEdits?: number }): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/);

    let score = 0;
    for (const term of queryTerms) {
      if (lowerText.includes(term)) {
        score += lowerText === term ? 3 : lowerText.startsWith(term) ? 2 : 1;
      } else if (fuzzy) {
        const maxEdits = typeof fuzzy === 'object' ? fuzzy.maxEdits || 2 : 2;
        const distance = this.levenshteinDistance(lowerText, term);
        if (distance <= maxEdits) {
          score += 0.5;
        }
      }
    }
    return score;
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private compareValues(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === undefined || a === null) return 1;
    if (b === undefined || b === null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    return String(a).localeCompare(String(b));
  }

  private selectFields(doc: Record<string, unknown>, fields: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      const value = this.getFieldValue(doc, field);
      if (value !== undefined) {
        result[field] = value;
      }
    }
    return result;
  }

  private generateHighlights(
    doc: Record<string, unknown>,
    query: string,
    options: { fields?: string[]; preTag?: string; postTag?: string }
  ): Record<string, string[]> {
    const highlights: Record<string, string[]> = {};
    const fields = options.fields || Object.keys(doc);
    const preTag = options.preTag || '<em>';
    const postTag = options.postTag || '</em>';
    const queryTerms = query.toLowerCase().split(/\s+/);

    for (const field of fields) {
      const value = this.getFieldValue(doc, field);
      if (typeof value === 'string') {
        let highlighted = value;
        for (const term of queryTerms) {
          const regex = new RegExp(`(${term})`, 'gi');
          highlighted = highlighted.replace(regex, `${preTag}$1${postTag}`);
        }
        if (highlighted !== value) {
          highlights[field] = [highlighted];
        }
      }
    }
    return highlights;
  }

  private calculateFacet(
    documents: Map<string, Record<string, unknown>>,
    field: string,
    filters?: FilterCondition[]
  ): { buckets: Array<{ value: string | number; count: number }> } {
    const counts = new Map<string | number, number>();

    for (const doc of documents.values()) {
      if (filters && !this.matchesFilters(doc, filters)) continue;
      const value = this.getFieldValue(doc, field);
      if (value !== undefined && value !== null) {
        const key = typeof value === 'object' ? JSON.stringify(value) : value as string | number;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    const buckets = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    return { buckets };
  }

  private computeAggregation(documents: Map<string, Record<string, unknown>>, agg: AggregationQuery): AggregationResult {
    const values: number[] = [];
    for (const doc of documents.values()) {
      const value = this.getFieldValue(doc, agg.field);
      if (typeof value === 'number') values.push(value);
    }

    const name = agg.name || `${agg.type}_${agg.field}`;

    switch (agg.type) {
      case AggregationType.TERMS:
        return { name, buckets: this.calculateFacet(documents, agg.field).buckets.slice(0, agg.size || 10).map(b => ({ key: b.value, count: b.count })) };
      case AggregationType.AVG:
        return { name, value: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0 };
      case AggregationType.SUM:
        return { name, value: values.reduce((a, b) => a + b, 0) };
      case AggregationType.MIN:
        return { name, value: values.length > 0 ? Math.min(...values) : 0 };
      case AggregationType.MAX:
        return { name, value: values.length > 0 ? Math.max(...values) : 0 };
      case AggregationType.COUNT:
        return { name, value: values.length };
      case AggregationType.STATS:
        return {
          name,
          stats: {
            count: values.length,
            min: values.length > 0 ? Math.min(...values) : 0,
            max: values.length > 0 ? Math.max(...values) : 0,
            avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
            sum: values.reduce((a, b) => a + b, 0),
          },
        };
      default:
        return { name, value: 0 };
    }
  }
}

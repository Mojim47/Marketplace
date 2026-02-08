// ═══════════════════════════════════════════════════════════════════════════
// Elasticsearch Search Adapter
// ═══════════════════════════════════════════════════════════════════════════
// Production-ready Elasticsearch 8.x adapter
// ═══════════════════════════════════════════════════════════════════════════

import { Client } from '@elastic/elasticsearch';
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
  ElasticsearchConfig,
  FieldDefinition,
} from '../interfaces/search.interface';
import { SearchProviderType, FilterOperator, FieldType, AggregationType } from '../interfaces/search.interface';

/**
 * Elasticsearch search adapter
 */
export class ElasticsearchAdapter implements ISearchProvider {
  readonly providerType = SearchProviderType.ELASTICSEARCH;

  private readonly client: Client;
  private readonly indexPrefix: string;

  constructor(config: ElasticsearchConfig) {
    this.indexPrefix = config.indexPrefix || '';

    this.client = new Client({
      node: config.node,
      auth: config.auth,
      cloud: config.cloud,
      tls: config.tls,
      requestTimeout: config.requestTimeout || 30000,
      maxRetries: config.maxRetries || 3,
    });
  }

  private getFullIndexName(index: string): string {
    return this.indexPrefix ? `${this.indexPrefix}_${index}` : index;
  }

  private fieldTypeToElastic(type: FieldType): string {
    const mapping: Record<FieldType, string> = {
      [FieldType.TEXT]: 'text',
      [FieldType.KEYWORD]: 'keyword',
      [FieldType.INTEGER]: 'integer',
      [FieldType.FLOAT]: 'float',
      [FieldType.BOOLEAN]: 'boolean',
      [FieldType.DATE]: 'date',
      [FieldType.GEO_POINT]: 'geo_point',
      [FieldType.NESTED]: 'nested',
      [FieldType.OBJECT]: 'object',
    };
    return mapping[type] || 'text';
  }

  private buildMapping(schema: SearchSchema): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      properties[fieldName] = this.buildFieldMapping(fieldDef);
    }

    return { properties };
  }

  private buildFieldMapping(field: FieldDefinition): Record<string, unknown> {
    const mapping: Record<string, unknown> = {
      type: this.fieldTypeToElastic(field.type),
    };

    if (field.type === FieldType.TEXT) {
      if (field.analyzer) mapping.analyzer = field.analyzer;
      if (field.searchable === false) mapping.index = false;
      // Add keyword subfield for sorting/aggregations
      mapping.fields = { keyword: { type: 'keyword', ignore_above: 256 } };
    }

    if (field.nested && field.type === FieldType.NESTED) {
      mapping.properties = {};
      for (const [nestedName, nestedDef] of Object.entries(field.nested)) {
        (mapping.properties as Record<string, unknown>)[nestedName] = this.buildFieldMapping(nestedDef);
      }
    }

    return mapping;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Index Management
  // ═══════════════════════════════════════════════════════════════════════

  async createIndex(index: string, schema: SearchSchema): Promise<void> {
    const fullName = this.getFullIndexName(index);
    
    await this.client.indices.create({
      index: fullName,
      body: {
        settings: {
          number_of_shards: schema.settings?.numberOfShards || 1,
          number_of_replicas: schema.settings?.numberOfReplicas || 1,
          refresh_interval: schema.settings?.refreshInterval || '1s',
          max_result_window: schema.settings?.maxResultWindow || 10000,
        },
        mappings: this.buildMapping(schema),
      },
    });
  }

  async deleteIndex(index: string): Promise<void> {
    const fullName = this.getFullIndexName(index);
    await this.client.indices.delete({ index: fullName });
  }

  async indexExists(index: string): Promise<boolean> {
    const fullName = this.getFullIndexName(index);
    return this.client.indices.exists({ index: fullName });
  }

  async getIndexSchema(index: string): Promise<SearchSchema | null> {
    const fullName = this.getFullIndexName(index);
    
    try {
      const response = await this.client.indices.getMapping({ index: fullName });
      const mapping = response[fullName]?.mappings;
      
      if (!mapping) return null;

      // Convert ES mapping back to SearchSchema (simplified)
      const fields: Record<string, FieldDefinition> = {};
      const properties = mapping.properties || {};

      for (const [fieldName, fieldMapping] of Object.entries(properties)) {
        fields[fieldName] = this.elasticToFieldDef(fieldMapping as Record<string, unknown>);
      }

      return { fields };
    } catch {
      return null;
    }
  }

  private elasticToFieldDef(mapping: Record<string, unknown>): FieldDefinition {
    const typeMap: Record<string, FieldType> = {
      text: FieldType.TEXT,
      keyword: FieldType.KEYWORD,
      integer: FieldType.INTEGER,
      long: FieldType.INTEGER,
      float: FieldType.FLOAT,
      double: FieldType.FLOAT,
      boolean: FieldType.BOOLEAN,
      date: FieldType.DATE,
      geo_point: FieldType.GEO_POINT,
      nested: FieldType.NESTED,
      object: FieldType.OBJECT,
    };

    return {
      type: typeMap[mapping.type as string] || FieldType.TEXT,
      analyzer: mapping.analyzer as string | undefined,
    };
  }

  async updateIndexSettings(index: string, settings: SearchSchema['settings']): Promise<void> {
    const fullName = this.getFullIndexName(index);
    
    await this.client.indices.putSettings({
      index: fullName,
      body: {
        number_of_replicas: settings?.numberOfReplicas,
        refresh_interval: settings?.refreshInterval,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Document Operations
  // ═══════════════════════════════════════════════════════════════════════

  async index<T extends Record<string, unknown>>(index: string, id: string, document: T): Promise<void> {
    const fullName = this.getFullIndexName(index);
    
    await this.client.index({
      index: fullName,
      id,
      document,
      refresh: true,
    });
  }

  async bulkIndex<T extends Record<string, unknown>>(
    index: string,
    documents: Array<{ id: string; doc: T }>
  ): Promise<{ success: number; failed: number; errors?: string[] }> {
    const fullName = this.getFullIndexName(index);
    
    const operations = documents.flatMap(({ id, doc }) => [
      { index: { _index: fullName, _id: id } },
      doc,
    ]);

    const response = await this.client.bulk({
      refresh: true,
      operations,
    });

    const errors: string[] = [];
    let failed = 0;

    if (response.errors) {
      for (const item of response.items) {
        if (item.index?.error) {
          failed++;
          errors.push(`${item.index._id}: ${item.index.error.reason}`);
        }
      }
    }

    return {
      success: documents.length - failed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async get<T>(index: string, id: string): Promise<T | null> {
    const fullName = this.getFullIndexName(index);
    
    try {
      const response = await this.client.get<T>({
        index: fullName,
        id,
      });
      return response._source || null;
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async delete(index: string, id: string): Promise<boolean> {
    const fullName = this.getFullIndexName(index);
    
    try {
      const response = await this.client.delete({
        index: fullName,
        id,
        refresh: true,
      });
      return response.result === 'deleted';
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async update<T extends Record<string, unknown>>(index: string, id: string, partial: Partial<T>): Promise<void> {
    const fullName = this.getFullIndexName(index);
    
    await this.client.update({
      index: fullName,
      id,
      doc: partial,
      refresh: true,
    });
  }

  async deleteByQuery(index: string, filters: FilterCondition[]): Promise<number> {
    const fullName = this.getFullIndexName(index);
    
    const response = await this.client.deleteByQuery({
      index: fullName,
      refresh: true,
      query: {
        bool: {
          filter: filters.map(f => this.buildFilterClause(f)),
        },
      },
    });

    return typeof response.deleted === 'number' ? response.deleted : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Search Operations
  // ═══════════════════════════════════════════════════════════════════════

  async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
    const fullName = this.getFullIndexName(index);
    const startTime = Date.now();

    const body: Record<string, unknown> = {
      from: query.offset || 0,
      size: query.limit || 10,
    };

    // Build query
    const must: unknown[] = [];
    const filter: unknown[] = [];

    if (query.query) {
      if (query.fields && query.fields.length > 0) {
        must.push({
          multi_match: {
            query: query.query,
            fields: query.fields.map(f => query.boost?.[f] ? `${f}^${query.boost[f]}` : f),
            fuzziness: query.fuzzy ? (typeof query.fuzzy === 'object' ? query.fuzzy.maxEdits || 'AUTO' : 'AUTO') : undefined,
          },
        });
      } else {
        must.push({
          query_string: {
            query: query.query,
            fuzziness: query.fuzzy ? 'AUTO' : undefined,
          },
        });
      }
    }

    if (query.filters) {
      for (const f of query.filters) {
        filter.push(this.buildFilterClause(f));
      }
    }

    if (must.length > 0 || filter.length > 0) {
      body.query = {
        bool: {
          ...(must.length > 0 && { must }),
          ...(filter.length > 0 && { filter }),
        },
      };
    } else {
      body.query = { match_all: {} };
    }

    // Sort
    if (query.sort && query.sort.length > 0) {
      body.sort = query.sort.map(s => ({
        [s.field]: { order: s.order, mode: s.mode },
      }));
    }

    // Source filtering
    if (query.select) {
      body._source = query.select;
    }

    // Highlighting
    if (query.highlight) {
      body.highlight = {
        fields: Object.fromEntries(
          (query.highlight.fields || ['*']).map(f => [f, {}])
        ),
        pre_tags: [query.highlight.preTag || '<em>'],
        post_tags: [query.highlight.postTag || '</em>'],
        fragment_size: query.highlight.fragmentSize || 150,
        number_of_fragments: query.highlight.numberOfFragments || 3,
      };
    }

    // Aggregations for facets
    if (query.facets) {
      body.aggs = Object.fromEntries(
        query.facets.map(f => [f, { terms: { field: `${f}.keyword`, size: 100 } }])
      );
    }

    // Min score
    if (query.minScore) {
      body.min_score = query.minScore;
    }

    const response = await this.client.search<T>({
      index: fullName,
      ...body,
    });

    const hits: SearchHit<T>[] = response.hits.hits.map(hit => ({
      id: hit._id,
      document: hit._source as T,
      score: hit._score || undefined,
      highlights: hit.highlight as Record<string, string[]> | undefined,
      sortValues: hit.sort,
    }));

    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total?.value || 0;

    const facets = query.facets ? Object.fromEntries(
      query.facets.map(f => {
        const agg = (response.aggregations as Record<string, { buckets: Array<{ key: string; doc_count: number }> }>)?.[f];
        return [f, {
          buckets: agg?.buckets.map(b => ({ value: b.key, count: b.doc_count })) || [],
        }];
      })
    ) : undefined;

    return {
      hits,
      total,
      took: Date.now() - startTime,
      facets,
      maxScore: response.hits.max_score || undefined,
    };
  }

  async searchByField<T>(index: string, field: string, value: unknown): Promise<SearchResult<T>> {
    return this.search<T>(index, {
      filters: [{ field, operator: FilterOperator.EQUALS, value }],
    });
  }

  async autocomplete(index: string, field: string, prefix: string, limit: number = 10): Promise<string[]> {
    const fullName = this.getFullIndexName(index);

    const response = await this.client.search({
      index: fullName,
      size: 0,
      aggs: {
        suggestions: {
          terms: {
            field: `${field}.keyword`,
            include: `${prefix}.*`,
            size: limit,
          },
        },
      },
    });

    const agg = (response.aggregations as { suggestions?: { buckets: Array<{ key: string }> } })?.suggestions;
    return agg?.buckets.map(b => b.key) || [];
  }

  async fuzzySearch<T>(index: string, field: string, term: string, fuzziness: number = 2): Promise<SearchResult<T>> {
    return this.search<T>(index, {
      query: term,
      fields: [field],
      fuzzy: { maxEdits: fuzziness },
    });
  }

  async moreLikeThis<T>(index: string, id: string, fields?: string[]): Promise<SearchResult<T>> {
    const fullName = this.getFullIndexName(index);

    const response = await this.client.search<T>({
      index: fullName,
      query: {
        more_like_this: {
          fields: fields || ['*'],
          like: [{ _index: fullName, _id: id }],
          min_term_freq: 1,
          min_doc_freq: 1,
        },
      },
    });

    const hits: SearchHit<T>[] = response.hits.hits.map(hit => ({
      id: hit._id,
      document: hit._source as T,
      score: hit._score || undefined,
    }));

    return {
      hits,
      total: typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0,
      took: response.took,
    };
  }

  private buildFilterClause(filter: FilterCondition): Record<string, unknown> {
    const { field, operator, value } = filter;

    switch (operator) {
      case FilterOperator.EQUALS:
        return { term: { [field]: value } };
      case FilterOperator.NOT_EQUALS:
        return { bool: { must_not: { term: { [field]: value } } } };
      case FilterOperator.GREATER_THAN:
        return { range: { [field]: { gt: value } } };
      case FilterOperator.GREATER_THAN_OR_EQUALS:
        return { range: { [field]: { gte: value } } };
      case FilterOperator.LESS_THAN:
        return { range: { [field]: { lt: value } } };
      case FilterOperator.LESS_THAN_OR_EQUALS:
        return { range: { [field]: { lte: value } } };
      case FilterOperator.IN:
        return { terms: { [field]: value } };
      case FilterOperator.NOT_IN:
        return { bool: { must_not: { terms: { [field]: value } } } };
      case FilterOperator.CONTAINS:
        return { wildcard: { [field]: `*${value}*` } };
      case FilterOperator.STARTS_WITH:
        return { prefix: { [field]: value } };
      case FilterOperator.EXISTS:
        return value ? { exists: { field } } : { bool: { must_not: { exists: { field } } } };
      case FilterOperator.RANGE:
        const range = value as { from?: number; to?: number };
        return { range: { [field]: { gte: range.from, lte: range.to } } };
      default:
        return { match_all: {} };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Aggregations
  // ═══════════════════════════════════════════════════════════════════════

  async aggregate(index: string, aggregations: AggregationQuery[]): Promise<AggregationResult[]> {
    const fullName = this.getFullIndexName(index);

    const aggs: Record<string, unknown> = {};
    for (const agg of aggregations) {
      aggs[agg.name || agg.field] = this.buildAggregation(agg);
    }

    const response = await this.client.search({
      index: fullName,
      size: 0,
      aggs,
    });

    return aggregations.map(agg => {
      const name = agg.name || agg.field;
      const result = (response.aggregations as Record<string, unknown>)?.[name] as Record<string, unknown>;
      return this.parseAggregationResult(name, agg.type, result);
    });
  }

  private buildAggregation(agg: AggregationQuery): Record<string, unknown> {
    switch (agg.type) {
      case AggregationType.TERMS:
        return { terms: { field: `${agg.field}.keyword`, size: agg.size || 10 } };
      case AggregationType.RANGE:
        return { range: { field: agg.field, ranges: agg.ranges } };
      case AggregationType.DATE_HISTOGRAM:
        return { date_histogram: { field: agg.field, calendar_interval: agg.interval || 'day' } };
      case AggregationType.HISTOGRAM:
        return { histogram: { field: agg.field, interval: agg.interval || 10 } };
      case AggregationType.AVG:
        return { avg: { field: agg.field } };
      case AggregationType.SUM:
        return { sum: { field: agg.field } };
      case AggregationType.MIN:
        return { min: { field: agg.field } };
      case AggregationType.MAX:
        return { max: { field: agg.field } };
      case AggregationType.COUNT:
        return { value_count: { field: agg.field } };
      case AggregationType.CARDINALITY:
        return { cardinality: { field: agg.field } };
      case AggregationType.STATS:
        return { stats: { field: agg.field } };
      default:
        return { terms: { field: agg.field } };
    }
  }

  private parseAggregationResult(name: string, type: AggregationType, result: Record<string, unknown>): AggregationResult {
    if (!result) return { name };

    switch (type) {
      case AggregationType.TERMS:
      case AggregationType.RANGE:
      case AggregationType.DATE_HISTOGRAM:
      case AggregationType.HISTOGRAM:
        const buckets = (result.buckets as Array<{ key: string | number; doc_count: number; from?: number; to?: number }>) || [];
        return {
          name,
          buckets: buckets.map(b => ({
            key: b.key,
            count: b.doc_count,
            from: b.from,
            to: b.to,
          })),
        };
      case AggregationType.STATS:
        return {
          name,
          stats: {
            count: (result.count as number) || 0,
            min: (result.min as number) || 0,
            max: (result.max as number) || 0,
            avg: (result.avg as number) || 0,
            sum: (result.sum as number) || 0,
          },
        };
      default:
        return { name, value: (result.value as number) || 0 };
    }
  }

  async suggest(index: string, field: string, text: string, limit: number = 5): Promise<Suggestion[]> {
    const fullName = this.getFullIndexName(index);

    const response = await this.client.search({
      index: fullName,
      suggest: {
        suggestions: {
          prefix: text,
          completion: {
            field: `${field}.suggest`,
            size: limit,
            skip_duplicates: true,
          },
        },
      },
    });

    const suggestions = (response.suggest as { suggestions?: Array<{ options: Array<{ text: string; _score: number }> }> })?.suggestions?.[0]?.options || [];
    
    return suggestions.map(s => ({
      text: s.text,
      score: s._score,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Analytics & Health
  // ═══════════════════════════════════════════════════════════════════════

  async getStats(index: string): Promise<IndexStats> {
    const fullName = this.getFullIndexName(index);

    const response = await this.client.indices.stats({ index: fullName });
    const stats = response._all?.primaries;

    return {
      documentCount: stats?.docs?.count || 0,
      sizeInBytes: stats?.store?.size_in_bytes || 0,
    };
  }

  async healthCheck(): Promise<SearchHealthCheck> {
    const startTime = Date.now();

    try {
      const health = await this.client.cluster.health();
      const stats = await this.client.cluster.stats();

      return {
        healthy: health.status !== 'red',
        provider: this.providerType,
        latencyMs: Date.now() - startTime,
        clusterStatus: health.status as 'green' | 'yellow' | 'red',
        nodeCount: health.number_of_nodes,
        indexCount: stats.indices?.count || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.providerType,
        latencyMs: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  async refresh(index: string): Promise<void> {
    const fullName = this.getFullIndexName(index);
    await this.client.indices.refresh({ index: fullName });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MeiliSearch Adapter
// ═══════════════════════════════════════════════════════════════════════════
// Fast, typo-tolerant search engine - great for e-commerce
// ═══════════════════════════════════════════════════════════════════════════

import { MeiliSearch, Index } from 'meilisearch';
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
  MeilisearchConfig,
} from '../interfaces/search.interface';
import { SearchProviderType, FilterOperator, AggregationType, FieldType } from '../interfaces/search.interface';

/**
 * MeiliSearch adapter
 */
export class MeilisearchAdapter implements ISearchProvider {
  readonly providerType = SearchProviderType.MEILISEARCH;

  private readonly client: MeiliSearch;
  private readonly indexPrefix: string;

  constructor(config: MeilisearchConfig) {
    this.indexPrefix = config.indexPrefix || '';

    this.client = new MeiliSearch({
      host: config.host,
      apiKey: config.apiKey,
      requestConfig: {
        timeout: config.requestTimeout || 30000,
      },
    });
  }

  private getFullIndexName(index: string): string {
    return this.indexPrefix ? `${this.indexPrefix}_${index}` : index;
  }

  private getIndex(index: string): Index {
    return this.client.index(this.getFullIndexName(index));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Index Management
  // ═══════════════════════════════════════════════════════════════════════

  async createIndex(index: string, schema: SearchSchema): Promise<void> {
    const fullName = this.getFullIndexName(index);
    const primaryKey = schema.primaryKey || 'id';

    await this.client.createIndex(fullName, { primaryKey });

    const meiliIndex = this.client.index(fullName);

    // Configure searchable attributes
    const searchableAttributes = Object.entries(schema.fields)
      .filter(([, def]) => def.searchable !== false && (def.type === FieldType.TEXT || def.type === FieldType.KEYWORD))
      .map(([name]) => name);

    if (searchableAttributes.length > 0) {
      await meiliIndex.updateSearchableAttributes(searchableAttributes);
    }

    // Configure filterable attributes
    const filterableAttributes = Object.entries(schema.fields)
      .filter(([, def]) => def.filterable)
      .map(([name]) => name);

    if (filterableAttributes.length > 0) {
      await meiliIndex.updateFilterableAttributes(filterableAttributes);
    }

    // Configure sortable attributes
    const sortableAttributes = Object.entries(schema.fields)
      .filter(([, def]) => def.sortable)
      .map(([name]) => name);

    if (sortableAttributes.length > 0) {
      await meiliIndex.updateSortableAttributes(sortableAttributes);
    }

    // Configure faceting
    const facetableAttributes = Object.entries(schema.fields)
      .filter(([, def]) => def.facetable)
      .map(([name]) => name);

    if (facetableAttributes.length > 0) {
      await meiliIndex.updateFaceting({ maxValuesPerFacet: 100 });
    }
  }

  async deleteIndex(index: string): Promise<void> {
    const fullName = this.getFullIndexName(index);
    await this.client.deleteIndex(fullName);
  }

  async indexExists(index: string): Promise<boolean> {
    try {
      await this.getIndex(index).getStats();
      return true;
    } catch {
      return false;
    }
  }

  async getIndexSchema(index: string): Promise<SearchSchema | null> {
    try {
      const meiliIndex = this.getIndex(index);
      const settings = await meiliIndex.getSettings();

      const fields: Record<string, { type: FieldType; searchable?: boolean; filterable?: boolean; sortable?: boolean }> = {};

      for (const attr of settings.searchableAttributes || []) {
        fields[attr] = { ...fields[attr], type: FieldType.TEXT, searchable: true };
      }

      for (const attr of settings.filterableAttributes || []) {
        fields[attr] = { ...fields[attr], type: fields[attr]?.type || FieldType.KEYWORD, filterable: true };
      }

      for (const attr of settings.sortableAttributes || []) {
        fields[attr] = { ...fields[attr], type: fields[attr]?.type || FieldType.KEYWORD, sortable: true };
      }

      return { fields };
    } catch {
      return null;
    }
  }

  async updateIndexSettings(index: string, _settings: SearchSchema['settings']): Promise<void> {
    // MeiliSearch settings are updated via specific methods
    // This is a no-op for now
    await this.getIndex(index).getStats();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Document Operations
  // ═══════════════════════════════════════════════════════════════════════

  async index<T extends Record<string, unknown>>(index: string, id: string, document: T): Promise<void> {
    const meiliIndex = this.getIndex(index);
    await meiliIndex.addDocuments([{ ...document, id }]);
  }

  async bulkIndex<T extends Record<string, unknown>>(
    index: string,
    documents: Array<{ id: string; doc: T }>
  ): Promise<{ success: number; failed: number; errors?: string[] }> {
    const meiliIndex = this.getIndex(index);
    const docs = documents.map(({ id, doc }) => ({ ...doc, id }));

    try {
      const task = await meiliIndex.addDocuments(docs);
      await this.client.waitForTask(task.taskUid);
      return { success: documents.length, failed: 0 };
    } catch (error) {
      return {
        success: 0,
        failed: documents.length,
        errors: [(error as Error).message],
      };
    }
  }

  async get<T>(index: string, id: string): Promise<T | null> {
    try {
      const doc = await this.getIndex(index).getDocument(id);
      return doc as T;
    } catch {
      return null;
    }
  }

  async delete(index: string, id: string): Promise<boolean> {
    try {
      const task = await this.getIndex(index).deleteDocument(id);
      await this.client.waitForTask(task.taskUid);
      return true;
    } catch {
      return false;
    }
  }

  async update<T extends Record<string, unknown>>(index: string, id: string, partial: Partial<T>): Promise<void> {
    const meiliIndex = this.getIndex(index);
    await meiliIndex.updateDocuments([{ ...partial, id }]);
  }

  async deleteByQuery(index: string, filters: FilterCondition[]): Promise<number> {
    const meiliIndex = this.getIndex(index);
    const filterStr = this.buildFilterString(filters);

    // MeiliSearch doesn't have deleteByQuery, so we search and delete
    const results = await meiliIndex.search('', { filter: filterStr, limit: 10000 });
    const ids = results.hits.map(h => h.id as string);

    if (ids.length > 0) {
      const task = await meiliIndex.deleteDocuments(ids);
      await this.client.waitForTask(task.taskUid);
    }

    return ids.length;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Search Operations
  // ═══════════════════════════════════════════════════════════════════════

  async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
    const meiliIndex = this.getIndex(index);
    const startTime = Date.now();

    const searchParams: Record<string, unknown> = {
      offset: query.offset || 0,
      limit: query.limit || 10,
    };

    // Filters
    if (query.filters && query.filters.length > 0) {
      searchParams.filter = this.buildFilterString(query.filters);
    }

    // Sort
    if (query.sort && query.sort.length > 0) {
      searchParams.sort = query.sort.map(s => `${s.field}:${s.order}`);
    }

    // Attributes to retrieve
    if (query.select) {
      searchParams.attributesToRetrieve = query.select;
    }

    // Highlighting
    if (query.highlight) {
      searchParams.attributesToHighlight = query.highlight.fields || ['*'];
      searchParams.highlightPreTag = query.highlight.preTag || '<em>';
      searchParams.highlightPostTag = query.highlight.postTag || '</em>';
    }

    // Facets
    if (query.facets) {
      searchParams.facets = query.facets;
    }

    // Searchable attributes
    if (query.fields) {
      searchParams.attributesToSearchOn = query.fields;
    }

    const response = await meiliIndex.search(query.query || '', searchParams);

    const hits: SearchHit<T>[] = response.hits.map(hit => {
      const { _formatted, ...doc } = hit as Record<string, unknown> & { _formatted?: Record<string, string> };
      return {
        id: doc.id as string,
        document: doc as T,
        highlights: _formatted ? Object.fromEntries(
          Object.entries(_formatted).map(([k, v]) => [k, [v]])
        ) : undefined,
      };
    });

    const facets = response.facetDistribution ? Object.fromEntries(
      Object.entries(response.facetDistribution).map(([field, values]) => [
        field,
        {
          buckets: Object.entries(values).map(([value, count]) => ({
            value,
            count: count as number,
          })),
        },
      ])
    ) : undefined;

    return {
      hits,
      total: response.estimatedTotalHits || response.hits.length,
      took: Date.now() - startTime,
      facets,
    };
  }

  async searchByField<T>(index: string, field: string, value: unknown): Promise<SearchResult<T>> {
    return this.search<T>(index, {
      filters: [{ field, operator: FilterOperator.EQUALS, value }],
    });
  }

  async autocomplete(index: string, field: string, prefix: string, limit: number = 10): Promise<string[]> {
    const meiliIndex = this.getIndex(index);

    const response = await meiliIndex.search(prefix, {
      limit,
      attributesToRetrieve: [field],
      attributesToSearchOn: [field],
    });

    const suggestions = new Set<string>();
    for (const hit of response.hits) {
      const value = (hit as Record<string, unknown>)[field];
      if (typeof value === 'string') {
        suggestions.add(value);
      }
    }

    return Array.from(suggestions);
  }

  async fuzzySearch<T>(index: string, field: string, term: string, _fuzziness?: number): Promise<SearchResult<T>> {
    // MeiliSearch has built-in typo tolerance
    return this.search<T>(index, {
      query: term,
      fields: [field],
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
      const value = doc[field];
      if (typeof value === 'string') {
        terms.push(...value.split(/\s+/).slice(0, 5));
      }
    }

    return this.search<T>(index, {
      query: terms.join(' '),
      fields: searchFields,
      filters: [{ field: 'id', operator: FilterOperator.NOT_EQUALS, value: id }],
    });
  }

  private buildFilterString(filters: FilterCondition[]): string {
    return filters.map(f => this.buildSingleFilter(f)).join(' AND ');
  }

  private buildSingleFilter(filter: FilterCondition): string {
    const { field, operator, value } = filter;

    switch (operator) {
      case FilterOperator.EQUALS:
        return typeof value === 'string' ? `${field} = "${value}"` : `${field} = ${value}`;
      case FilterOperator.NOT_EQUALS:
        return typeof value === 'string' ? `${field} != "${value}"` : `${field} != ${value}`;
      case FilterOperator.GREATER_THAN:
        return `${field} > ${value}`;
      case FilterOperator.GREATER_THAN_OR_EQUALS:
        return `${field} >= ${value}`;
      case FilterOperator.LESS_THAN:
        return `${field} < ${value}`;
      case FilterOperator.LESS_THAN_OR_EQUALS:
        return `${field} <= ${value}`;
      case FilterOperator.IN:
        const inValues = (value as unknown[]).map(v => typeof v === 'string' ? `"${v}"` : v).join(', ');
        return `${field} IN [${inValues}]`;
      case FilterOperator.NOT_IN:
        const notInValues = (value as unknown[]).map(v => typeof v === 'string' ? `"${v}"` : v).join(', ');
        return `${field} NOT IN [${notInValues}]`;
      case FilterOperator.EXISTS:
        return value ? `${field} EXISTS` : `${field} IS NULL`;
      case FilterOperator.RANGE:
        const range = value as { from?: number; to?: number };
        const parts: string[] = [];
        if (range.from !== undefined) parts.push(`${field} >= ${range.from}`);
        if (range.to !== undefined) parts.push(`${field} <= ${range.to}`);
        return parts.join(' AND ');
      default:
        return '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Aggregations
  // ═══════════════════════════════════════════════════════════════════════

  async aggregate(index: string, aggregations: AggregationQuery[]): Promise<AggregationResult[]> {
    const meiliIndex = this.getIndex(index);
    const results: AggregationResult[] = [];

    // MeiliSearch only supports facets for aggregations
    const facetFields = aggregations
      .filter(a => a.type === AggregationType.TERMS)
      .map(a => a.field);

    if (facetFields.length > 0) {
      const response = await meiliIndex.search('', { facets: facetFields, limit: 0 });

      for (const agg of aggregations) {
        if (agg.type === AggregationType.TERMS && response.facetDistribution) {
          const facet = response.facetDistribution[agg.field];
          if (facet) {
            results.push({
              name: agg.name || agg.field,
              buckets: Object.entries(facet)
                .map(([key, count]) => ({ key, count: count as number }))
                .slice(0, agg.size || 10),
            });
          }
        }
      }
    }

    // For numeric aggregations, we need to fetch all documents (limited)
    for (const agg of aggregations) {
      if ([AggregationType.AVG, AggregationType.SUM, AggregationType.MIN, AggregationType.MAX, AggregationType.STATS].includes(agg.type)) {
        const response = await meiliIndex.search('', {
          limit: 10000,
          attributesToRetrieve: [agg.field],
        });

        const values = response.hits
          .map(h => (h as Record<string, unknown>)[agg.field])
          .filter((v): v is number => typeof v === 'number');

        const name = agg.name || agg.field;

        switch (agg.type) {
          case AggregationType.AVG:
            results.push({ name, value: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0 });
            break;
          case AggregationType.SUM:
            results.push({ name, value: values.reduce((a, b) => a + b, 0) });
            break;
          case AggregationType.MIN:
            results.push({ name, value: values.length > 0 ? Math.min(...values) : 0 });
            break;
          case AggregationType.MAX:
            results.push({ name, value: values.length > 0 ? Math.max(...values) : 0 });
            break;
          case AggregationType.STATS:
            results.push({
              name,
              stats: {
                count: values.length,
                min: values.length > 0 ? Math.min(...values) : 0,
                max: values.length > 0 ? Math.max(...values) : 0,
                avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
                sum: values.reduce((a, b) => a + b, 0),
              },
            });
            break;
        }
      }
    }

    return results;
  }

  async suggest(index: string, field: string, text: string, limit: number = 5): Promise<Suggestion[]> {
    const meiliIndex = this.getIndex(index);

    const response = await meiliIndex.search(text, {
      limit,
      attributesToRetrieve: [field],
      attributesToSearchOn: [field],
      attributesToHighlight: [field],
      highlightPreTag: '<em>',
      highlightPostTag: '</em>',
    });

    return response.hits.map(hit => {
      const formatted = (hit as { _formatted?: Record<string, string> })._formatted;
      return {
        text: (hit as Record<string, unknown>)[field] as string,
        score: 1,
        highlighted: formatted?.[field],
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Analytics & Health
  // ═══════════════════════════════════════════════════════════════════════

  async getStats(index: string): Promise<IndexStats> {
    const stats = await this.getIndex(index).getStats();

    return {
      documentCount: stats.numberOfDocuments,
      sizeInBytes: 0, // MeiliSearch doesn't expose this
      lastUpdated: stats.isIndexing ? new Date() : undefined,
    };
  }

  async healthCheck(): Promise<SearchHealthCheck> {
    const startTime = Date.now();

    try {
      const health = await this.client.health();
      const stats = await this.client.getStats();

      return {
        healthy: health.status === 'available',
        provider: this.providerType,
        latencyMs: Date.now() - startTime,
        indexCount: Object.keys(stats.indexes).length,
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

  async refresh(_index: string): Promise<void> {
    // MeiliSearch handles this automatically
  }

  async close(): Promise<void> {
    // MeiliSearch client doesn't need explicit closing
  }
}

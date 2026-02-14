// ═══════════════════════════════════════════════════════════════════════════
// Search Provider Interface - Vendor Agnostic Full-Text Search
// ═══════════════════════════════════════════════════════════════════════════
// ¬VENDOR_LOCK: Supports Elasticsearch, MeiliSearch, Typesense, PostgreSQL FTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Search provider types supported by the abstraction layer
 */
export enum SearchProviderType {
  ELASTICSEARCH = 'elasticsearch',
  MEILISEARCH = 'meilisearch',
  TYPESENSE = 'typesense',
  POSTGRESQL = 'postgresql',
  MEMORY = 'memory',
}

/**
 * Field types for search schema
 */
export enum FieldType {
  TEXT = 'text',
  KEYWORD = 'keyword',
  INTEGER = 'integer',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  DATE = 'date',
  GEO_POINT = 'geo_point',
  NESTED = 'nested',
  OBJECT = 'object',
}

/**
 * Field definition in search schema
 */
export interface FieldDefinition {
  type: FieldType;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  stored?: boolean;
  analyzer?: string;
  boost?: number;
  nested?: Record<string, FieldDefinition>;
}

/**
 * Search index schema
 */
export interface SearchSchema {
  fields: Record<string, FieldDefinition>;
  primaryKey?: string;
  settings?: {
    numberOfShards?: number;
    numberOfReplicas?: number;
    refreshInterval?: string;
    maxResultWindow?: number;
    analyzers?: Record<string, AnalyzerDefinition>;
  };
}

/**
 * Analyzer definition
 */
export interface AnalyzerDefinition {
  type: 'standard' | 'simple' | 'whitespace' | 'custom';
  tokenizer?: string;
  filter?: string[];
  charFilter?: string[];
}

/**
 * Search query options
 */
export interface SearchQuery {
  /** Full-text search query */
  query?: string;
  /** Fields to search in */
  fields?: string[];
  /** Filter conditions */
  filters?: FilterCondition[];
  /** Sort options */
  sort?: SortOption[];
  /** Pagination offset */
  offset?: number;
  /** Number of results to return */
  limit?: number;
  /** Fields to return */
  select?: string[];
  /** Highlight matching terms */
  highlight?: HighlightOptions;
  /** Facets to compute */
  facets?: string[];
  /** Minimum score threshold */
  minScore?: number;
  /** Enable fuzzy matching */
  fuzzy?: boolean | FuzzyOptions;
  /** Boost specific fields */
  boost?: Record<string, number>;
}

/**
 * Filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Filter operators
 */
export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUALS = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUALS = 'lte',
  IN = 'in',
  NOT_IN = 'nin',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  EXISTS = 'exists',
  RANGE = 'range',
  GEO_DISTANCE = 'geo_distance',
}

/**
 * Sort option
 */
export interface SortOption {
  field: string;
  order: 'asc' | 'desc';
  mode?: 'min' | 'max' | 'avg' | 'sum';
}

/**
 * Highlight options
 */
export interface HighlightOptions {
  fields?: string[];
  preTag?: string;
  postTag?: string;
  fragmentSize?: number;
  numberOfFragments?: number;
}

/**
 * Fuzzy search options
 */
export interface FuzzyOptions {
  maxEdits?: number;
  prefixLength?: number;
  maxExpansions?: number;
}

/**
 * Search result
 */
export interface SearchResult<T> {
  /** Matching documents */
  hits: SearchHit<T>[];
  /** Total number of matching documents */
  total: number;
  /** Time taken in milliseconds */
  took: number;
  /** Facet results */
  facets?: Record<string, FacetResult>;
  /** Maximum score */
  maxScore?: number;
}

/**
 * Single search hit
 */
export interface SearchHit<T> {
  /** Document ID */
  id: string;
  /** Document data */
  document: T;
  /** Relevance score */
  score?: number;
  /** Highlighted fields */
  highlights?: Record<string, string[]>;
  /** Sort values (for cursor pagination) */
  sortValues?: unknown[];
}

/**
 * Facet result
 */
export interface FacetResult {
  buckets: FacetBucket[];
  total?: number;
}

/**
 * Facet bucket
 */
export interface FacetBucket {
  value: string | number;
  count: number;
}

/**
 * Aggregation query
 */
export interface AggregationQuery {
  type: AggregationType;
  field: string;
  name?: string;
  size?: number;
  ranges?: Array<{ from?: number; to?: number; key?: string }>;
  interval?: string | number;
  nested?: AggregationQuery[];
}

/**
 * Aggregation types
 */
export enum AggregationType {
  TERMS = 'terms',
  RANGE = 'range',
  DATE_HISTOGRAM = 'date_histogram',
  HISTOGRAM = 'histogram',
  AVG = 'avg',
  SUM = 'sum',
  MIN = 'min',
  MAX = 'max',
  COUNT = 'count',
  CARDINALITY = 'cardinality',
  STATS = 'stats',
  GEO_BOUNDS = 'geo_bounds',
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  name: string;
  buckets?: AggregationBucket[];
  value?: number;
  stats?: {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  };
}

/**
 * Aggregation bucket
 */
export interface AggregationBucket {
  key: string | number;
  count: number;
  from?: number;
  to?: number;
  nested?: AggregationResult[];
}

/**
 * Suggestion result
 */
export interface Suggestion {
  text: string;
  score: number;
  highlighted?: string;
}

/**
 * Index statistics
 */
export interface IndexStats {
  documentCount: number;
  sizeInBytes: number;
  lastUpdated?: Date;
  fieldStats?: Record<
    string,
    {
      count: number;
      cardinality?: number;
      minValue?: unknown;
      maxValue?: unknown;
    }
  >;
}

/**
 * Search health check result
 */
export interface SearchHealthCheck {
  healthy: boolean;
  provider: SearchProviderType;
  latencyMs: number;
  clusterStatus?: 'green' | 'yellow' | 'red';
  nodeCount?: number;
  indexCount?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Search provider interface - All adapters must implement this
 */
export interface ISearchProvider {
  /** Provider type identifier */
  readonly providerType: SearchProviderType;

  // ═══════════════════════════════════════════════════════════════════════
  // Index Management
  // ═══════════════════════════════════════════════════════════════════════

  createIndex(index: string, schema: SearchSchema): Promise<void>;
  deleteIndex(index: string): Promise<void>;
  indexExists(index: string): Promise<boolean>;
  getIndexSchema(index: string): Promise<SearchSchema | null>;
  updateIndexSettings(index: string, settings: SearchSchema['settings']): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════════
  // Document Operations
  // ═══════════════════════════════════════════════════════════════════════

  index<T extends Record<string, unknown>>(index: string, id: string, document: T): Promise<void>;
  bulkIndex<T extends Record<string, unknown>>(
    index: string,
    documents: Array<{ id: string; doc: T }>
  ): Promise<{ success: number; failed: number; errors?: string[] }>;
  get<T>(index: string, id: string): Promise<T | null>;
  delete(index: string, id: string): Promise<boolean>;
  update<T extends Record<string, unknown>>(
    index: string,
    id: string,
    partial: Partial<T>
  ): Promise<void>;
  deleteByQuery(index: string, filters: FilterCondition[]): Promise<number>;

  // ═══════════════════════════════════════════════════════════════════════
  // Search Operations
  // ═══════════════════════════════════════════════════════════════════════

  search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>>;
  searchByField<T>(index: string, field: string, value: unknown): Promise<SearchResult<T>>;
  autocomplete(index: string, field: string, prefix: string, limit?: number): Promise<string[]>;
  fuzzySearch<T>(
    index: string,
    field: string,
    term: string,
    fuzziness?: number
  ): Promise<SearchResult<T>>;
  moreLikeThis<T>(index: string, id: string, fields?: string[]): Promise<SearchResult<T>>;

  // ═══════════════════════════════════════════════════════════════════════
  // Aggregations
  // ═══════════════════════════════════════════════════════════════════════

  aggregate(index: string, aggregations: AggregationQuery[]): Promise<AggregationResult[]>;
  suggest(index: string, field: string, text: string, limit?: number): Promise<Suggestion[]>;

  // ═══════════════════════════════════════════════════════════════════════
  // Analytics & Health
  // ═══════════════════════════════════════════════════════════════════════

  getStats(index: string): Promise<IndexStats>;
  healthCheck(): Promise<SearchHealthCheck>;
  refresh(index: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Search configuration base
 */
export interface SearchConfigBase {
  provider: SearchProviderType;
  indexPrefix?: string;
}

/**
 * Elasticsearch configuration
 */
export interface ElasticsearchConfig extends SearchConfigBase {
  provider: SearchProviderType.ELASTICSEARCH;
  node: string | string[];
  auth?:
    | {
        username: string;
        password: string;
      }
    | {
        apiKey: string;
      };
  cloud?: {
    id: string;
  };
  tls?: {
    rejectUnauthorized?: boolean;
    ca?: string;
  };
  requestTimeout?: number;
  maxRetries?: number;
}

/**
 * MeiliSearch configuration
 */
export interface MeilisearchConfig extends SearchConfigBase {
  provider: SearchProviderType.MEILISEARCH;
  host: string;
  apiKey?: string;
  requestTimeout?: number;
}

/**
 * Typesense configuration
 */
export interface TypesenseConfig extends SearchConfigBase {
  provider: SearchProviderType.TYPESENSE;
  nodes: Array<{
    host: string;
    port: number;
    protocol: 'http' | 'https';
  }>;
  apiKey: string;
  connectionTimeoutSeconds?: number;
  retryIntervalSeconds?: number;
}

/**
 * PostgreSQL FTS configuration
 */
export interface PostgresqlConfig extends SearchConfigBase {
  provider: SearchProviderType.POSTGRESQL;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  schema?: string;
  language?: string;
}

/**
 * In-memory search configuration (for testing)
 */
export interface MemorySearchConfig extends SearchConfigBase {
  provider: SearchProviderType.MEMORY;
}

/**
 * Union type for all search configurations
 */
export type SearchConfig =
  | ElasticsearchConfig
  | MeilisearchConfig
  | TypesenseConfig
  | PostgresqlConfig
  | MemorySearchConfig;

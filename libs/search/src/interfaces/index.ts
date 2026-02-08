// ═══════════════════════════════════════════════════════════════════════════
// Search Interfaces - Barrel Export
// ═══════════════════════════════════════════════════════════════════════════

export {
  SearchProviderType,
  FieldType,
  FilterOperator,
  AggregationType,
} from './search.interface';

export type {
  ISearchProvider,
  FieldDefinition,
  SearchSchema,
  AnalyzerDefinition,
  SearchQuery,
  FilterCondition,
  SortOption,
  HighlightOptions,
  FuzzyOptions,
  SearchResult,
  SearchHit,
  FacetResult,
  FacetBucket,
  AggregationQuery,
  AggregationResult,
  AggregationBucket,
  Suggestion,
  IndexStats,
  SearchHealthCheck,
  SearchConfigBase,
  ElasticsearchConfig,
  MeilisearchConfig,
  TypesenseConfig,
  PostgresqlConfig,
  MemorySearchConfig,
  SearchConfig,
} from './search.interface';

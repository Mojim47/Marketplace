// ═══════════════════════════════════════════════════════════════════════════
// Enterprise-SERTA Core Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CodeFile {
  id: string;
  path: string;
  content: string;
  language: string;
  size: number;
  hash: string;
  lastModified: Date;
  dependencies: string[];
  exports: string[];
  imports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  variables: VariableInfo[];
  securityPatterns: SecurityPattern[];
}

export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  parameters: Parameter[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  complexity: number;
  securityRisk: SecurityRisk;
}

export interface ClassInfo {
  name: string;
  startLine: number;
  endLine: number;
  methods: FunctionInfo[];
  properties: VariableInfo[];
  extends?: string;
  implements: string[];
  isExported: boolean;
}

export interface VariableInfo {
  name: string;
  type?: string;
  isConst: boolean;
  isExported: boolean;
  line: number;
  securitySensitive: boolean;
}

export interface Parameter {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface SecurityPattern {
  type: SecurityPatternType;
  severity: SecuritySeverity;
  line: number;
  description: string;
  recommendation: string;
  cweId?: string;
}

export enum SecurityPatternType {
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  CSRF = 'csrf',
  AUTH_BYPASS = 'auth_bypass',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_EXPOSURE = 'data_exposure',
  INSECURE_CRYPTO = 'insecure_crypto',
  HARDCODED_SECRET = 'hardcoded_secret',
  UNSAFE_DESERIALIZATION = 'unsafe_deserialization',
  COMMAND_INJECTION = 'command_injection',
  PATH_TRAVERSAL = 'path_traversal',
  WEAK_VALIDATION = 'weak_validation',
  MISSING_AUTH = 'missing_auth',
  RATE_LIMIT_BYPASS = 'rate_limit_bypass',
  TENANT_ISOLATION_BYPASS = 'tenant_isolation_bypass'
}

export enum SecuritySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface SecurityRisk {
  level: SecuritySeverity;
  patterns: SecurityPattern[];
  trustBoundary: boolean;
  dataFlow: DataFlowRisk;
}

export interface DataFlowRisk {
  inputSources: string[];
  outputSinks: string[];
  sanitization: boolean;
  validation: boolean;
  encryption: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Vector Embeddings
// ═══════════════════════════════════════════════════════════════════════════

export interface CodeEmbedding {
  id: string;
  fileId: string;
  type: EmbeddingType;
  vector: number[];
  metadata: EmbeddingMetadata;
  createdAt: Date;
}

export enum EmbeddingType {
  SEMANTIC_CODE = 'semantic_code',
  SECURITY_PATTERN = 'security_pattern',
  DEPENDENCY_FLOW = 'dependency_flow',
  THREAT_SHAPE = 'threat_shape',
  BUSINESS_LOGIC = 'business_logic'
}

export interface EmbeddingMetadata {
  fileName: string;
  functionName?: string;
  className?: string;
  securityRelevance: number;
  businessCriticality: number;
  complexity: number;
  trustBoundary: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Threat Graph
// ═══════════════════════════════════════════════════════════════════════════

export interface ThreatGraph {
  nodes: ThreatNode[];
  edges: ThreatEdge[];
  riskScore: number;
  criticalPaths: CriticalPath[];
  vulnerabilities: Vulnerability[];
}

export interface ThreatNode {
  id: string;
  type: NodeType;
  name: string;
  riskScore: number;
  metadata: NodeMetadata;
  position: GraphPosition;
}

export enum NodeType {
  FILE = 'file',
  FUNCTION = 'function',
  ENDPOINT = 'endpoint',
  DATABASE_QUERY = 'database_query',
  EXTERNAL_SERVICE = 'external_service',
  SECRET = 'secret',
  POLICY = 'policy',
  CONTAINER = 'container',
  ROLE = 'role',
  TRUST_BOUNDARY = 'trust_boundary'
}

export interface NodeMetadata {
  filePath?: string;
  lineNumber?: number;
  securityPatterns: SecurityPattern[];
  businessCriticality: number;
  exposureLevel: ExposureLevel;
  tenantIsolation: boolean;
}

export enum ExposureLevel {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  PRIVILEGED = 'privileged',
  INTERNAL = 'internal',
  PRIVATE = 'private'
}

export interface ThreatEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  riskMultiplier: number;
  metadata: EdgeMetadata;
}

export enum EdgeType {
  CALLS = 'calls',
  DEPENDS_ON = 'depends_on',
  DATA_FLOWS_TO = 'data_flows_to',
  AUTHENTICATES_WITH = 'authenticates_with',
  ESCALATES_TO = 'escalates_to',
  EXPOSES_TO = 'exposes_to',
  VALIDATES_WITH = 'validates_with',
  CACHES_IN = 'caches_in'
}

export interface EdgeMetadata {
  dataType?: string;
  validationLevel: number;
  encryptionLevel: number;
  auditTrail: boolean;
}

export interface GraphPosition {
  x: number;
  y: number;
  z?: number;
}

export interface CriticalPath {
  id: string;
  nodes: string[];
  edges: string[];
  riskScore: number;
  exploitability: number;
  impact: number;
  description: string;
}

export interface Vulnerability {
  id: string;
  type: SecurityPatternType;
  severity: SecuritySeverity;
  nodeId: string;
  description: string;
  exploitScenario: string;
  mitigation: string;
  cveId?: string;
  cweId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Agent System
// ═══════════════════════════════════════════════════════════════════════════

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  findings: AgentFinding[];
  metrics: AgentMetrics;
}

export enum AgentType {
  SECURITY_REDTEAM = 'security_redteam',
  ARCHITECTURE_DESTROYER = 'architecture_destroyer',
  DATABASE_BREACHER = 'database_breacher',
  RLS_ISOLATION_CHECKER = 'rls_isolation_checker',
  PERFORMANCE_ASSASSIN = 'performance_assassin',
  DEADLOCK_HUNTER = 'deadlock_hunter',
  MEMORY_LEAK_DETECTOR = 'memory_leak_detector',
  CONFIG_MISFIRE_DETECTOR = 'config_misfire_detector',
  API_SURFACE_ANALYZER = 'api_surface_analyzer',
  COMPLIANCE_AGENT = 'compliance_agent',
  FINANCIAL_RISK_AGENT = 'financial_risk_agent',
  ML_EXPLOIT_GENERATOR = 'ml_exploit_generator'
}

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

export interface AgentFinding {
  id: string;
  agentId: string;
  type: FindingType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  evidence: Evidence[];
  exploitChain?: ExploitChain;
  recommendation: string;
  businessImpact: BusinessImpact;
  createdAt: Date;
}

export enum FindingType {
  VULNERABILITY = 'vulnerability',
  WEAKNESS = 'weakness',
  MISCONFIGURATION = 'misconfiguration',
  PERFORMANCE_ISSUE = 'performance_issue',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  BUSINESS_LOGIC_FLAW = 'business_logic_flaw'
}

export interface Evidence {
  type: EvidenceType;
  location: string;
  content: string;
  metadata: Record<string, any>;
}

export enum EvidenceType {
  CODE_SNIPPET = 'code_snippet',
  LOG_ENTRY = 'log_entry',
  NETWORK_TRACE = 'network_trace',
  DATABASE_QUERY = 'database_query',
  CONFIG_FILE = 'config_file',
  API_RESPONSE = 'api_response'
}

export interface ExploitChain {
  steps: ExploitStep[];
  prerequisites: string[];
  impact: string;
  likelihood: number;
}

export interface ExploitStep {
  order: number;
  action: string;
  payload?: string;
  expectedResult: string;
  riskLevel: SecuritySeverity;
}

export interface BusinessImpact {
  financial: number;
  reputation: number;
  compliance: number;
  operational: number;
  description: string;
}

export interface AgentMetrics {
  executionTime: number;
  findingsCount: number;
  criticalFindings: number;
  coveragePercentage: number;
  falsePositiveRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Analysis Results
// ═══════════════════════════════════════════════════════════════════════════

export interface AnalysisResult {
  id: string;
  projectPath: string;
  startTime: Date;
  endTime: Date;
  status: AnalysisStatus;
  overallRiskScore: number;
  threatGraph: ThreatGraph;
  agentResults: Agent[];
  summary: AnalysisSummary;
  recommendations: Recommendation[];
}

export enum AnalysisStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface AnalysisSummary {
  totalFiles: number;
  totalFunctions: number;
  totalEndpoints: number;
  criticalVulnerabilities: number;
  highRiskVulnerabilities: number;
  mediumRiskVulnerabilities: number;
  lowRiskVulnerabilities: number;
  businessCriticalRisks: number;
  complianceViolations: number;
  performanceIssues: number;
  architecturalWeaknesses: number;
}

export interface Recommendation {
  id: string;
  priority: Priority;
  category: RecommendationCategory;
  title: string;
  description: string;
  implementation: string;
  estimatedEffort: string;
  businessValue: string;
  relatedFindings: string[];
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum RecommendationCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ARCHITECTURE = 'architecture',
  COMPLIANCE = 'compliance',
  BUSINESS_LOGIC = 'business_logic',
  INFRASTRUCTURE = 'infrastructure'
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

export interface SertaConfig {
  projectPath: string;
  outputPath: string;
  vectorDb: VectorDbConfig;
  agents: AgentConfig[];
  analysis: AnalysisConfig;
  reporting: ReportingConfig;
}

export interface VectorDbConfig {
  provider: 'qdrant' | 'pinecone' | 'weaviate';
  url: string;
  apiKey?: string;
  collection: string;
  dimensions: number;
}

export interface AgentConfig {
  type: AgentType;
  enabled: boolean;
  config: Record<string, any>;
}

export interface AnalysisConfig {
  includePatterns: string[];
  excludePatterns: string[];
  maxFileSize: number;
  parallelism: number;
  timeout: number;
}

export interface ReportingConfig {
  formats: ReportFormat[];
  includeEvidence: boolean;
  includeRecommendations: boolean;
  executiveSummary: boolean;
}

export enum ReportFormat {
  JSON = 'json',
  HTML = 'html',
  PDF = 'pdf',
  MARKDOWN = 'markdown',
  SARIF = 'sarif'
}
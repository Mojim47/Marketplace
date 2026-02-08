-- ═══════════════════════════════════════════════════════════════════════════
-- Enterprise-SERTA Database Initialization
-- ═══════════════════════════════════════════════════════════════════════════

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS serta;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Set search path
SET search_path TO serta, public;

-- ═══════════════════════════════════════════════════════════════════════════
-- Analysis Results Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Analysis sessions
CREATE TABLE IF NOT EXISTS serta.analysis_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_path TEXT NOT NULL,
    project_name TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    overall_risk_score DECIMAL(3,1),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    config JSONB,
    summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Agent execution results
CREATE TABLE IF NOT EXISTS serta.agent_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    agent_type VARCHAR(50) NOT NULL,
    agent_name TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER,
    findings_count INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2),
    false_positive_rate DECIMAL(5,4),
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Security findings
CREATE TABLE IF NOT EXISTS serta.security_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES serta.agent_executions(id) ON DELETE CASCADE,
    finding_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    evidence JSONB,
    exploit_chain JSONB,
    business_impact JSONB,
    recommendation TEXT,
    cve_id VARCHAR(20),
    cwe_id VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Threat graph nodes
CREATE TABLE IF NOT EXISTS serta.threat_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    node_id VARCHAR(64) NOT NULL,
    node_type VARCHAR(30) NOT NULL,
    name TEXT NOT NULL,
    risk_score DECIMAL(3,1) NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    security_patterns JSONB,
    business_criticality INTEGER,
    exposure_level VARCHAR(20),
    tenant_isolation BOOLEAN DEFAULT false,
    position JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, node_id)
);

-- Threat graph edges
CREATE TABLE IF NOT EXISTS serta.threat_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    edge_id VARCHAR(64) NOT NULL,
    source_node_id VARCHAR(64) NOT NULL,
    target_node_id VARCHAR(64) NOT NULL,
    edge_type VARCHAR(30) NOT NULL,
    weight DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    risk_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    data_type VARCHAR(50),
    validation_level INTEGER DEFAULT 0,
    encryption_level INTEGER DEFAULT 0,
    audit_trail BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, edge_id)
);

-- Critical attack paths
CREATE TABLE IF NOT EXISTS serta.critical_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    path_id VARCHAR(64) NOT NULL,
    nodes TEXT[] NOT NULL,
    edges TEXT[] NOT NULL,
    risk_score DECIMAL(3,1) NOT NULL,
    exploitability DECIMAL(3,1) NOT NULL,
    impact DECIMAL(3,1) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, path_id)
);

-- Recommendations
CREATE TABLE IF NOT EXISTS serta.recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL,
    category VARCHAR(30) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    implementation TEXT NOT NULL,
    estimated_effort VARCHAR(50),
    business_value TEXT,
    related_findings UUID[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Analytics Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Project analytics
CREATE TABLE IF NOT EXISTS analytics.project_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    total_files INTEGER NOT NULL,
    total_functions INTEGER NOT NULL,
    total_endpoints INTEGER NOT NULL,
    total_lines_of_code INTEGER,
    language_distribution JSONB,
    complexity_metrics JSONB,
    security_score DECIMAL(3,1),
    maintainability_score DECIMAL(3,1),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Vulnerability trends
CREATE TABLE IF NOT EXISTS analytics.vulnerability_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES serta.analysis_sessions(id) ON DELETE CASCADE,
    vulnerability_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    count INTEGER NOT NULL,
    trend_direction VARCHAR(10), -- 'up', 'down', 'stable'
    previous_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes for Performance
-- ═══════════════════════════════════════════════════════════════════════════

-- Analysis sessions indexes
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status ON serta.analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created_at ON serta.analysis_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_project_name ON serta.analysis_sessions(project_name);

-- Agent executions indexes
CREATE INDEX IF NOT EXISTS idx_agent_executions_session_id ON serta.agent_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_type ON serta.agent_executions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON serta.agent_executions(status);

-- Security findings indexes
CREATE INDEX IF NOT EXISTS idx_security_findings_session_id ON serta.security_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_agent_id ON serta.security_findings(agent_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_severity ON serta.security_findings(severity);
CREATE INDEX IF NOT EXISTS idx_security_findings_finding_type ON serta.security_findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_security_findings_file_path ON serta.security_findings(file_path);

-- Threat graph indexes
CREATE INDEX IF NOT EXISTS idx_threat_nodes_session_id ON serta.threat_nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_threat_nodes_node_type ON serta.threat_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_threat_nodes_risk_score ON serta.threat_nodes(risk_score);
CREATE INDEX IF NOT EXISTS idx_threat_edges_session_id ON serta.threat_edges(session_id);
CREATE INDEX IF NOT EXISTS idx_threat_edges_source_target ON serta.threat_edges(source_node_id, target_node_id);

-- Critical paths indexes
CREATE INDEX IF NOT EXISTS idx_critical_paths_session_id ON serta.critical_paths(session_id);
CREATE INDEX IF NOT EXISTS idx_critical_paths_risk_score ON serta.critical_paths(risk_score);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_project_metrics_session_id ON analytics.project_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_project_metrics_project_name ON analytics.project_metrics(project_name);
CREATE INDEX IF NOT EXISTS idx_vulnerability_trends_session_id ON analytics.vulnerability_trends(session_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_trends_type_severity ON analytics.vulnerability_trends(vulnerability_type, severity);

-- ═══════════════════════════════════════════════════════════════════════════
-- Functions and Triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for analysis_sessions
CREATE TRIGGER update_analysis_sessions_updated_at 
    BEFORE UPDATE ON serta.analysis_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate session summary
CREATE OR REPLACE FUNCTION calculate_session_summary(session_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_findings', COUNT(*),
        'critical_vulnerabilities', COUNT(*) FILTER (WHERE severity = 'critical'),
        'high_risk_vulnerabilities', COUNT(*) FILTER (WHERE severity = 'high'),
        'medium_risk_vulnerabilities', COUNT(*) FILTER (WHERE severity = 'medium'),
        'low_risk_vulnerabilities', COUNT(*) FILTER (WHERE severity = 'low'),
        'business_critical_risks', COUNT(*) FILTER (WHERE (business_impact->>'financial')::integer >= 8),
        'compliance_violations', COUNT(*) FILTER (WHERE finding_type = 'compliance_violation'),
        'performance_issues', COUNT(*) FILTER (WHERE finding_type = 'performance_issue'),
        'architectural_weaknesses', COUNT(*) FILTER (WHERE finding_type = 'weakness')
    ) INTO result
    FROM serta.security_findings
    WHERE session_id = session_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- Initial Data
-- ═══════════════════════════════════════════════════════════════════════════

-- Insert default configuration
INSERT INTO serta.analysis_sessions (id, project_path, project_name, status, config) 
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '/example/project',
    'Example Project',
    'template',
    '{
        "agents": [
            {"type": "SECURITY_REDTEAM", "enabled": true},
            {"type": "ARCHITECTURE_DESTROYER", "enabled": true},
            {"type": "DATABASE_BREACHER", "enabled": true}
        ],
        "analysis": {
            "includePatterns": ["**/*.{ts,js,tsx,jsx}"],
            "excludePatterns": ["**/node_modules/**"],
            "maxFileSize": 1048576,
            "parallelism": 5
        }
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA serta TO PUBLIC;
GRANT USAGE ON SCHEMA analytics TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA serta TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA serta TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO PUBLIC;
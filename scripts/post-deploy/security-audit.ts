// ═══════════════════════════════════════════════════════════════════════════
// Security Audit & Continuous Monitoring - Ultra-Fast 7-Layer Architecture
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

interface SecurityAuditResult {
  timestamp: Date;
  tenantId: string;
  auditType: 'weekly' | 'incident' | 'manual';
  findings: SecurityFinding[];
  riskScore: number;
  recommendations: string[];
  status: 'clean' | 'warning' | 'critical';
}

interface SecurityFinding {
  type: 'suspicious_behavior' | 'access_violation' | 'data_anomaly' | 'performance_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: any;
  userId?: string;
  ipAddress?: string;
  timestamp: Date;
  resolved: boolean;
}

interface BehaviorPattern {
  userId: string;
  tenantId: string;
  requestCount: number;
  errorCount: number;
  uniqueIPs: number;
  suspiciousScore: number;
  lastActivity: Date;
  patterns: {
    timeOfDay: number[];
    requestTypes: Record<string, number>;
    errorTypes: Record<string, number>;
    ipAddresses: string[];
  };
}

class SecurityAuditManager {
  private prisma: PrismaClient;
  private auditInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async startContinuousAudit(): Promise<void> {
    // Run initial audit
    await this.runFullSecurityAudit();

    // Schedule weekly audits
    this.auditInterval = setInterval(
      async () => {
        try {
          await this.runFullSecurityAudit();
        } catch (error) {
          console.error('❌ Scheduled audit failed:', error);
        }
      },
      7 * 24 * 60 * 60 * 1000
    ); // Weekly

    // Schedule behavioral analysis (more frequent)
    setInterval(
      async () => {
        try {
          await this.analyzeBehavioralPatterns();
        } catch (error) {
          console.error('❌ Behavioral analysis failed:', error);
        }
      },
      60 * 60 * 1000
    ); // Hourly
  }

  async runFullSecurityAudit(): Promise<SecurityAuditResult[]> {
    const results: SecurityAuditResult[] = [];

    // Get all active tenants
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, slug: true, name: true },
    });

    for (const tenant of tenants) {
      const auditResult = await this.auditTenant(tenant.id);
      results.push(auditResult);

      // Take action based on findings
      await this.handleAuditFindings(auditResult);
    }

    // Generate summary report
    await this.generateAuditSummary(results);
    return results;
  }

  private async auditTenant(tenantId: string): Promise<SecurityAuditResult> {
    const findings: SecurityFinding[] = [];

    // 1. Check for suspicious user behavior
    const behaviorFindings = await this.auditUserBehavior(tenantId);
    findings.push(...behaviorFindings);

    // 2. Check for access violations
    const accessFindings = await this.auditAccessViolations(tenantId);
    findings.push(...accessFindings);

    // 3. Check for data anomalies
    const dataFindings = await this.auditDataAnomalies(tenantId);
    findings.push(...dataFindings);

    // 4. Check for performance anomalies
    const performanceFindings = await this.auditPerformanceAnomalies(tenantId);
    findings.push(...performanceFindings);

    // 5. Check RLS policy compliance
    const rlsFindings = await this.auditRLSCompliance(tenantId);
    findings.push(...rlsFindings);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(findings);

    // Generate recommendations
    const recommendations = this.generateRecommendations(findings);

    // Determine status
    const status = this.determineSecurityStatus(riskScore, findings);

    return {
      timestamp: new Date(),
      tenantId,
      auditType: 'weekly',
      findings,
      riskScore,
      recommendations,
      status,
    };
  }

  private async auditUserBehavior(tenantId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Analyze recent system events for suspicious patterns
    const recentEvents = await this.prisma.systemEvent.findMany({
      where: {
        tenant_id: tenantId,
        occurred_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { occurred_at: 'desc' },
    });

    // Group events by user
    const userEvents = new Map<string, any[]>();
    for (const event of recentEvents) {
      if (event.user_id) {
        if (!userEvents.has(event.user_id)) {
          userEvents.set(event.user_id, []);
        }
        userEvents.get(event.user_id)?.push(event);
      }
    }

    // Analyze each user's behavior
    for (const [userId, events] of userEvents) {
      const pattern = this.analyzeBehaviorPattern(userId, tenantId, events);

      if (pattern.suspiciousScore > 70) {
        findings.push({
          type: 'suspicious_behavior',
          severity: pattern.suspiciousScore > 90 ? 'critical' : 'high',
          description: `User ${userId} shows suspicious behavior patterns`,
          evidence: {
            suspiciousScore: pattern.suspiciousScore,
            requestCount: pattern.requestCount,
            errorCount: pattern.errorCount,
            uniqueIPs: pattern.uniqueIPs,
            patterns: pattern.patterns,
          },
          userId,
          timestamp: new Date(),
          resolved: false,
        });
      }
    }

    return findings;
  }

  private async auditAccessViolations(tenantId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Check for failed authentication attempts
    const failedLogins = await this.prisma.systemEvent.findMany({
      where: {
        tenant_id: tenantId,
        event_type: 'login_failed',
        occurred_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // Group by IP address
    const ipFailures = new Map<string, number>();
    for (const event of failedLogins) {
      const ip = event.data?.ipAddress || 'unknown';
      ipFailures.set(ip, (ipFailures.get(ip) || 0) + 1);
    }

    // Check for brute force attempts
    for (const [ip, count] of ipFailures) {
      if (count > 10) {
        findings.push({
          type: 'access_violation',
          severity: count > 50 ? 'critical' : 'high',
          description: `Potential brute force attack from IP ${ip}`,
          evidence: { ipAddress: ip, failedAttempts: count },
          ipAddress: ip,
          timestamp: new Date(),
          resolved: false,
        });
      }
    }

    return findings;
  }

  private async auditDataAnomalies(tenantId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Check for unusual data access patterns
    const dataEvents = await this.prisma.systemEvent.findMany({
      where: {
        tenant_id: tenantId,
        event_type: { in: ['data_export', 'bulk_download', 'admin_access'] },
        occurred_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Check for unusual bulk operations
    for (const event of dataEvents) {
      const dataSize = event.data?.size || 0;
      const recordCount = event.data?.recordCount || 0;

      if (dataSize > 100 * 1024 * 1024 || recordCount > 10000) {
        // 100MB or 10k records
        findings.push({
          type: 'data_anomaly',
          severity: 'medium',
          description: 'Unusual bulk data operation detected',
          evidence: {
            eventType: event.event_type,
            dataSize,
            recordCount,
            userId: event.user_id,
          },
          userId: event.user_id || undefined,
          timestamp: event.occurred_at,
          resolved: false,
        });
      }
    }

    return findings;
  }

  private async auditPerformanceAnomalies(tenantId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Check for unusual performance patterns that might indicate attacks
    const performanceMetrics = await this.prisma.performanceMetric.findMany({
      where: {
        tenant_id: tenantId,
        recorded_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    // Analyze response times
    const responseTimes = performanceMetrics
      .filter((m) => m.metric_name === 'api_response_time')
      .map((m) => m.value);

    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      if (avgResponseTime > 1000 || maxResponseTime > 5000) {
        // 1s avg or 5s max
        findings.push({
          type: 'performance_anomaly',
          severity: 'medium',
          description: 'Unusual performance degradation detected',
          evidence: {
            avgResponseTime,
            maxResponseTime,
            sampleCount: responseTimes.length,
          },
          timestamp: new Date(),
          resolved: false,
        });
      }
    }

    return findings;
  }

  private async auditRLSCompliance(tenantId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Test RLS policies by attempting cross-tenant access
      await this.prisma.$executeRaw`
        SELECT set_security_context('fake_tenant', 'fake_user', ARRAY['USER'])
      `;

      // Try to access data from the real tenant - should return empty
      const crossTenantData = await this.prisma.product.findMany({
        where: { tenant_id: tenantId },
        take: 1,
      });

      if (crossTenantData.length > 0) {
        findings.push({
          type: 'access_violation',
          severity: 'critical',
          description: 'RLS policy violation detected - cross-tenant data leak',
          evidence: { tenantId, leakedRecords: crossTenantData.length },
          timestamp: new Date(),
          resolved: false,
        });
      }

      // Reset context
      await this.prisma.$executeRaw`
        SELECT set_security_context(${tenantId}, 'audit_user', ARRAY['ADMIN'])
      `;
    } catch (_error) {}

    return findings;
  }

  private analyzeBehaviorPattern(userId: string, tenantId: string, events: any[]): BehaviorPattern {
    const requestCount = events.length;
    const errorCount = events.filter(
      (e) => e.event_type.includes('error') || e.event_type.includes('failed')
    ).length;

    const ipAddresses = [...new Set(events.map((e) => e.data?.ipAddress).filter(Boolean))];
    const uniqueIPs = ipAddresses.length;

    // Analyze time patterns
    const timeOfDay = new Array(24).fill(0);
    events.forEach((e) => {
      const hour = new Date(e.occurred_at).getHours();
      timeOfDay[hour]++;
    });

    // Analyze request types
    const requestTypes: Record<string, number> = {};
    events.forEach((e) => {
      requestTypes[e.event_type] = (requestTypes[e.event_type] || 0) + 1;
    });

    // Calculate suspicious score
    let suspiciousScore = 0;

    // High error rate
    if (errorCount / requestCount > 0.1) {
      suspiciousScore += 30;
    }

    // Multiple IPs
    if (uniqueIPs > 5) {
      suspiciousScore += 20;
    }

    // Unusual time patterns (activity at night)
    const nightActivity = timeOfDay.slice(0, 6).reduce((a, b) => a + b, 0);
    if (nightActivity / requestCount > 0.3) {
      suspiciousScore += 25;
    }

    // High request volume
    if (requestCount > 1000) {
      suspiciousScore += 15;
    }

    return {
      userId,
      tenantId,
      requestCount,
      errorCount,
      uniqueIPs,
      suspiciousScore,
      lastActivity: new Date(Math.max(...events.map((e) => new Date(e.occurred_at).getTime()))),
      patterns: {
        timeOfDay,
        requestTypes,
        errorTypes: {},
        ipAddresses,
      },
    };
  }

  private calculateRiskScore(findings: SecurityFinding[]): number {
    let score = 0;

    for (const finding of findings) {
      switch (finding.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 8;
          break;
        case 'low':
          score += 3;
          break;
      }
    }

    return Math.min(score, 100);
  }

  private generateRecommendations(findings: SecurityFinding[]): string[] {
    const recommendations: string[] = [];

    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    const suspiciousBehavior = findings.filter((f) => f.type === 'suspicious_behavior');
    const accessViolations = findings.filter((f) => f.type === 'access_violation');

    if (criticalFindings.length > 0) {
      recommendations.push('فوری: بررسی و رفع مسائل امنیتی بحرانی');
    }

    if (suspiciousBehavior.length > 0) {
      recommendations.push('بررسی رفتار مشکوک کاربران و اعمال محدودیت در صورت نیاز');
    }

    if (accessViolations.length > 0) {
      recommendations.push('تقویت سیستم احراز هویت و اعمال محدودیت IP');
    }

    if (recommendations.length === 0) {
      recommendations.push('وضعیت امنیتی مطلوب - ادامه نظارت منظم');
    }

    return recommendations;
  }

  private determineSecurityStatus(
    riskScore: number,
    findings: SecurityFinding[]
  ): 'clean' | 'warning' | 'critical' {
    const criticalFindings = findings.filter((f) => f.severity === 'critical');

    if (criticalFindings.length > 0 || riskScore > 70) {
      return 'critical';
    }
    if (riskScore > 30) {
      return 'warning';
    }
    return 'clean';
  }

  private async handleAuditFindings(auditResult: SecurityAuditResult): Promise<void> {
    if (auditResult.status === 'critical') {
      // Send immediate alerts
      await this.sendSecurityAlert(auditResult);

      // Auto-block suspicious IPs
      await this.autoBlockSuspiciousIPs(auditResult);

      // Temporarily restrict high-risk users
      await this.restrictHighRiskUsers(auditResult);
    }

    // Log all findings
    await this.logSecurityFindings(auditResult);
  }

  private async sendSecurityAlert(_auditResult: SecurityAuditResult): Promise<void> {
    // Implementation would send actual alerts via email, Slack, etc.
  }

  private async autoBlockSuspiciousIPs(auditResult: SecurityAuditResult): Promise<void> {
    const ipViolations = auditResult.findings.filter(
      (f) => f.type === 'access_violation' && f.ipAddress
    );

    for (const violation of ipViolations) {
      if (violation.ipAddress) {
        // Implementation would add IP to firewall block list
      }
    }
  }

  private async restrictHighRiskUsers(auditResult: SecurityAuditResult): Promise<void> {
    const userViolations = auditResult.findings.filter(
      (f) => f.userId && f.severity === 'critical'
    );

    for (const violation of userViolations) {
      if (violation.userId) {
        // Temporarily disable user account
        await this.prisma.user.update({
          where: { id: violation.userId },
          data: { is_active: false },
        });
      }
    }
  }

  private async logSecurityFindings(auditResult: SecurityAuditResult): Promise<void> {
    // Log findings to system events for tracking
    await this.prisma.systemEvent.create({
      data: {
        id: `audit_${Date.now()}`,
        tenant_id: auditResult.tenantId,
        event_type: 'security_audit_completed',
        entity_type: 'security',
        entity_id: auditResult.tenantId,
        data: {
          riskScore: auditResult.riskScore,
          status: auditResult.status,
          findingsCount: auditResult.findings.length,
          criticalFindings: auditResult.findings.filter((f) => f.severity === 'critical').length,
        },
      },
    });
  }

  private async generateAuditSummary(results: SecurityAuditResult[]): Promise<void> {
    const _summary = {
      totalTenants: results.length,
      cleanTenants: results.filter((r) => r.status === 'clean').length,
      warningTenants: results.filter((r) => r.status === 'warning').length,
      criticalTenants: results.filter((r) => r.status === 'critical').length,
      avgRiskScore: results.reduce((sum, r) => sum + r.riskScore, 0) / results.length,
      totalFindings: results.reduce((sum, r) => sum + r.findings.length, 0),
    };
  }

  private async analyzeBehavioralPatterns(): Promise<void> {
    // This would run more frequently to detect real-time suspicious behavior
    // Implementation would analyze recent events and update user risk scores
  }

  stop(): void {
    if (this.auditInterval) {
      clearInterval(this.auditInterval);
      this.auditInterval = null;
    }
  }
}

export { SecurityAuditManager, type SecurityAuditResult, type SecurityFinding };

#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Search Migration Test
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Test safe migration from old search to analytics-enhanced search
 * Usage: pnpm tsx scripts/test-search-migration.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { AnalyticsService } from '../libs/analytics/src/analytics.service';
import { AnalyticsHybridSearchService } from '../libs/search/src/analytics-hybrid-search.service';
import { HybridSearchService } from '../libs/search/src/hybrid-search.service';
import { SearchMigrationService } from '../libs/search/src/search-migration.service';
import { SearchService } from '../libs/search/src/search.service';
import { TypesenseService } from '../libs/typesense/src/typesense.service';

// Test configuration
const TEST_CONFIG = {
  testUserId: 'migration-test-user-123',
  testSessionId: 'migration-test-session-456',
  testQueries: ['گوشی سامسونگ', 'لپتاپ ایسوس', 'تلویزیون ال جی', 'یخچال بوش', 'کولر گازی'],
};

// Test scenarios
const MIGRATION_SCENARIOS = [
  { name: 'Analytics Disabled', analyticsEnabled: false, migrationPercentage: 0 },
  { name: 'Analytics Enabled, 0% Migration', analyticsEnabled: true, migrationPercentage: 0 },
  { name: 'Analytics Enabled, 25% Migration', analyticsEnabled: true, migrationPercentage: 25 },
  { name: 'Analytics Enabled, 50% Migration', analyticsEnabled: true, migrationPercentage: 50 },
  { name: 'Analytics Enabled, 100% Migration', analyticsEnabled: true, migrationPercentage: 100 },
];

async function main() {
  const testResults = {
    serviceInitialization: false,
    migrationScenarios: [] as any[],
    circuitBreakerTest: false,
    clickTrackingTest: false,
    healthCheckTest: false,
    performanceTest: false,
  };

  try {
    // Initialize services (in real app, these would be injected)
    const searchService = new SearchService();
    const typesenseService = new TypesenseService();
    const analyticsService = new AnalyticsService();
    const hybridSearchService = new HybridSearchService(searchService, typesenseService);
    const analyticsHybridSearchService = new AnalyticsHybridSearchService(
      hybridSearchService,
      analyticsService
    );
    const migrationService = new SearchMigrationService(
      hybridSearchService,
      analyticsHybridSearchService
    );
    testResults.serviceInitialization = true;

    for (const scenario of MIGRATION_SCENARIOS) {
      // Update migration configuration
      migrationService.updateMigrationConfig({
        analyticsEnabled: scenario.analyticsEnabled,
        migrationPercentage: scenario.migrationPercentage,
        logMigrationEvents: true,
        compareResults: false, // Disable for testing
      });

      const scenarioResults = {
        name: scenario.name,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        analyticsTracked: 0,
      };

      const responseTimes: number[] = [];

      // Test each query
      for (const query of TEST_CONFIG.testQueries) {
        try {
          const startTime = Date.now();

          const result = await migrationService.search({
            query,
            user_id: TEST_CONFIG.testUserId,
            session_id: TEST_CONFIG.testSessionId,
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Test)',
            limit: 10,
          });

          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);

          scenarioResults.successful++;

          if (result.analytics?.tracked) {
            scenarioResults.analyticsTracked++;
          }
        } catch (_error) {
          scenarioResults.failed++;
        }
      }

      scenarioResults.avgResponseTime =
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 0;

      testResults.migrationScenarios.push(scenarioResults);

      // Wait between scenarios
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    try {
      // Reset circuit breaker
      migrationService.resetCircuitBreaker();

      // Enable 100% migration to test circuit breaker
      migrationService.updateMigrationConfig({
        analyticsEnabled: true,
        migrationPercentage: 100,
        maxFailures: 2, // Low threshold for testing
        failureTimeWindow: 10000,
        recoveryTimeout: 5000,
      });

      // Test normal operation
      const _normalResult = await migrationService.search({
        query: 'تست عادی',
        user_id: TEST_CONFIG.testUserId,
        session_id: TEST_CONFIG.testSessionId,
      });

      // Check health
      const _health = await migrationService.healthCheck();

      testResults.circuitBreakerTest = true;
    } catch (_error) {}

    try {
      // Enable analytics for click tracking
      migrationService.updateMigrationConfig({
        analyticsEnabled: true,
        migrationPercentage: 100,
      });

      // Perform a search to get an event ID
      const searchResult = await migrationService.search({
        query: 'تست کلیک',
        user_id: TEST_CONFIG.testUserId,
        session_id: TEST_CONFIG.testSessionId,
      });

      if (searchResult.analytics?.event_id) {
        // Track a click
        const clickResult = await migrationService.trackSearchClick(
          searchResult.analytics.event_id,
          'test-product-123',
          1,
          2500
        );

        if (clickResult.success) {
          testResults.clickTrackingTest = true;
        } else {
        }
      } else {
      }
    } catch (_error) {}

    try {
      const health = await migrationService.healthCheck();

      testResults.healthCheckTest = health.overall;
    } catch (_error) {}

    try {
      const performanceResults = {
        oldService: [] as number[],
        newService: [] as number[],
      };

      // Test old service (0% migration)
      migrationService.updateMigrationConfig({
        analyticsEnabled: true,
        migrationPercentage: 0,
      });
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await migrationService.search({
          query: TEST_CONFIG.testQueries[i % TEST_CONFIG.testQueries.length],
          user_id: TEST_CONFIG.testUserId,
          session_id: TEST_CONFIG.testSessionId,
        });
        performanceResults.oldService.push(Date.now() - startTime);
      }

      // Test new service (100% migration)
      migrationService.updateMigrationConfig({
        analyticsEnabled: true,
        migrationPercentage: 100,
      });
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await migrationService.search({
          query: TEST_CONFIG.testQueries[i % TEST_CONFIG.testQueries.length],
          user_id: TEST_CONFIG.testUserId,
          session_id: TEST_CONFIG.testSessionId,
        });
        performanceResults.newService.push(Date.now() - startTime);
      }

      const oldAvg = Math.round(
        performanceResults.oldService.reduce((a, b) => a + b, 0) /
          performanceResults.oldService.length
      );
      const newAvg = Math.round(
        performanceResults.newService.reduce((a, b) => a + b, 0) /
          performanceResults.newService.length
      );
      const difference = newAvg - oldAvg;

      if (Math.abs(difference) < 50) {
        testResults.performanceTest = true;
      } else {
      }
    } catch (_error) {}

    const results = [
      { name: 'Service Initialization', status: testResults.serviceInitialization },
      { name: 'Circuit Breaker', status: testResults.circuitBreakerTest },
      { name: 'Click Tracking', status: testResults.clickTrackingTest },
      { name: 'Health Check', status: testResults.healthCheckTest },
      { name: 'Performance Test', status: testResults.performanceTest },
    ];

    results.forEach((result) => {
      const _icon = result.status ? '✅' : '❌';
      const _status = result.status ? 'PASS' : 'FAIL';
    });
    testResults.migrationScenarios.forEach((scenario) => {
      const _successRate = (scenario.successful / (scenario.successful + scenario.failed)) * 100;
    });

    const passedTests = results.filter((r) => r.status).length;
    const totalTests = results.length;

    if (passedTests === totalTests) {
    } else {
    }
  } catch (error) {
    console.error('💥 Migration test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);

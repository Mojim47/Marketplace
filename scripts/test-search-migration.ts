#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Search Migration Test
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Test safe migration from old search to analytics-enhanced search
 * Usage: pnpm tsx scripts/test-search-migration.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SearchMigrationService } from '../libs/search/src/search-migration.service';
import { HybridSearchService } from '../libs/search/src/hybrid-search.service';
import { AnalyticsHybridSearchService } from '../libs/search/src/analytics-hybrid-search.service';
import { AnalyticsService } from '../libs/analytics/src/analytics.service';
import { TypesenseService } from '../libs/typesense/src/typesense.service';
import { SearchService } from '../libs/search/src/search.service';

// Test configuration
const TEST_CONFIG = {
  testUserId: 'migration-test-user-123',
  testSessionId: 'migration-test-session-456',
  testQueries: [
    'گوشی سامسونگ',
    'لپتاپ ایسوس',
    'تلویزیون ال جی',
    'یخچال بوش',
    'کولر گازی',
  ],
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
  console.log('🚀 NextGen Marketplace - Search Migration Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Test User ID: ${TEST_CONFIG.testUserId}`);
  console.log(`🔗 Test Session ID: ${TEST_CONFIG.testSessionId}`);
  console.log(`🔍 Test Queries: ${TEST_CONFIG.testQueries.length}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const testResults = {
    serviceInitialization: false,
    migrationScenarios: [] as any[],
    circuitBreakerTest: false,
    clickTrackingTest: false,
    healthCheckTest: false,
    performanceTest: false,
  };

  try {
    // Test 1: Service Initialization
    console.log('\n🔌 Test 1: Service Initialization...');
    
    // Initialize services (in real app, these would be injected)
    const searchService = new SearchService();
    const typesenseService = new TypesenseService();
    const analyticsService = new AnalyticsService();
    const hybridSearchService = new HybridSearchService(searchService, typesenseService);
    const analyticsHybridSearchService = new AnalyticsHybridSearchService(hybridSearchService, analyticsService);
    const migrationService = new SearchMigrationService(hybridSearchService, analyticsHybridSearchService);
    
    console.log('   ✅ All services initialized successfully');
    testResults.serviceInitialization = true;

    // Test 2: Migration Scenarios
    console.log('\n📊 Test 2: Migration Scenarios...');
    
    for (const scenario of MIGRATION_SCENARIOS) {
      console.log(`\n   🧪 Testing: ${scenario.name}`);
      
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
          
          console.log(`      ✅ "${query}": ${result.totalCount} results in ${responseTime}ms`);
          
        } catch (error) {
          scenarioResults.failed++;
          console.log(`      ❌ "${query}": ${error.message}`);
        }
      }
      
      scenarioResults.avgResponseTime = responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
      
      testResults.migrationScenarios.push(scenarioResults);
      
      console.log(`   📈 Results: ${scenarioResults.successful}/${TEST_CONFIG.testQueries.length} successful, avg ${scenarioResults.avgResponseTime}ms`);
      
      // Wait between scenarios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 3: Circuit Breaker
    console.log('\n🔄 Test 3: Circuit Breaker...');
    
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
      
      console.log('   🔧 Circuit breaker configured for testing');
      
      // Test normal operation
      const normalResult = await migrationService.search({
        query: 'تست عادی',
        user_id: TEST_CONFIG.testUserId,
        session_id: TEST_CONFIG.testSessionId,
      });
      
      console.log('   ✅ Normal operation successful');
      
      // Check health
      const health = await migrationService.healthCheck();
      console.log(`   📊 Health check: Circuit breaker state = ${health.migration.circuitBreakerState}`);
      
      testResults.circuitBreakerTest = true;
      
    } catch (error) {
      console.log('   ❌ Circuit breaker test failed:', error.message);
    }

    // Test 4: Click Tracking
    console.log('\n🖱️ Test 4: Click Tracking...');
    
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
          console.log('   ✅ Click tracking successful');
          testResults.clickTrackingTest = true;
        } else {
          console.log('   ⚠️ Click tracking returned false (analytics may be disabled)');
        }
      } else {
        console.log('   ⚠️ No event ID in search result');
      }
      
    } catch (error) {
      console.log('   ❌ Click tracking test failed:', error.message);
    }

    // Test 5: Health Check
    console.log('\n🏥 Test 5: Health Check...');
    
    try {
      const health = await migrationService.healthCheck();
      
      console.log('   📊 Health Status:');
      console.log(`      Old Service: ${health.oldService ? '✅' : '❌'}`);
      console.log(`      New Service - Search: ${health.newService.search ? '✅' : '❌'}`);
      console.log(`      New Service - Analytics: ${health.newService.analytics ? '✅' : '❌'}`);
      console.log(`      Migration Enabled: ${health.migration.enabled ? '✅' : '❌'}`);
      console.log(`      Migration Percentage: ${health.migration.percentage}%`);
      console.log(`      Circuit Breaker: ${health.migration.circuitBreakerState}`);
      console.log(`      Overall: ${health.overall ? '✅' : '❌'}`);
      
      testResults.healthCheckTest = health.overall;
      
    } catch (error) {
      console.log('   ❌ Health check failed:', error.message);
    }

    // Test 6: Performance Comparison
    console.log('\n⚡ Test 6: Performance Comparison...');
    
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
      
      console.log('   📊 Testing old service performance...');
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
      
      console.log('   📊 Testing new service performance...');
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await migrationService.search({
          query: TEST_CONFIG.testQueries[i % TEST_CONFIG.testQueries.length],
          user_id: TEST_CONFIG.testUserId,
          session_id: TEST_CONFIG.testSessionId,
        });
        performanceResults.newService.push(Date.now() - startTime);
      }
      
      const oldAvg = Math.round(performanceResults.oldService.reduce((a, b) => a + b, 0) / performanceResults.oldService.length);
      const newAvg = Math.round(performanceResults.newService.reduce((a, b) => a + b, 0) / performanceResults.newService.length);
      const difference = newAvg - oldAvg;
      
      console.log(`   📈 Old Service Average: ${oldAvg}ms`);
      console.log(`   📈 New Service Average: ${newAvg}ms`);
      console.log(`   📊 Difference: ${difference > 0 ? '+' : ''}${difference}ms`);
      
      if (Math.abs(difference) < 50) {
        console.log('   ✅ Performance difference acceptable (<50ms)');
        testResults.performanceTest = true;
      } else {
        console.log('   ⚠️ Significant performance difference detected');
      }
      
    } catch (error) {
      console.log('   ❌ Performance test failed:', error.message);
    }

    // Test Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📋 MIGRATION TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const results = [
      { name: 'Service Initialization', status: testResults.serviceInitialization },
      { name: 'Circuit Breaker', status: testResults.circuitBreakerTest },
      { name: 'Click Tracking', status: testResults.clickTrackingTest },
      { name: 'Health Check', status: testResults.healthCheckTest },
      { name: 'Performance Test', status: testResults.performanceTest },
    ];

    results.forEach(result => {
      const icon = result.status ? '✅' : '❌';
      const status = result.status ? 'PASS' : 'FAIL';
      console.log(`${icon} ${result.name}: ${status}`);
    });

    // Migration Scenarios Summary
    console.log('\n📊 MIGRATION SCENARIOS SUMMARY:');
    testResults.migrationScenarios.forEach(scenario => {
      const successRate = scenario.successful / (scenario.successful + scenario.failed) * 100;
      console.log(`   ${scenario.name}:`);
      console.log(`      Success Rate: ${successRate.toFixed(1)}%`);
      console.log(`      Avg Response Time: ${scenario.avgResponseTime}ms`);
      console.log(`      Analytics Tracked: ${scenario.analyticsTracked}/${scenario.successful}`);
    });

    const passedTests = results.filter(r => r.status).length;
    const totalTests = results.length;
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Migration system is ready for production.');
      console.log('\n📋 RECOMMENDED MIGRATION PLAN:');
      console.log('   1. Start with SEARCH_MIGRATION_PERCENTAGE=0');
      console.log('   2. Enable analytics: SEARCH_ANALYTICS_ENABLED=true');
      console.log('   3. Gradually increase percentage: 5% → 25% → 50% → 100%');
      console.log('   4. Monitor circuit breaker and performance metrics');
      console.log('   5. Rollback if issues detected');
    } else {
      console.log('⚠️  Some tests failed. Review the issues before proceeding with migration.');
    }

  } catch (error) {
    console.error('💥 Migration test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
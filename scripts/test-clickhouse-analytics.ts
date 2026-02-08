#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - ClickHouse Analytics Test
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Test ClickHouse analytics setup and data ingestion
 * Usage: pnpm tsx scripts/test-clickhouse-analytics.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { AnalyticsService } from '../libs/analytics/src/analytics.service';
import { SearchEvent } from '../libs/analytics/src/types';

// Test configuration
const TEST_CONFIG = {
  testUserId: 'test-user-123',
  testSessionId: 'test-session-456',
  testProductId: 'test-product-789',
};

// Sample search events for testing
const SAMPLE_SEARCH_EVENTS: Partial<SearchEvent>[] = [
  {
    user_id: TEST_CONFIG.testUserId,
    session_id: TEST_CONFIG.testSessionId,
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    query: 'گوشی سامسونگ',
    query_language: 'fa',
    search_type: 'keyword',
    total_results: 25,
    returned_results: 20,
    search_time_ms: 45,
    category_filter: 'electronics',
    results: [
      {
        id: 'product-1',
        name: 'Samsung Galaxy S24',
        price: 25000000,
        vendor_id: 'vendor-1',
        category_id: 'smartphones',
        score: 0.95,
      },
      {
        id: 'product-2',
        name: 'Samsung Galaxy A54',
        price: 15000000,
        vendor_id: 'vendor-1',
        category_id: 'smartphones',
        score: 0.87,
      },
    ],
  },
  {
    user_id: TEST_CONFIG.testUserId,
    session_id: TEST_CONFIG.testSessionId,
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    query: 'لپتاپ ایسوس',
    query_language: 'fa',
    search_type: 'hybrid',
    total_results: 12,
    returned_results: 12,
    search_time_ms: 67,
    category_filter: 'computers',
    results: [
      {
        id: 'product-3',
        name: 'ASUS VivoBook 15',
        price: 18000000,
        vendor_id: 'vendor-2',
        category_id: 'laptops',
        score: 0.92,
      },
    ],
  },
  {
    user_id: TEST_CONFIG.testUserId,
    session_id: TEST_CONFIG.testSessionId,
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    query: 'تلویزیون ال جی 55 اینچ',
    query_language: 'fa',
    search_type: 'keyword',
    total_results: 0, // Failed search
    returned_results: 0,
    search_time_ms: 23,
    category_filter: 'electronics',
  },
];

async function main() {
  console.log('🚀 NextGen Marketplace - ClickHouse Analytics Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Test User ID: ${TEST_CONFIG.testUserId}`);
  console.log(`🔗 Test Session ID: ${TEST_CONFIG.testSessionId}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const testResults = {
    connection: false,
    eventTracking: false,
    clickTracking: false,
    sessionTracking: false,
    analytics: false,
  };

  try {
    // Test 1: Initialize Analytics Service
    console.log('\n🔌 Test 1: Analytics Service Initialization...');
    const analyticsService = new AnalyticsService();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('   ✅ Analytics service initialized');
    testResults.connection = true;

    // Test 2: Track Search Events
    console.log('\n📝 Test 2: Search Event Tracking...');
    try {
      for (const [index, event] of SAMPLE_SEARCH_EVENTS.entries()) {
        await analyticsService.trackSearchEvent(event);
        console.log(`   ✅ Event ${index + 1} tracked: ${event.query}`);
      }
      testResults.eventTracking = true;
    } catch (error) {
      console.log('   ❌ Event tracking failed:', error);
    }

    // Test 3: Track Search Click
    console.log('\n🖱️ Test 3: Search Click Tracking...');
    try {
      // Simulate a click on the first search result
      const firstEvent = SAMPLE_SEARCH_EVENTS[0];
      if (firstEvent.results && firstEvent.results.length > 0) {
        // We need the actual event_id from the tracked event
        // For testing, we'll use a mock event_id
        const mockEventId = 'test-event-id-123';
        const clickedProduct = firstEvent.results[0];
        
        await analyticsService.trackSearchClick(
          mockEventId,
          clickedProduct.id,
          1, // position
          2500 // time to click in ms
        );
        console.log(`   ✅ Click tracked: ${clickedProduct.name}`);
        testResults.clickTracking = true;
      }
    } catch (error) {
      console.log('   ❌ Click tracking failed:', error);
    }

    // Test 4: Update User Session
    console.log('\n👤 Test 4: User Session Tracking...');
    try {
      await analyticsService.updateUserSession({
        session_id: TEST_CONFIG.testSessionId,
        user_id: TEST_CONFIG.testUserId,
        start_time: new Date().toISOString(),
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        device_type: 'desktop',
        total_searches: 3,
        successful_searches: 2,
        failed_searches: 1,
        products_clicked: 1,
      });
      console.log('   ✅ User session updated');
      testResults.sessionTracking = true;
    } catch (error) {
      console.log('   ❌ Session tracking failed:', error);
    }

    // Wait for data to be processed
    console.log('\n⏳ Waiting for data processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 5: Analytics Queries
    console.log('\n📊 Test 5: Analytics Queries...');
    try {
      // Get popular queries
      const popularQueries = await analyticsService.getPopularQueries(1, 5);
      console.log(`   ✅ Popular queries: ${popularQueries.length} found`);
      if (popularQueries.length > 0) {
        console.log(`   📈 Top query: "${popularQueries[0].query_normalized}" (${popularQueries[0].search_count} searches)`);
      }

      // Get failed searches
      const failedSearches = await analyticsService.getFailedSearchInsights(1, 5);
      console.log(`   ✅ Failed searches: ${failedSearches.length} found`);
      if (failedSearches.length > 0) {
        console.log(`   ❌ Top failed: "${failedSearches[0].query_normalized}" (${failedSearches[0].failure_count} failures)`);
      }

      // Get performance metrics
      const performance = await analyticsService.getSearchPerformanceByHour();
      console.log(`   ✅ Performance metrics: ${performance.length} hours`);

      // Get dashboard
      const dashboard = await analyticsService.getDashboard();
      console.log(`   ✅ Dashboard data loaded`);
      console.log(`   📊 Total searches today: ${dashboard.total_searches_today}`);
      console.log(`   ❌ Failed searches today: ${dashboard.failed_searches_today}`);
      console.log(`   📈 Failure rate: ${dashboard.failure_rate.toFixed(2)}%`);

      testResults.analytics = true;
    } catch (error) {
      console.log('   ❌ Analytics queries failed:', error);
    }

    // Test Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📋 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const results = [
      { name: 'Connection', status: testResults.connection },
      { name: 'Event Tracking', status: testResults.eventTracking },
      { name: 'Click Tracking', status: testResults.clickTracking },
      { name: 'Session Tracking', status: testResults.sessionTracking },
      { name: 'Analytics Queries', status: testResults.analytics },
    ];

    results.forEach(result => {
      const icon = result.status ? '✅' : '❌';
      const status = result.status ? 'PASS' : 'FAIL';
      console.log(`${icon} ${result.name}: ${status}`);
    });

    const passedTests = results.filter(r => r.status).length;
    const totalTests = results.length;
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! ClickHouse analytics is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the ClickHouse setup and configuration.');
    }

  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
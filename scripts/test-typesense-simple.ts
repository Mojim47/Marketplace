#!/usr/bin/env ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Simple Typesense Test
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Test basic Typesense functionality
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TypesenseService } from '../libs/typesense/src/typesense.service';

// Test configuration
const TEST_CONFIG = {
  testProductId: 'test-product-simple-' + Date.now(),
};

// Sample test product
const SAMPLE_PRODUCT = {
  id: TEST_CONFIG.testProductId,
  name: 'گوشی هوشمند سامسونگ Galaxy S24 Ultra',
  nameEn: 'Samsung Galaxy S24 Ultra Smartphone',
  description: 'گوشی هوشمند پرچمدار سامسونگ با دوربین 200 مگاپیکسل',
  shortDescription: 'گوشی پرچمدار سامسونگ',
  price: 45000000,
  salePrice: 42000000,
  discountPercentage: 7,
  categoryId: 'cat-smartphones',
  categoryName: 'گوشی هوشمند',
  categoryPath: ['الکترونیک', 'موبایل', 'گوشی هوشمند'],
  brandId: 'brand-samsung',
  brandName: 'Samsung',
  vendorId: 'vendor-techstore',
  vendorName: 'فروشگاه تکنولوژی',
  vendorTier: 'GOLD' as const,
  inStock: true,
  stockQuantity: 25,
  rating: 4.8,
  reviewCount: 156,
  totalSales: 89,
  tags: ['گوشی', 'سامسونگ', 'اندروید', 'پرچمدار'],
  sku: 'SAM-S24U-256-BLK',
  persianName: 'گوشی هوشمند سامسونگ Galaxy S24 Ultra',
  persianDescription: 'گوشی هوشمند پرچمدار سامسونگ با دوربین 200 مگاپیکسل',
  persianTags: ['گوشی', 'سامسونگ', 'اندروید', 'پرچمدار'],
  embedding: new Array(384).fill(0).map(() => Math.random()), // Mock embedding
  status: 'ACTIVE' as const,
  featured: true,
  hasDiscount: true,
  hasWarranty: true,
  hasInstallation: false,
  createdAt: Math.floor(Date.now() / 1000),
  updatedAt: Math.floor(Date.now() / 1000),
};

async function main() {
  console.log('🚀 NextGen Marketplace - Simple Typesense Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Test Product ID: ${TEST_CONFIG.testProductId}`);
  console.log('═══════════════════════════════════════════════════════════════');

  let testResults = {
    connection: false,
    collectionStats: false,
    indexing: false,
    keywordSearch: false,
    vectorSearch: false,
    suggestions: false,
  };

  try {
    // Test 1: Connection & Health
    console.log('\n🔌 Test 1: Typesense Connection & Health...');
    const typesenseService = new TypesenseService();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isHealthy = await typesenseService.healthCheck();
    if (isHealthy) {
      console.log('   ✅ Typesense connection successful');
      testResults.connection = true;
    } else {
      console.log('   ❌ Typesense connection failed');
    }

    // Test 2: Collection Stats
    console.log('\n📊 Test 2: Collection Stats...');
    try {
      const stats = await typesenseService.getStats();
      console.log(`   ✅ Collection: ${stats.collectionName}`);
      console.log(`   📈 Documents: ${stats.totalDocuments}`);
      console.log(`   🔧 Fields: ${stats.fields.length}`);
      testResults.collectionStats = true;
    } catch (error) {
      console.log('   ❌ Collection stats failed:', error);
    }

    // Test 3: Document Indexing
    console.log('\n📝 Test 3: Document Indexing...');
    try {
      await typesenseService.indexProduct(SAMPLE_PRODUCT);
      console.log('   ✅ Product indexed successfully');
      testResults.indexing = true;
      
      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log('   ❌ Document indexing failed:', error);
    }

    // Test 4: Keyword Search
    console.log('\n🔍 Test 4: Keyword Search...');
    try {
      const keywordResults = await typesenseService.keywordSearch('سامسونگ گوشی', {
        perPage: 5,
      });
      
      console.log(`   ✅ Found: ${keywordResults.found} results`);
      console.log(`   ⏱️ Time: ${keywordResults.search_time_ms}ms`);
      
      if (keywordResults.hits.length > 0) {
        const firstHit = keywordResults.hits[0];
        console.log(`   📱 Result: ${firstHit.document.name}`);
        testResults.keywordSearch = true;
      }
    } catch (error) {
      console.log('   ❌ Keyword search failed:', error);
    }

    // Test 5: Vector Search
    console.log('\n🧠 Test 5: Vector Search...');
    try {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      
      const vectorResults = await typesenseService.vectorSearch(queryEmbedding, {
        k: 5,
      });
      
      console.log(`   ✅ Found: ${vectorResults.found} results`);
      console.log(`   ⏱️ Time: ${vectorResults.search_time_ms}ms`);
      
      if (vectorResults.hits.length > 0) {
        testResults.vectorSearch = true;
      }
    } catch (error) {
      console.log('   ❌ Vector search failed:', error);
    }

    // Test 6: Suggestions
    console.log('\n💡 Test 6: Search Suggestions...');
    try {
      const suggestions = await typesenseService.getSuggestions('گوشی', 5);
      console.log(`   ✅ Suggestions: ${suggestions.length}`);
      suggestions.forEach((suggestion: string, index: number) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
      if (suggestions.length > 0) {
        testResults.suggestions = true;
      }
    } catch (error) {
      console.log('   ❌ Suggestions failed:', error);
    }

    // Test Results Summary
    console.log('\n📋 Test Results Summary');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    Object.entries(testResults).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`   ${status} ${testName}`);
    });
    
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`📊 Success Rate: ${passedTests}/${totalTests} (${successRate}%)`);
    
    if (successRate >= 80) {
      console.log('🎉 Typesense is working well!');
    } else if (successRate >= 60) {
      console.log('⚠️ Some issues need attention.');
    } else {
      console.log('❌ Significant issues found.');
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      const typesenseService = new TypesenseService();
      await typesenseService.deleteProduct(TEST_CONFIG.testProductId);
      console.log('   ✅ Test product deleted');
    } catch (error) {
      console.log('   ⚠️ Cleanup warning:', error);
    }
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}
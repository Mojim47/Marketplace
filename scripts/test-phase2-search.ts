#!/usr/bin/env ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Phase 2 Search Intelligence Test Script
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Test the complete Phase 2 implementation
 * Tests: Typesense setup, workflow integration, hybrid search
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TypesenseService } from '../libs/typesense/src/typesense.service';
import { DataTransformerService } from '../libs/search/src';

// Test configuration
const TEST_CONFIG = {
  typesenseUrl: process.env['TYPESENSE_HOST'] || 'http://localhost:8108',
  typesenseApiKey:
    process.env['TYPESENSE_API_KEY'] || 'typesense_test_api_key__secure_and_long__2024_v1',
  temporalAddress: process.env['TEMPORAL_ADDRESS'] || 'localhost:7233',
  testProductId: 'test-product-phase2-' + Date.now(),
};

// Sample test data
const SAMPLE_PRODUCT = {
  id: TEST_CONFIG.testProductId,
  name: 'گوشی هوشمند سامسونگ Galaxy S24 Ultra',
  nameEn: 'Samsung Galaxy S24 Ultra Smartphone',
  description: 'گوشی هوشمند پرچمدار سامسونگ با دوربین 200 مگاپیکسل و نمایشگر Dynamic AMOLED',
  shortDescription: 'گوشی پرچمدار سامسونگ',
  price: 45000000,
  salePrice: 42000000,
  categoryId: 'cat-smartphones',
  category: {
    id: 'cat-smartphones',
    name: 'گوشی هوشمند',
    path: '/electronics/mobile/smartphones',
  },
  brandId: 'brand-samsung',
  brand: {
    id: 'brand-samsung',
    name: 'Samsung',
  },
  vendorId: 'vendor-techstore',
  vendor: {
    id: 'vendor-techstore',
    name: 'فروشگاه تکنولوژی',
    tier: 'GOLD' as const,
  },
  inStock: true,
  stockQuantity: 25,
  rating: 4.8,
  reviewCount: 156,
  totalSales: 89,
  status: 'ACTIVE' as const,
  featured: true,
  tags: ['گوشی', 'سامسونگ', 'اندروید', 'پرچمدار'],
  sku: 'SAM-S24U-256-BLK',
  hasWarranty: true,
  hasInstallation: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  aiEmbedding: {
    embedding: new Array(384).fill(0).map(() => Math.random()), // Mock embedding
  },
};

async function main() {
  console.log('🚀 NextGen Marketplace - Phase 2 Search Intelligence Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Configuration:`);
  console.log(`   - Typesense URL: ${TEST_CONFIG.typesenseUrl}`);
  console.log(`   - Temporal Address: ${TEST_CONFIG.temporalAddress}`);
  console.log(`   - Test Product ID: ${TEST_CONFIG.testProductId}`);
  console.log('═══════════════════════════════════════════════════════════════');

  let testResults = {
    typesenseConnection: false,
    collectionCreation: false,
    documentIndexing: false,
    keywordSearch: false,
    vectorSearch: false,
    hybridSearch: false,
    temporalWorkflow: false,
    dataTransformation: false,
  };

  try {
    // Test 1: Typesense Connection & Health
    console.log('\n🔌 Test 1: Typesense Connection & Health...');
    const typesenseService = new TypesenseService();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isHealthy = await typesenseService.healthCheck();
    if (isHealthy) {
      console.log('   ✅ Typesense connection successful');
      testResults.typesenseConnection = true;
    } else {
      console.log('   ❌ Typesense connection failed');
    }

    // Test 2: Collection Creation & Stats
    console.log('\n📊 Test 2: Collection Creation & Stats...');
    try {
      const stats = await typesenseService.getStats();
      console.log(`   ✅ Collection exists: ${stats.collectionName}`);
      console.log(`   📈 Total documents: ${stats.totalDocuments}`);
      console.log(`   🔧 Fields count: ${stats.fields.length}`);
      testResults.collectionCreation = true;
    } catch (error) {
      console.log('   ❌ Collection creation/stats failed:', error);
    }

    // Test 3: Data Transformation
    console.log('\n🔄 Test 3: Data Transformation...');
    try {
      const transformer = new DataTransformerService();
      
      const meilisearchDoc = transformer.transformToMeilisearchDocument(SAMPLE_PRODUCT);
      const typesenseDoc = transformer.transformToTypesenseDocument(SAMPLE_PRODUCT);
      
      console.log(`   ✅ Meilisearch document: ${meilisearchDoc.name}`);
      console.log(`   ✅ Typesense document: ${typesenseDoc.name}`);
      console.log(`   📊 Price: ${typesenseDoc.price.toLocaleString()} تومان`);
      console.log(`   🏷️ Discount: ${typesenseDoc.discountPercentage}%`);
      console.log(`   🔢 Embedding dimensions: ${typesenseDoc.embedding?.length || 'N/A'}`);
      
      const isValid = transformer.validateSearchDocument(typesenseDoc);
      if (isValid) {
        console.log('   ✅ Document validation passed');
        testResults.dataTransformation = true;
      } else {
        console.log('   ❌ Document validation failed');
      }
    } catch (error) {
      console.log('   ❌ Data transformation failed:', error);
    }

    // Test 4: Document Indexing
    console.log('\n📝 Test 4: Document Indexing...');
    try {
      const transformer = new DataTransformerService();
      const typesenseDoc = transformer.transformToTypesenseDocument(SAMPLE_PRODUCT);
      
      await typesenseService.indexProduct(typesenseDoc);
      console.log('   ✅ Product indexed successfully');
      testResults.documentIndexing = true;
      
      // Wait for indexing to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log('   ❌ Document indexing failed:', error);
    }

    // Test 5: Keyword Search
    console.log('\n🔍 Test 5: Keyword Search...');
    try {
      const keywordResults = await typesenseService.keywordSearch('سامسونگ گوشی', {
        perPage: 5,
      });
      
      console.log(`   ✅ Keyword search results: ${keywordResults.found} found`);
      console.log(`   ⏱️ Search time: ${keywordResults.search_time_ms}ms`);
      
      if (keywordResults.hits.length > 0) {
        const firstHit = keywordResults.hits[0];
        console.log(`   📱 First result: ${firstHit.document.name}`);
        console.log(`   📊 Relevance score: ${firstHit.text_match}`);
        testResults.keywordSearch = true;
      }
    } catch (error) {
      console.log('   ❌ Keyword search failed:', error);
    }

    // Test 6: Vector Search (Semantic)
    console.log('\n🧠 Test 6: Vector Search (Semantic)...');
    try {
      // Generate a mock query embedding
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      
      const vectorResults = await typesenseService.vectorSearch(queryEmbedding, {
        k: 5,
      });
      
      console.log(`   ✅ Vector search results: ${vectorResults.found} found`);
      console.log(`   ⏱️ Search time: ${vectorResults.search_time_ms}ms`);
      
      if (vectorResults.hits.length > 0) {
        const firstHit = vectorResults.hits[0];
        console.log(`   📱 First result: ${firstHit.document.name}`);
        console.log(`   🎯 Vector distance: ${firstHit.vector_distance || 'N/A'}`);
        testResults.vectorSearch = true;
      }
    } catch (error) {
      console.log('   ❌ Vector search failed:', error);
    }

    // Test 7: Hybrid Search
    console.log('\n🔀 Test 7: Hybrid Search...');
    try {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      
      const hybridResults = await typesenseService.hybridSearch({
        q: 'گوشی هوشمند',
        vector_query: {
          vector: queryEmbedding,
          k: 10,
        },
        vector_query_weight: 0.3, // 30% vector, 70% keyword
        per_page: 5,
      });
      
      console.log(`   ✅ Hybrid search results: ${hybridResults.found} found`);
      console.log(`   ⏱️ Search time: ${hybridResults.search_time_ms}ms`);
      
      if (hybridResults.hits.length > 0) {
        const firstHit = hybridResults.hits[0];
        console.log(`   📱 First result: ${firstHit.document.name}`);
        console.log(`   📊 Text match: ${firstHit.text_match}`);
        console.log(`   🎯 Vector distance: ${firstHit.vector_distance || 'N/A'}`);
        testResults.hybridSearch = true;
      }
    } catch (error) {
      console.log('   ❌ Hybrid search failed:', error);
    }

    // Test 8: Temporal Workflow Integration (Commented out for now)
    console.log('\n⏰ Test 8: Temporal Workflow Integration...');
    console.log('   ⚠️ Temporal workflow test skipped - requires full setup');
    // try {
    //   // Connect to Temporal
    //   await temporalClient.connect({
    //     address: TEST_CONFIG.temporalAddress,
    //     namespace: 'default',
    //   });
    //   
    //   const syncService = new ProductSyncService();
    //   
    //   // Start a sync workflow
    //   const workflowId = await syncService.startSync({
    //     productId: TEST_CONFIG.testProductId,
    //     operation: 'CREATE',
    //     source: 'POSTGRESQL',
    //     data: SAMPLE_PRODUCT,
    //   });
    //   
    //   console.log(`   ✅ Workflow started: ${workflowId}`);
    //   
    //   // Wait a bit and check status
    //   await new Promise(resolve => setTimeout(resolve, 3000));
    //   
    //   const status = await syncService.getStatus(workflowId);
    //   console.log(`   📊 Workflow status: ${status.status}`);
    //   console.log(`   🔄 Attempts: ${status.attempts}`);
    //   
    //   if (status.status === 'COMPLETED' || status.status === 'IN_PROGRESS') {
    //     testResults.temporalWorkflow = true;
    //   }
    //   
    // } catch (error) {
    //   console.log('   ❌ Temporal workflow test failed:', error);
    // }

    // Test 9: Suggestions/Autocomplete
    console.log('\n💡 Test 9: Search Suggestions...');
    try {
      const suggestions = await typesenseService.getSuggestions('گوشی', 5);
      console.log(`   ✅ Suggestions found: ${suggestions.length}`);
      suggestions.forEach((suggestion: string, index: number) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
    } catch (error) {
      console.log('   ❌ Suggestions test failed:', error);
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
    console.log(`📊 Overall Success Rate: ${passedTests}/${totalTests} (${successRate}%)`);
    
    if (successRate >= 80) {
      console.log('🎉 Phase 2 implementation is working well!');
    } else if (successRate >= 60) {
      console.log('⚠️ Phase 2 implementation has some issues that need attention.');
    } else {
      console.log('❌ Phase 2 implementation needs significant fixes.');
    }

  } catch (error) {
    console.error('💥 Test script failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    try {
      const typesenseService = new TypesenseService();
      await typesenseService.deleteProduct(TEST_CONFIG.testProductId);
      console.log('   ✅ Test product deleted from Typesense');
    } catch (error) {
      console.log('   ⚠️ Cleanup warning:', error);
    }
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

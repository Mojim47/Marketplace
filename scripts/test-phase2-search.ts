#!/usr/bin/env ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Phase 2 Search Intelligence Test Script
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Test the complete Phase 2 implementation
 * Tests: Typesense setup, workflow integration, hybrid search
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DataTransformerService } from '../libs/search/src';
import { TypesenseService } from '../libs/typesense/src/typesense.service';

// Test configuration
const TEST_CONFIG = {
  typesenseUrl: process.env.TYPESENSE_HOST || 'http://localhost:8108',
  typesenseApiKey:
    process.env.TYPESENSE_API_KEY || 'typesense_test_api_key__secure_and_long__2024_v1',
  temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  testProductId: `test-product-phase2-${Date.now()}`,
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
  const testResults = {
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
    const typesenseService = new TypesenseService();

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const isHealthy = await typesenseService.healthCheck();
    if (isHealthy) {
      testResults.typesenseConnection = true;
    } else {
    }
    try {
      const _stats = await typesenseService.getStats();
      testResults.collectionCreation = true;
    } catch (_error) {}
    try {
      const transformer = new DataTransformerService();

      const _meilisearchDoc = transformer.transformToMeilisearchDocument(SAMPLE_PRODUCT);
      const typesenseDoc = transformer.transformToTypesenseDocument(SAMPLE_PRODUCT);

      const isValid = transformer.validateSearchDocument(typesenseDoc);
      if (isValid) {
        testResults.dataTransformation = true;
      } else {
      }
    } catch (_error) {}
    try {
      const transformer = new DataTransformerService();
      const typesenseDoc = transformer.transformToTypesenseDocument(SAMPLE_PRODUCT);

      await typesenseService.indexProduct(typesenseDoc);
      testResults.documentIndexing = true;

      // Wait for indexing to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (_error) {}
    try {
      const keywordResults = await typesenseService.keywordSearch('سامسونگ گوشی', {
        perPage: 5,
      });

      if (keywordResults.hits.length > 0) {
        const _firstHit = keywordResults.hits[0];
        testResults.keywordSearch = true;
      }
    } catch (_error) {}
    try {
      // Generate a mock query embedding
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());

      const vectorResults = await typesenseService.vectorSearch(queryEmbedding, {
        k: 5,
      });

      if (vectorResults.hits.length > 0) {
        const _firstHit = vectorResults.hits[0];
        testResults.vectorSearch = true;
      }
    } catch (_error) {}
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

      if (hybridResults.hits.length > 0) {
        const _firstHit = hybridResults.hits[0];
        testResults.hybridSearch = true;
      }
    } catch (_error) {}
    try {
      const suggestions = await typesenseService.getSuggestions('گوشی', 5);
      suggestions.forEach((_suggestion: string, _index: number) => {});
    } catch (_error) {}

    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const successRate = Math.round((passedTests / totalTests) * 100);

    Object.entries(testResults).forEach(([test, passed]) => {
      const _status = passed ? '✅' : '❌';
      const _testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
    });

    if (successRate >= 80) {
    } else if (successRate >= 60) {
    } else {
    }
  } catch (error) {
    console.error('💥 Test script failed:', error);
  } finally {
    try {
      const typesenseService = new TypesenseService();
      await typesenseService.deleteProduct(TEST_CONFIG.testProductId);
    } catch (_error) {}
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

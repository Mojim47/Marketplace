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
  testProductId: `test-product-simple-${Date.now()}`,
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
  const testResults = {
    connection: false,
    collectionStats: false,
    indexing: false,
    keywordSearch: false,
    vectorSearch: false,
    suggestions: false,
  };

  try {
    const typesenseService = new TypesenseService();

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const isHealthy = await typesenseService.healthCheck();
    if (isHealthy) {
      testResults.connection = true;
    } else {
    }
    try {
      const _stats = await typesenseService.getStats();
      testResults.collectionStats = true;
    } catch (_error) {}
    try {
      await typesenseService.indexProduct(SAMPLE_PRODUCT);
      testResults.indexing = true;

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
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());

      const vectorResults = await typesenseService.vectorSearch(queryEmbedding, {
        k: 5,
      });

      if (vectorResults.hits.length > 0) {
        testResults.vectorSearch = true;
      }
    } catch (_error) {}
    try {
      const suggestions = await typesenseService.getSuggestions('گوشی', 5);
      suggestions.forEach((_suggestion: string, _index: number) => {});
      if (suggestions.length > 0) {
        testResults.suggestions = true;
      }
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
    console.error('💥 Test failed:', error);
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

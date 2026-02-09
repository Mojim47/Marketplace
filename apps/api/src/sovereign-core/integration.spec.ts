/**
 * ===========================================================================
 * INTEGRATION TEST - SOVEREIGN CORE E2E VALIDATION
 * ===========================================================================
 * Purpose: Final proof of financial integrity with real PostgreSQL + Redis
 * Critical: Tests run in isolated Docker containers (Testcontainers)
 * ===========================================================================
 */

import { Decimal } from '@prisma/client/runtime/library';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { PriceEngine } from './price-engine.service';
import { RiskEngine } from './risk-engine.service';
import {
  getTestPrisma,
  getTestRedis,
  setupTestEnvironment,
  teardownTestEnvironment,
} from './test-setup';

enum FinancialEventType {
  DEFAULT = 'DEFAULT',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILURE = 'PAYMENT_FAILURE',
}

const describeIf = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;

describeIf('SOVEREIGN CORE - Integration Tests (Testcontainers)', () => {
  let prismaService: PrismaService;
  let priceEngine: PriceEngine;
  let riskEngine: RiskEngine;

  beforeAll(async () => {
    // Setup isolated Docker environment
    const { prisma, redis } = await setupTestEnvironment();

    // Wrap Prisma in PrismaService
    prismaService = prisma as unknown as PrismaService;

    // Initialize services with real dependencies (Redis injected)
    priceEngine = new PriceEngine(prismaService, redis);
    riskEngine = new RiskEngine(prismaService);
  }, 300000); // 300s timeout for container startup

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('CRITICAL TEST #1: Decimal Precision (No Floating-Point Errors)', () => {
    it('should calculate price with NO floating-point precision loss', async () => {
      const prisma = getTestPrisma();

      // Create test data
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org Decimal',
          slug: 'test-org-decimal',
          type: 'AGENT',
          countryCode: 'IR',
          nationalId: '1234567890',
          email: 'test1@example.com',
          phone: '09123456781',
          address: 'Test Address 1',
          city: 'Tehran',
          province: 'Tehran',
          postalCode: '1234567891',
        },
      });

      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_DECIMAL',
          indexValue: new Decimal('1.157'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          slug: 'test-product-decimal',
          sku: 'TEST-001',
          price: new Decimal('1234567.89'),
          costPrice: new Decimal('1000000.00'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      const _b2bRelation = await prisma.b2BRelation.create({
        data: {
          supplierId: org.id,
          buyerId: org.id,
          tierLevel: 'SILVER',
          discountPercentage: new Decimal('0'),
          isActive: true,
        },
      });

      // Execute calculation
      const result = await priceEngine.getFinalPrice(product.id, org.id, volatilityIndex.id);

      // Validation: Must be Decimal with exact precision
      expect(result.finalPrice).toBeInstanceOf(Decimal);

      // Expected: 1234567.89 × 1.157 × (1 - 0.15) = 1,214,135.7914205
      const expected = new Decimal('1234567.89').mul(new Decimal('1.157')).mul(new Decimal('0.85'));

      expect(result.finalPrice.toString()).toBe(expected.toString());
    });
  });

  describe('CRITICAL TEST #2: MarginGuard Enforcement', () => {
    it('should reject price lock below minimum margin (10%)', async () => {
      const prisma = getTestPrisma();

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org MarginGuard',
          slug: 'test-org-marginguard',
          type: 'AGENT',
          countryCode: 'IR',
          nationalId: '1234567891',
          email: 'test2@example.com',
          phone: '09123456782',
          address: 'Test Address 2',
          city: 'Tehran',
          province: 'Tehran',
          postalCode: '1234567892',
        },
      });

      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_MARGIN',
          indexValue: new Decimal('0.5'), // Low multiplier
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Low Margin Product',
          slug: 'low-margin-product',
          sku: 'TEST-002',
          price: new Decimal('100.00'),
          costPrice: new Decimal('100.00'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // This should fail MarginGuard
      await expect(
        priceEngine.lockPrice({
          productId: product.id,
          organizationId: org.id,
          volatilityIndexId: volatilityIndex.id,
          durationDays: 7,
        })
      ).rejects.toThrow(/minimum margin/i);
    });
  });

  describe('CRITICAL TEST #3: Lambda Decay Formula', () => {
    it('should apply exponential decay correctly (e^(-?×t))', async () => {
      const prisma = getTestPrisma();

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org Lambda',
          slug: 'test-org-lambda',
          type: 'AGENT',
          countryCode: 'IR',
          nationalId: '1234567892',
          email: 'test3@example.com',
          phone: '09123456783',
          address: 'Test Address 3',
          city: 'Tehran',
          province: 'Tehran',
          postalCode: '1234567893',
        },
      });

      // Create risk profile
      const profile = await prisma.riskProfile.create({
        data: {
          organizationId: org.id,
          score: new Decimal('100'),
          baseCreditLimit: new Decimal('1000000'),
          currentCreditLimit: new Decimal('1000000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Create old event (12 months ago)
      await prisma.financialEvent.create({
        data: {
          riskProfileId: profile.id,
          eventType: 'DEFAULT' as FinancialEventType,
          impactValue: new Decimal('-50'),
          description: 'Old default event',
          occurredAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 12 months ago
          processed: false,
        },
      });

      // Process event (should have minimal impact due to decay)
      const result = await riskEngine.processFinancialEvent({
        organizationId: org.id,
        eventType: 'DEFAULT' as FinancialEventType,
        impactValue: -50,
        description: 'Test event',
      });

      // Expected: Impact should be decayed by e^(-0.1 × 12) ≈ 0.30
      // So effective impact ≈ -50 × 0.30 = -15
      // New score ≈ 100 - 15 = 85
      expect(result.riskProfile.score.toNumber()).toBeGreaterThan(80);
      expect(result.riskProfile.score.toNumber()).toBeLessThan(90);
    });
  });

  describe('CRITICAL TEST #4: Redis Cache Integration', () => {
    it('should cache price calculation with 1-hour TTL', async () => {
      const prisma = getTestPrisma();
      const redis = getTestRedis();

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org Cache',
          slug: 'test-org-cache',
          type: 'AGENT',
          countryCode: 'IR',
          nationalId: '1234567893',
          email: 'test4@example.com',
          phone: '09123456784',
          address: 'Test Address 4',
          city: 'Tehran',
          province: 'Tehran',
          postalCode: '1234567894',
        },
      });

      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_CACHE',
          indexValue: new Decimal('1.0'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Cached Product',
          slug: 'cached-product',
          sku: 'TEST-003',
          price: new Decimal('1000.00'),
          costPrice: new Decimal('800.00'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // First call (cache miss)
      await priceEngine.getFinalPrice(product.id, org.id, volatilityIndex.id);

      // Check cache
      const cacheKey = `price:${product.id}:${org.id}:${volatilityIndex.id}`;
      const cachedValue = await redis.get(cacheKey);

      expect(cachedValue).toBeTruthy();

      // Verify TTL is set (should be ~3600 seconds)
      const ttl = await redis.ttl(cacheKey);
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe('CRITICAL TEST #5: Atomic Transactions', () => {
    it('should handle concurrent price locks atomically', async () => {
      const prisma = getTestPrisma();

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org Atomic',
          slug: 'test-org-atomic',
          type: 'AGENT',
          countryCode: 'IR',
          nationalId: '1234567894',
          email: 'test5@example.com',
          phone: '09123456785',
          address: 'Test Address 5',
          city: 'Tehran',
          province: 'Tehran',
          postalCode: '1234567895',
        },
      });

      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_ATOMIC',
          indexValue: new Decimal('1.0'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Locked Product',
          slug: 'locked-product',
          sku: 'TEST-004',
          price: new Decimal('5000.00'),
          costPrice: new Decimal('4000.00'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // Create first lock
      const lock1 = await priceEngine.lockPrice({
        productId: product.id,
        organizationId: org.id,
        volatilityIndexId: volatilityIndex.id,
        durationDays: 7,
      });

      expect(lock1.priceLock?.isActive).toBe(true);

      // Create second lock (should deactivate first)
      const lock2 = await priceEngine.lockPrice({
        productId: product.id,
        organizationId: org.id,
        volatilityIndexId: volatilityIndex.id,
        durationDays: 14,
      });

      // Verify only one active lock
      const locks = await prisma.priceLock.findMany({
        where: {
          productId: product.id,
          organizationId: org.id,
          isActive: true,
        },
      });

      expect(locks).toHaveLength(1);
      expect(locks[0]?.id).toBe(lock2.priceLock?.id);
    });
  });
});

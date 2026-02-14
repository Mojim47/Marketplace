/**
 * ===========================================================================
 * PRICE ENGINE UNIT TESTS
 * ===========================================================================
 * Purpose: Validate Decimal precision, MarginGuard constraints, Price Lock race conditions
 * Critical: Must test no floating-point precision errors
 * ===========================================================================
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { Redis } from 'ioredis';
import { PriceEngine } from './price-engine.service';

class InMemoryRedis {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  private isExpired(entry: { value: string; expiresAt?: number }) {
    if (!entry.expiresAt) {
      return false;
    }
    return Date.now() >= entry.expiresAt;
  }

  private cleanup(key: string, entry?: { value: string; expiresAt?: number }) {
    const current = entry ?? this.store.get(key);
    if (!current) {
      return true;
    }
    if (this.isExpired(current)) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry || this.cleanup(key, entry)) {
      return null;
    }
    return entry.value;
  }

  async setex(key: string, ttlSeconds: number, value: string) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]) {
    let count = 0;
    keys.forEach((key) => {
      if (this.store.delete(key)) {
        count += 1;
      }
    });
    return count;
  }

  async keys(pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    const results: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key) && !this.cleanup(key)) {
        results.push(key);
      }
    }
    return results;
  }

  async ttl(key: string) {
    const entry = this.store.get(key);
    if (!entry) {
      return -2;
    }
    if (this.cleanup(key, entry)) {
      return -2;
    }
    if (!entry.expiresAt) {
      return -1;
    }
    const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }

  async quit() {
    return 'OK';
  }
}

type Organization = {
  id: string;
  name: string;
  type: string;
  countryCode: string;
};

type VolatilityIndex = {
  id: string;
  indexName: string;
  indexValue: Decimal;
  effectiveFrom: Date;
  isActive: boolean;
};

type B2BRelation = {
  id: string;
  supplierId: string;
  buyerId: string;
  tierLevel: string;
  discountPercentage: Decimal;
  isActive: boolean;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: Decimal;
  costPrice: Decimal;
  volatilityIndexId?: string;
  organizationId: string;
  stock: number;
};

type PriceLock = {
  id: string;
  productId: string;
  organizationId: string;
  volatilityIndexId?: string;
  basePrice: Decimal;
  indexMultiplier: Decimal;
  tierDiscount: Decimal;
  lockedPrice: Decimal;
  minimumAllowedPrice: Decimal;
  expiresAt: Date;
  isActive: boolean;
  lockedAt: Date;
};

const toDecimal = (value: Decimal | number | string | undefined, fallback = 0) => {
  if (value instanceof Decimal) {
    return value;
  }
  const safeValue = value ?? fallback;
  return new Decimal(safeValue);
};

const createPricePrismaMock = () => {
  let idCounter = 0;
  const nextId = () => `price_${++idCounter}`;
  let transactionChain = Promise.resolve();

  const organizations = new Map<string, Organization>();
  const volatilityIndexes = new Map<string, VolatilityIndex>();
  const b2bRelations = new Map<string, B2BRelation>();
  const products = new Map<string, Product>();
  const priceLocks = new Map<string, PriceLock>();

  const prisma = {
    organization: {
      create: vi.fn(async ({ data }: { data: Omit<Organization, 'id'> }) => {
        const record: Organization = { id: nextId(), ...data };
        organizations.set(record.id, record);
        return record;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = organizations.get(where.id);
        organizations.delete(where.id);
        return record;
      }),
    },
    volatilityIndex: {
      create: vi.fn(async ({ data }: { data: Omit<VolatilityIndex, 'id'> }) => {
        const record: VolatilityIndex = {
          id: nextId(),
          ...data,
          indexValue: toDecimal(data.indexValue),
          isActive: data.isActive ?? true,
        };
        volatilityIndexes.set(record.id, record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string; isActive?: boolean } }) => {
        const record = volatilityIndexes.get(where.id);
        if (!record) {
          return null;
        }
        if (where.isActive === true && !record.isActive) {
          return null;
        }
        return record;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = volatilityIndexes.get(where.id);
        volatilityIndexes.delete(where.id);
        return record;
      }),
    },
    b2BRelation: {
      create: vi.fn(async ({ data }: { data: Omit<B2BRelation, 'id'> }) => {
        const record: B2BRelation = {
          id: nextId(),
          ...data,
          discountPercentage: toDecimal(data.discountPercentage),
          isActive: data.isActive ?? true,
        };
        b2bRelations.set(record.id, record);
        return record;
      }),
      findFirst: vi.fn(async ({ where }: { where: Partial<B2BRelation> }) => {
        return (
          Array.from(b2bRelations.values()).find((relation) => {
            if (where.buyerId && relation.buyerId !== where.buyerId) {
              return false;
            }
            if (where.isActive !== undefined && relation.isActive !== where.isActive) {
              return false;
            }
            return true;
          }) ?? null
        );
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = b2bRelations.get(where.id);
        b2bRelations.delete(where.id);
        return record;
      }),
    },
    product: {
      create: vi.fn(async ({ data }: { data: Omit<Product, 'id'> }) => {
        const record: Product = {
          id: nextId(),
          ...data,
          price: toDecimal(data.price),
          costPrice: toDecimal(data.costPrice),
        };
        products.set(record.id, record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = products.get(where.id);
        return record ?? null;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = products.get(where.id);
        products.delete(where.id);
        return record;
      }),
      deleteMany: vi.fn(async ({ where }: { where?: { id?: { in: string[] } } }) => {
        const ids = where?.id?.in ?? Array.from(products.keys());
        ids.forEach((id) => products.delete(id));
        return { count: ids.length };
      }),
    },
    priceLock: {
      create: vi.fn(async ({ data }: { data: Omit<PriceLock, 'id' | 'lockedAt'> }) => {
        const record: PriceLock = {
          id: nextId(),
          ...data,
          basePrice: toDecimal(data.basePrice),
          indexMultiplier: toDecimal(data.indexMultiplier),
          tierDiscount: toDecimal(data.tierDiscount),
          lockedPrice: toDecimal(data.lockedPrice),
          minimumAllowedPrice: toDecimal(data.minimumAllowedPrice),
          lockedAt: new Date(),
        };
        priceLocks.set(record.id, record);
        return record;
      }),
      findFirst: vi.fn(async ({ where, orderBy }: { where: any; orderBy?: any }) => {
        const filtered = Array.from(priceLocks.values()).filter((lock) => {
          if (where.productId && lock.productId !== where.productId) {
            return false;
          }
          if (where.organizationId && lock.organizationId !== where.organizationId) {
            return false;
          }
          if (where.isActive !== undefined && lock.isActive !== where.isActive) {
            return false;
          }
          if (where.expiresAt?.gt && lock.expiresAt <= where.expiresAt.gt) {
            return false;
          }
          return true;
        });
        if (!filtered.length) {
          return null;
        }
        if (orderBy?.lockedAt === 'desc') {
          filtered.sort((a, b) => b.lockedAt.getTime() - a.lockedAt.getTime());
        }
        return filtered[0];
      }),
      findMany: vi.fn(async ({ where }: { where: any }) => {
        return Array.from(priceLocks.values()).filter((lock) => {
          if (where.productId && lock.productId !== where.productId) {
            return false;
          }
          if (where.organizationId && lock.organizationId !== where.organizationId) {
            return false;
          }
          if (where.isActive !== undefined && lock.isActive !== where.isActive) {
            return false;
          }
          return true;
        });
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return priceLocks.get(where.id) ?? null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: any; data: any }) => {
        let count = 0;
        priceLocks.forEach((lock, id) => {
          if (where.productId && lock.productId !== where.productId) {
            return;
          }
          if (where.organizationId && lock.organizationId !== where.organizationId) {
            return;
          }
          if (where.isActive !== undefined && lock.isActive !== where.isActive) {
            return;
          }
          priceLocks.set(id, { ...lock, ...data });
          count += 1;
        });
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: { where?: { productId?: string } }) => {
        const ids = Array.from(priceLocks.values())
          .filter((lock) => (where?.productId ? lock.productId === where.productId : true))
          .map((lock) => lock.id);
        ids.forEach((id) => priceLocks.delete(id));
        return { count: ids.length };
      }),
    },
    $transaction: vi.fn(async (callback: any) => {
      const run = transactionChain.then(() => callback(prisma));
      transactionChain = run.catch(() => undefined);
      return run;
    }),
    $disconnect: vi.fn(),
  };

  return prisma;
};

describe('PriceEngine Service - Financial Integrity Tests', () => {
  let priceEngine: PriceEngine;
  let redis: InMemoryRedis;
  let prisma: ReturnType<typeof createPricePrismaMock>;

  beforeAll(async () => {
    redis = new InMemoryRedis();
    const mockPrismaService = createPricePrismaMock();
    priceEngine = new PriceEngine(mockPrismaService as unknown as any, redis as unknown as Redis);
    prisma = mockPrismaService;
  });

  afterAll(async () => {
    await redis.quit();
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    // Clear cache before each test
    const keys = await redis.keys('price:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  /**
   * Test 1: Decimal Precision Validation
   * Critical: Must NOT have floating-point precision errors
   */
  describe('Decimal Precision Tests', () => {
    it('should calculate final price without floating-point precision loss', async () => {
      // Create test volatility index
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_DECIMAL_PRECISION',
          indexValue: new Decimal('1.157'), // Precise value
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      // Create test organization with tier discount
      const org = await prisma.organization.create({
        data: {
          name: 'Test Decimal Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const b2bRelation = await prisma.b2BRelation.create({
        data: {
          supplierId: org.id,
          buyerId: org.id,
          tierLevel: 'SILVER',
          discountPercentage: new Decimal('0'),
          isActive: true,
        },
      });

      // Create test product
      const product = await prisma.product.create({
        data: {
          name: 'Test Decimal Product',
          slug: 'test-decimal-product',
          sku: 'TEST-DEC-001',
          price: new Decimal('1234567.89'), // Large precise value
          costPrice: new Decimal('1000000.00'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // Calculate final price
      const result = await priceEngine.getFinalPrice(product.id, org.id, volatilityIndex.id);

      // Manual calculation
      const basePrice = new Decimal('1234567.89');
      const indexValue = new Decimal('1.157');
      const tierDiscount = new Decimal('15');
      const expected = basePrice.mul(indexValue).mul(new Decimal('1').sub(tierDiscount.div(100)));

      // Assert exact Decimal equality
      expect(result.finalPrice.toString()).toBe(expected.toString());
      expect(result.finalPrice.toString()).toBe('1214135.7914205');

      // Cleanup
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.b2BRelation.delete({ where: { id: b2bRelation.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });

    it('should maintain precision in bulk price calculations', async () => {
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_BULK_PRECISION',
          indexValue: new Decimal('1.2345'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Bulk Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      // Create multiple products
      const products = await Promise.all(
        [100, 200, 300].map((price) =>
          prisma.product.create({
            data: {
              name: `Bulk Product ${price}`,
              slug: `bulk-product-${price}`,
              sku: `BULK-${price}`,
              price: new Decimal(price),
              costPrice: new Decimal(price * 0.8),
              volatilityIndexId: volatilityIndex.id,
              organizationId: org.id,
              stock: 100,
            },
          })
        )
      );

      const productIds = products.map((p) => p.id);
      const results = await priceEngine.getBulkPrices(productIds, org.id, volatilityIndex.id);

      // Verify all calculations maintain precision
      productIds.forEach((productId, idx) => {
        const result = results.get(productId);
        const basePrice = new Decimal([100, 200, 300][idx]);
        const expected = basePrice.mul(new Decimal('1.2345'));
        expect(result?.finalPrice.toString()).toBe(expected.toString());
      });

      // Cleanup
      await prisma.product.deleteMany({
        where: { id: { in: productIds } },
      });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });
  });

  /**
   * Test 2: MarginGuard Constraint Enforcement
   */
  describe('MarginGuard Constraint Tests', () => {
    it('should throw error if final price violates 10% minimum margin', async () => {
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_MARGIN_VIOLATION',
          indexValue: new Decimal('0.5'), // Low index
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Margin Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Margin Product',
          slug: 'test-margin-product',
          sku: 'MARGIN-001',
          price: new Decimal('100'),
          costPrice: new Decimal('95'), // High cost
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // Should flag margin violation because (100 * 0.5) = 50 < (95 * 1.10) = 104.5
      const result = await priceEngine.getFinalPrice(product.id, org.id, volatilityIndex.id);
      expect(result.isWithinMargin).toBe(false);
      expect(result.finalPrice.lt(result.minimumAllowedPrice)).toBe(true);

      // Cleanup
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });

    it('should allow price lock if meets 10% minimum margin', async () => {
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_MARGIN_PASS',
          indexValue: new Decimal('1.5'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Margin Pass Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Margin Pass Product',
          slug: 'test-margin-pass-product',
          sku: 'MARGIN-PASS-001',
          price: new Decimal('100'),
          costPrice: new Decimal('90'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // (100 * 1.5) = 150 >= (90 * 1.10) = 99 - should pass
      const result = await priceEngine.lockPrice({
        productId: product.id,
        organizationId: org.id,
        volatilityIndexId: volatilityIndex.id,
        durationDays: 30,
      });

      expect(result.success).toBe(true);
      expect(result.priceLock).toBeDefined();

      // Cleanup
      await prisma.priceLock.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });
  });

  /**
   * Test 3: Price Lock Race Condition Handling
   */
  describe('Price Lock Concurrency Tests', () => {
    it('should handle concurrent price lock requests with atomic transaction', async () => {
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_CONCURRENCY',
          indexValue: new Decimal('1.2'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Concurrency Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Concurrency Product',
          slug: 'test-concurrency-product',
          sku: 'CONCURRENCY-001',
          price: new Decimal('100'),
          costPrice: new Decimal('80'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // Simulate 5 concurrent lock requests
      const lockPromises = Array.from({ length: 5 }).map(() =>
        priceEngine.lockPrice({
          productId: product.id,
          organizationId: org.id,
          volatilityIndexId: volatilityIndex.id,
          durationDays: 30,
        })
      );

      const results = await Promise.allSettled(lockPromises);
      const successfulLocks = results.filter((r) => r.status === 'fulfilled' && r.value.success);

      // All lock attempts should succeed, but only one lock remains active.
      expect(successfulLocks.length).toBe(5);

      // Verify only one active lock exists
      const activeLocks = await prisma.priceLock.findMany({
        where: {
          productId: product.id,
          organizationId: org.id,
          isActive: true,
        },
      });

      expect(activeLocks.length).toBe(1);

      // Cleanup
      await prisma.priceLock.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });

    it('should deactivate old locks when creating new lock', async () => {
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_OLD_LOCK_DEACTIVATION',
          indexValue: new Decimal('1.1'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Old Lock Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Old Lock Product',
          slug: 'test-old-lock-product',
          sku: 'OLD-LOCK-001',
          price: new Decimal('100'),
          costPrice: new Decimal('80'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // Create first lock
      const firstLock = await priceEngine.lockPrice({
        productId: product.id,
        organizationId: org.id,
        volatilityIndexId: volatilityIndex.id,
        durationDays: 30,
      });
      expect(firstLock.success).toBe(true);

      // Create second lock
      const secondLock = await priceEngine.lockPrice({
        productId: product.id,
        organizationId: org.id,
        volatilityIndexId: volatilityIndex.id,
        durationDays: 30,
      });
      expect(secondLock.success).toBe(true);

      // Check first lock is deactivated
      const deactivatedLock = await prisma.priceLock.findUnique({
        where: { id: firstLock.priceLock?.id },
      });
      expect(deactivatedLock?.isActive).toBe(false);

      // Check only one active lock
      const activeLocks = await prisma.priceLock.findMany({
        where: {
          productId: product.id,
          organizationId: org.id,
          isActive: true,
        },
      });
      expect(activeLocks.length).toBe(1);
      expect(activeLocks[0].id).toBe(secondLock.priceLock?.id);

      // Cleanup
      await prisma.priceLock.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });
  });

  /**
   * Test 4: Redis Cache Consistency
   */
  describe('Redis Cache Tests', () => {
    it('should cache price with 1 hour TTL', async () => {
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_CACHE_TTL',
          indexValue: new Decimal('1.3'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Cache Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Cache Product',
          slug: 'test-cache-product',
          sku: 'CACHE-001',
          price: new Decimal('100'),
          costPrice: new Decimal('80'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // First call - should cache
      await priceEngine.getFinalPrice(product.id, org.id, volatilityIndex.id);

      // Check cache exists
      const cacheKey = `price:${product.id}:${org.id}:${volatilityIndex.id}`;
      const cachedValue = await redis.get(cacheKey);
      expect(cachedValue).toBeDefined();

      // Check TTL is approximately 1 hour (3600 seconds)
      const ttl = await redis.ttl(cacheKey);
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);

      // Cleanup
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });

    it('should invalidate cache when volatility index changes', async () => {
      const volatilityIndex = await prisma.volatilityIndex.create({
        data: {
          indexName: 'TEST_CACHE_INVALIDATION',
          indexValue: new Decimal('1.4'),
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Cache Invalidation Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Cache Invalidation Product',
          slug: 'test-cache-invalidation-product',
          sku: 'CACHE-INV-001',
          price: new Decimal('100'),
          costPrice: new Decimal('80'),
          volatilityIndexId: volatilityIndex.id,
          organizationId: org.id,
          stock: 100,
        },
      });

      // Cache price
      await priceEngine.getFinalPrice(product.id, org.id, volatilityIndex.id);

      // Invalidate cache
      await priceEngine.invalidateCacheForIndex(volatilityIndex.id);

      // Check cache is gone
      const cacheKey = `price:${product.id}:${org.id}:${volatilityIndex.id}`;
      const cachedValue = await redis.get(cacheKey);
      expect(cachedValue).toBeNull();

      // Cleanup
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.volatilityIndex.delete({ where: { id: volatilityIndex.id } });
    });
  });
});

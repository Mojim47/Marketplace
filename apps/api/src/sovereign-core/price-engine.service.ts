/**
 * ???????????????????????????????????????????????????????????????????????????
 * PRICE SOVEREIGNTY ENGINE - PRODUCTION-GRADE FINANCIAL INTEGRITY
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: Manage dynamic pricing with volatility indexes and price locks
 * Critical: ALL financial fields use Decimal (not Float) to prevent floating-point errors
 *
 * Formula: Price_Final = (Price_Base � Index_Volatility) � (1 - Discount_Tier)
 * Constraint: Price_Final >= Price_MinimumAllowed (MarginGuard)
 * ???????????????????????????????????????????????????????????????????????????
 */

import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Redis } from 'ioredis';
import { PrismaService } from '../database/prisma.service';

interface PriceCalculation {
  productId: string;
  organizationId: string;
  basePrice: Decimal;
  indexMultiplier: Decimal;
  tierDiscount: Decimal;
  finalPrice: Decimal;
  minimumAllowedPrice: Decimal;
  isWithinMargin: boolean;
}

interface PriceLockRequest {
  productId: string;
  organizationId: string;
  volatilityIndexId?: string;
  durationDays: number; // Lock duration in days
}

@Injectable()
export class PriceEngine {
  private readonly logger = new Logger('PriceEngine');
  private readonly CACHE_PREFIX = 'price:';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  /**
   * Calculate final price with volatility and tier discount
   * Formula: Price_Final = (Price_Base � Index_Volatility) � (1 - Discount_Tier)
   */
  async getFinalPrice(
    productId: string,
    organizationId: string,
    volatilityIndexId?: string
  ): Promise<PriceCalculation> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${productId}:${organizationId}:${volatilityIndexId || 'none'}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return JSON.parse(cached, (key, value) => {
          // Revive Decimal objects from JSON
          if (key.includes('Price') || key === 'indexMultiplier' || key === 'tierDiscount') {
            return new Decimal(value);
          }
          return value;
        });
      }

      // 1. Get product base price
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          price: true,
          costPrice: true, // For margin calculation
        },
      });

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      const basePrice = new Decimal(product.price.toString());
      const costPrice = new Decimal(product.costPrice.toString());

      // 2. Get volatility index multiplier
      let indexMultiplier = new Decimal(1.0); // Default: no adjustment

      if (volatilityIndexId) {
        const volatilityIndex = await this.prisma.volatilityIndex.findUnique({
          where: { id: volatilityIndexId, isActive: true },
          select: { indexValue: true },
        });

        if (volatilityIndex) {
          indexMultiplier = new Decimal(volatilityIndex.indexValue.toString());
        } else {
          this.logger.warn(`Volatility index ${volatilityIndexId} not found or inactive`);
        }
      }

      // 3. Get tier discount from B2B relation
      let tierDiscount = new Decimal(0); // Default: no discount

      const b2bRelation = await this.prisma.b2BRelation.findFirst({
        where: {
          buyerId: organizationId,
          isActive: true,
        },
        select: {
          tierLevel: true,
          discountPercentage: true,
        },
      });

      if (b2bRelation) {
        // Tier-based discount mapping
        const tierDiscountMap: Record<string, number> = {
          GOLD: 25.0, // 25% discount
          SILVER: 15.0, // 15% discount
          BRONZE: 5.0, // 5% discount
        };

        const baseTierDiscount = tierDiscountMap[b2bRelation.tierLevel] || 0;
        const additionalDiscount = parseFloat(b2bRelation.discountPercentage.toString());

        tierDiscount = new Decimal(baseTierDiscount + additionalDiscount);
      }

      // 4. Calculate final price
      // Formula: Price_Final = (Price_Base � Index_Volatility) � (1 - Discount_Tier / 100)
      const priceWithIndex = basePrice.mul(indexMultiplier);
      const discountMultiplier = new Decimal(1).minus(tierDiscount.div(100));
      const finalPrice = priceWithIndex.mul(discountMultiplier);

      // 5. MarginGuard: Calculate minimum allowed price
      // MAP = costPrice * 1.10 (10% minimum margin)
      const minimumAllowedPrice = costPrice.mul(new Decimal(1.1));

      const isWithinMargin = finalPrice.gte(minimumAllowedPrice);

      if (!isWithinMargin) {
        this.logger.warn(
          `Price below margin for product ${productId}: ${finalPrice} < ${minimumAllowedPrice}`
        );
      }

      const result: PriceCalculation = {
        productId,
        organizationId,
        basePrice,
        indexMultiplier,
        tierDiscount,
        finalPrice,
        minimumAllowedPrice,
        isWithinMargin,
      };

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(result, (_key, value) => {
          // Serialize Decimal objects
          return value instanceof Decimal ? value.toString() : value;
        })
      );

      return result;
    } catch (error) {
      this.logger.error(`Error calculating price: ${error}`);
      throw error;
    }
  }

  /**
   * Lock price for organization (freeze current price)
   * Uses Atomic Transaction to ensure consistency
   */
  async lockPrice(request: PriceLockRequest): Promise<any> {
    try {
      // Calculate current price
      const priceCalc = await this.getFinalPrice(
        request.productId,
        request.organizationId,
        request.volatilityIndexId
      );

      // MarginGuard check
      if (!priceCalc.isWithinMargin) {
        throw new BadRequestException(
          `Cannot lock price below minimum margin. Final: ${priceCalc.finalPrice}, Minimum: ${priceCalc.minimumAllowedPrice}`
        );
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + request.durationDays);

      // Atomic Transaction: Create price lock
      const priceLock = await this.prisma.$transaction(async (tx) => {
        // Deactivate any existing active locks for this org-product combo
        await tx.priceLock.updateMany({
          where: {
            productId: request.productId,
            organizationId: request.organizationId,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        // Create new price lock
        return tx.priceLock.create({
          data: {
            productId: request.productId,
            organizationId: request.organizationId,
            volatilityIndexId: request.volatilityIndexId,
            basePrice: priceCalc.basePrice,
            indexMultiplier: priceCalc.indexMultiplier,
            tierDiscount: priceCalc.tierDiscount,
            lockedPrice: priceCalc.finalPrice,
            minimumAllowedPrice: priceCalc.minimumAllowedPrice,
            expiresAt,
            isActive: true,
          },
        });
      });

      // Invalidate cache after locking
      const cacheKey = `${this.CACHE_PREFIX}${request.productId}:${request.organizationId}:${request.volatilityIndexId || 'none'}`;
      await this.redis.del(cacheKey);

      this.logger.log(
        `Price locked for product ${request.productId}, org ${request.organizationId} until ${expiresAt}`
      );

      return {
        success: true,
        priceLock,
        message: 'Price successfully locked',
      };
    } catch (error) {
      this.logger.error(`Error locking price: ${error}`);
      throw error;
    }
  }

  /**
   * Get active price lock for organization
   */
  async getActivePriceLock(productId: string, organizationId: string): Promise<any | null> {
    try {
      const priceLock = await this.prisma.priceLock.findFirst({
        where: {
          productId,
          organizationId,
          isActive: true,
          expiresAt: {
            gt: new Date(), // Not expired
          },
        },
        orderBy: {
          lockedAt: 'desc',
        },
      });

      return priceLock;
    } catch (error) {
      this.logger.error(`Error getting price lock: ${error}`);
      throw error;
    }
  }

  /**
   * Invalidate cache when volatility index changes
   * CRITICAL: Must be called after any VolatilityIndex update
   */
  async invalidateCacheForIndex(volatilityIndexId: string): Promise<void> {
    try {
      // Pattern: price:*:*:volatilityIndexId
      const pattern = `${this.CACHE_PREFIX}*:*:${volatilityIndexId}`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Invalidated ${keys.length} cached prices for index ${volatilityIndexId}`);
      }
    } catch (error) {
      this.logger.error(`Error invalidating cache: ${error}`);
    }
  }

  /**
   * Bulk price calculation for catalog (optimized)
   */
  async getBulkPrices(
    productIds: string[],
    organizationId: string,
    volatilityIndexId?: string
  ): Promise<Map<string, PriceCalculation>> {
    const results = new Map<string, PriceCalculation>();

    // Use Promise.all for parallel processing
    const calculations = await Promise.all(
      productIds.map((productId) =>
        this.getFinalPrice(productId, organizationId, volatilityIndexId).catch(
          (error: any): null => {
            this.logger.error(`Error calculating price for ${productId}: ${error}`);
            return null;
          }
        )
      )
    );

    calculations.forEach((calc, index) => {
      if (calc) {
        results.set(productIds[index], calc);
      }
    });

    return results;
  }
}

export default PriceEngine;

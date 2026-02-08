/**
 * ???????????????????????????????????????????????????????????????????????????
 * FACTORY PRICING TYPES - DTOs and Interfaces
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: Type definitions for Factory Price Control Panel
 * Critical: Enforce Decimal precision for all financial inputs
 * ???????????????????????????????????????????????????????????????????????????
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * DTO: Update Volatility Index
 */
export interface UpdateVolatilityIndexDTO {
  factoryId: string;
  indexName: string;
  newValue: number; // Multiplier (e.g., 1.15 = 15% increase)
  reason: string; // Audit trail reason
}

/**
 * DTO: Set Product Base Price and Minimum Allowed Price
 */
export interface SetProductPricingDTO {
  factoryId: string;
  productId: string;
  basePrice: Decimal; // Use Decimal for precision
  minimumAllowedPrice: Decimal; // MarginGuard enforcement
}

/**
 * DTO: Set Tier Discount Rate
 */
export interface SetTierDiscountRateDTO {
  factoryId: string;
  tierId: string;
  discountRate: number; // Percentage (e.g., 0.10 = 10% discount)
}

/**
 * Response: Volatility Index Update Result
 */
export interface VolatilityIndexUpdateResult {
  success: boolean;
  index: {
    id: string;
    indexName: string;
    indexValue: number;
    updatedAt: Date;
  };
  cacheInvalidated: boolean;
  auditLogId: string;
}

/**
 * Response: Product Pricing Update Result
 */
export interface ProductPricingUpdateResult {
  success: boolean;
  product: {
    id: string;
    name: string;
    basePrice: Decimal;
    minimumAllowedPrice: Decimal;
    updatedAt: Date;
  };
  auditLogId: string;
}

/**
 * Response: Tier Discount Update Result
 */
export interface TierDiscountUpdateResult {
  success: boolean;
  tier: {
    id: string;
    tierName: string;
    tierDiscountRate: number;
    updatedAt: Date;
  };
  auditLogId: string;
}

/**
 * RBAC: Allowed roles for Factory Pricing operations
 */
export const FACTORY_PRICING_ROLES = ['FACTORY_ADMIN', 'SYSTEM_ADMIN'] as const;

/**
 * Validation: Minimum margin percentage for MarginGuard
 */
export const MINIMUM_MARGIN_PERCENTAGE = 0.10; // 10% minimum profit

/**
 * Validation: Volatility Index bounds
 */
export const VOLATILITY_INDEX_MIN = 0.5; // 50% of base (deep discount scenario)
export const VOLATILITY_INDEX_MAX = 3.0; // 300% of base (extreme inflation scenario)

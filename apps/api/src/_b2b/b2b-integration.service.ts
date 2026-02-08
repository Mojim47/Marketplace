/**
 * ???????????????????????????????????????????????????????????????????????????
 * B2B Integration Service - Unified B2B Operations
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Integrates all B2B calculator functions into a cohesive NestJS service
 * ???????????????????????????????????????????????????????????????????????????
 */

import { Injectable, Logger } from '@nestjs/common';

// Import calculator functions from libs
import {
  calculatePriceWithAudit,
  type PriceCalculationInput,
  type PriceCalculationContext,
  type PriceCalculationWithAuditResult,
  DealerTier,
} from '@libs/pricing';

import {
  freezePrices,
  lockStock,
  checkCreditForConversion,
  canConvertToOrder,
  type PriceFreezeResult,
  type StockLockResult,
  type CreditCheckForConversion,
  ProformaStatus,
} from '@libs/proforma';

import {
  validateSayadiNumber,
  isValidTransition,
  calculateBounceImpact,
  applyBouncePenalty,
  calculateNewDebt,
  shouldBlockCredit,
  ChequeStatus,
} from '@libs/cheque';

import {
  calculateRiskScoreFromEvents,
  calculateAvailableCredit,
  isCreditSufficient,
  calculateVouchPenalty,
  adjustRiskScore,
  type RiskScoreCalculation,
  FinancialEventType,
} from '@libs/credit';

import {
  determineApprovalRequirement,
  isWorkflowComplete,
  getRequiredSteps,
  type ApprovalRequirement,
  WorkflowStatus,
  ApprovalAction,
} from '@libs/workflow';

import {
  trackPriceChange,
  type PriceChangeTracking,
} from '@libs/audit';

import {
  createOrderLedgerEntries,
  createPaymentLedgerEntries,
  validateDoubleEntry,
  type CreateLedgerEntryDto,
  type GeneralLedgerEntry,
  ACCOUNT_NAMES,
} from '@libs/ledger';

// ???????????????????????????????????????????????????????????????????????????
// Interfaces
// ???????????????????????????????????????????????????????????????????????????

export interface B2BPriceRequest {
  productId: string;
  basePrice: number;
  tierLevel: DealerTier;
  quantity: number;
  organizationId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface B2BProformaRequest {
  organizationId: string;
  buyerName: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
  currentPrices: Map<string, { basePrice: number; tierDiscount: number; volumeDiscount: number; finalPrice: number }>;
  availableStock: Map<string, number>;
  validityHours?: number;
}

export interface B2BChequeRequest {
  sayadiNumber: string;
  amount: number;
  organizationId: string;
  dueDate: Date;
  existingSayadiNumbers?: Set<string>;
}

export interface B2BOrderRequest {
  proformaId: string;
  organizationId: string;
  totalAmount: number;
  availableCredit: number;
  proformaStatus: ProformaStatus;
  validUntil: Date;
}

// ???????????????????????????????????????????????????????????????????????????
// Service
// ???????????????????????????????????????????????????????????????????????????

@Injectable()
export class B2BIntegrationService {
  private readonly logger = new Logger(B2BIntegrationService.name);

  /**
   * Calculate B2B price with automatic audit logging
   */
  calculatePriceWithAudit(request: B2BPriceRequest): PriceCalculationWithAuditResult {
    this.logger.log(`Calculating price for product ${request.productId}`);

    const input: PriceCalculationInput = {
      productId: request.productId,
      basePrice: request.basePrice,
      tierLevel: request.tierLevel,
      quantity: request.quantity,
    };

    const context: PriceCalculationContext = {
      userId: request.userId,
      organizationId: request.organizationId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    };

    const result = calculatePriceWithAudit(input, context);
    
    this.logger.log(`Price calculated: ${result.priceResult.finalPrice} for tier ${request.tierLevel}`);
    return result;
  }

  /**
   * Create proforma with price freeze and stock lock
   */
  createProforma(request: B2BProformaRequest): {
    priceFreezeResult: PriceFreezeResult;
    stockLockResult: StockLockResult;
    proformaId: string;
  } {
    const proformaId = `PF-${Date.now()}`;
    this.logger.log(`Creating proforma ${proformaId} for ${request.buyerName}`);

    // Freeze prices
    const priceFreezeResult = freezePrices(
      request.items,
      request.currentPrices,
      request.validityHours,
    );

    // Lock stock
    const stockLockResult = lockStock(
      proformaId,
      request.items,
      request.availableStock,
      request.validityHours,
    );

    this.logger.log(`Proforma ${proformaId}: prices frozen=${priceFreezeResult.frozen}, stock locked=${stockLockResult.locked}`);

    return {
      priceFreezeResult,
      stockLockResult,
      proformaId,
    };
  }

  /**
   * Validate cheque with Sayadi number
   */
  validateCheque(request: B2BChequeRequest): { valid: boolean; error?: string } {
    this.logger.log(`Validating cheque ${request.sayadiNumber}`);
    
    const existingNumbers = request.existingSayadiNumbers ?? new Set<string>();
    const result = validateSayadiNumber(
      request.sayadiNumber, 
      request.organizationId, 
      existingNumbers
    );
    
    this.logger.log(`Cheque validation: valid=${result.valid}`);
    return result;
  }

  /**
   * Check if cheque state transition is valid
   */
  canTransitionCheque(currentStatus: ChequeStatus, newStatus: ChequeStatus): boolean {
    return isValidTransition(currentStatus, newStatus);
  }

  /**
   * Calculate impact of bounced cheque
   */
  handleBouncedCheque(
    organizationId: string,
    currentRiskScore: number,
    bouncedCount: number = 1,
  ): {
    bounceImpact: { riskScorePenalty: number; creditBlocked: boolean; organizationId: string };
    newRiskScore: number;
    creditBlocked: boolean;
  } {
    this.logger.log(`Processing bounced cheque for organization ${organizationId}`);
    
    const bounceImpact = calculateBounceImpact(organizationId);
    const newRiskScore = applyBouncePenalty(currentRiskScore);
    const creditBlocked = shouldBlockCredit(bouncedCount);
    
    return {
      bounceImpact,
      newRiskScore,
      creditBlocked,
    };
  }

  /**
   * Process cheque cash and reduce debt
   */
  processChequePayment(currentDebt: number, chequeAmount: number): {
    newDebt: number;
    debtReduction: number;
  } {
    this.logger.log(`Processing cheque payment: ${chequeAmount}`);
    
    const newDebt = calculateNewDebt(currentDebt, chequeAmount);
    const debtReduction = currentDebt - newDebt;
    
    return {
      newDebt,
      debtReduction,
    };
  }

  /**
   * Check credit availability for organization
   */
  checkCredit(
    creditLimit: number,
    currentDebt: number,
    requestedAmount: number,
  ): { available: number; sufficient: boolean } {
    this.logger.log(`Checking credit: limit=${creditLimit}, debt=${currentDebt}, requested=${requestedAmount}`);
    
    const available = calculateAvailableCredit(creditLimit, currentDebt);
    const sufficient = isCreditSufficient(available, requestedAmount);
    
    return { available, sufficient };
  }

  /**
   * Calculate risk score for organization from events
   */
  calculateRisk(
    baseScore: number,
    events: Array<{ id: string; eventType: FinancialEventType; impactValue: number; occurredAt: Date }>,
  ): RiskScoreCalculation {
    return calculateRiskScoreFromEvents(baseScore, events);
  }

  /**
   * Adjust risk score by a specific amount
   */
  adjustRiskScore(currentScore: number, adjustment: number): number {
    return adjustRiskScore(currentScore, adjustment);
  }

  /**
   * Route proforma for approval based on amount
   */
  routeForApproval(amount: number): ApprovalRequirement {
    this.logger.log(`Routing for approval: amount=${amount}`);
    return determineApprovalRequirement(amount);
  }

  /**
   * Get required approval steps for an amount
   */
  getRequiredApprovalSteps(amount: number): number {
    return getRequiredSteps(amount);
  }

  /**
   * Check if workflow is complete
   */
  checkWorkflowComplete(
    instance: { status: WorkflowStatus; approvals: Array<{ stepOrder: number; action: ApprovalAction; userId: string; timestamp: Date }> },
    requiredSteps: number,
  ): boolean {
    return isWorkflowComplete(instance, requiredSteps);
  }

  /**
   * Convert proforma to order with credit check
   */
  convertProformaToOrder(request: B2BOrderRequest): {
    canConvert: boolean;
    reason?: string;
    creditCheck: CreditCheckForConversion;
  } {
    this.logger.log(`Converting proforma ${request.proformaId} to order`);

    const creditCheck = checkCreditForConversion(
      request.availableCredit,
      request.totalAmount,
    );

    const conversionCheck = canConvertToOrder(
      request.proformaStatus,
      request.validUntil,
      request.availableCredit,
      request.totalAmount,
    );

    return {
      canConvert: conversionCheck.canConvert,
      reason: conversionCheck.reason,
      creditCheck,
    };
  }

  /**
   * Create ledger entries for order
   */
  createOrderLedgerEntries(
    orderId: string,
    organizationId: string,
    orderTotal: number,
    vatAmount: number,
  ): { entries: CreateLedgerEntryDto[]; balanced: boolean } {
    this.logger.log(`Creating ledger entries for order ${orderId}`);

    const entries = createOrderLedgerEntries(orderId, orderTotal, vatAmount, organizationId);
    
    // Convert to GeneralLedgerEntry for validation
    const now = new Date();
    const ledgerEntries: GeneralLedgerEntry[] = entries.map((entry, i) => ({
      id: `entry-${i}`,
      accountCode: entry.accountCode,
      accountName: ACCOUNT_NAMES[entry.accountCode] || entry.accountCode,
      debit: entry.debit,
      credit: entry.credit,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description || '',
      organizationId: entry.organizationId,
      fiscalYear: now.getFullYear(),
      fiscalMonth: now.getMonth() + 1,
      createdAt: now,
    }));

    const validation = validateDoubleEntry(ledgerEntries);

    return { entries, balanced: validation.isBalanced };
  }

  /**
   * Create ledger entries for payment
   */
  createPaymentLedgerEntries(
    paymentId: string,
    organizationId: string,
    amount: number,
    paymentMethod: 'CASH' | 'BANK' = 'BANK',
  ): { entries: CreateLedgerEntryDto[]; balanced: boolean } {
    this.logger.log(`Creating ledger entries for payment ${paymentId}`);

    const entries = createPaymentLedgerEntries(paymentId, amount, paymentMethod, organizationId);
    
    // Convert to GeneralLedgerEntry for validation
    const now = new Date();
    const ledgerEntries: GeneralLedgerEntry[] = entries.map((entry, i) => ({
      id: `entry-${i}`,
      accountCode: entry.accountCode,
      accountName: ACCOUNT_NAMES[entry.accountCode] || entry.accountCode,
      debit: entry.debit,
      credit: entry.credit,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description || '',
      organizationId: entry.organizationId,
      fiscalYear: now.getFullYear(),
      fiscalMonth: now.getMonth() + 1,
      createdAt: now,
    }));

    const validation = validateDoubleEntry(ledgerEntries);

    return { entries, balanced: validation.isBalanced };
  }

  /**
   * Track price change for audit
   */
  trackPriceChange(beforePrice: number, afterPrice: number): PriceChangeTracking {
    return trackPriceChange(beforePrice, afterPrice);
  }

  /**
   * Calculate vouch penalty when vouched organization defaults
   */
  calculateVouchPenalty(defaultPenalty: number): number {
    return calculateVouchPenalty(defaultPenalty);
  }
}

/**
 * ???????????????????????????????????????????????????????????????????????????
 * RISK & CREDIT SCORING ENGINE - TIME-WEIGHTED REPUTATION SYSTEM
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: Dynamic credit scoring with exponential decay and risk-sharing vouching
 *
 * Formula: Score_New = Score_Old + (Impact_Event � e^(-? � t))
 * - ? (Lambda): Decay factor (e.g., 0.1 = 10% monthly decay)
 * - t: Time elapsed since event (in months)
 *
 * Credit Limit: currentCreditLimit = baseCreditLimit � creditMultiplier
 * ???????????????????????????????????????????????????????????????????????????
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';

// Use Prisma's FinancialEventType enum directly
import { FinancialEventType } from '@prisma/client';

interface FinancialEventInput {
  organizationId: string;
  eventType: FinancialEventType;
  impactValue: number; // Positive or negative
  description: string;
  relatedOrderId?: string;
  relatedProformaId?: string;
  relatedChequeId?: string;
}

interface VouchInput {
  voucherOrganizationId: string; // Who is vouching
  voucheeOrganizationId: string; // Who is being vouched for
  vouchAmount: number; // Maximum guarantee amount
  riskSharePercentage: number; // % of loss voucher absorbs
  expirationDays?: number; // Optional expiration
}

@Injectable()
export class RiskEngine {
  private readonly logger = new Logger('RiskEngine');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process financial event and update risk score with time-weighted decay
   * Formula: Score_New = Score_Old + (Impact_Event � e^(-? � t))
   */
  async processFinancialEvent(input: FinancialEventInput): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Get or create risk profile
        let riskProfile = await tx.riskProfile.findUnique({
          where: { organizationId: input.organizationId },
          include: {
            financialEvents: {
              where: { processed: false },
              orderBy: { occurredAt: 'desc' },
            },
          },
        });

        if (!riskProfile) {
          // Create new profile with default values
          riskProfile = await tx.riskProfile.create({
            data: {
              organizationId: input.organizationId,
              score: new Decimal(100.0), // Start at 100
              baseCreditLimit: new Decimal(0),
              creditMultiplier: new Decimal(1.0),
              currentCreditLimit: new Decimal(0),
              creditUsed: new Decimal(0),
              decayLambda: new Decimal(0.1), // 10% monthly decay
            },
            include: {
              financialEvents: true,
            },
          });
        }

        // 2. Create new financial event
        const newEvent = await tx.financialEvent.create({
          data: {
            riskProfileId: riskProfile.id,
            eventType: input.eventType,
            impactValue: new Decimal(input.impactValue),
            description: input.description,
            relatedOrderId: input.relatedOrderId,
            relatedProformaId: input.relatedProformaId,
            relatedChequeId: input.relatedChequeId,
            processed: false,
          },
        });

        // 3. Recalculate score with Lambda decay
        const now = new Date();
        const lambda = parseFloat(riskProfile.decayLambda.toString());
        let newScore = parseFloat(riskProfile.score.toString());

        // Process all unprocessed events (including the new one)
        const eventsToProcess = [...riskProfile.financialEvents, newEvent];

        for (const event of eventsToProcess) {
          const impact = parseFloat(event.impactValue.toString());
          const eventDate = new Date(event.occurredAt);

          // Calculate time difference in months
          const monthsElapsed = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

          // Apply exponential decay: Impact � e^(-? � t)
          const decayedImpact = impact * Math.exp(-lambda * monthsElapsed);

          newScore += decayedImpact;

          // Mark as processed
          await tx.financialEvent.update({
            where: { id: event.id },
            data: {
              processed: true,
              processedAt: now,
            },
          });

          this.logger.debug(
            `Event ${event.id}: Impact=${impact}, Elapsed=${monthsElapsed.toFixed(2)}mo, Decayed=${decayedImpact.toFixed(4)}`
          );
        }

        // Clamp score between 0 and 200
        newScore = Math.max(0, Math.min(200, newScore));

        // 4. Calculate new credit multiplier based on score
        // Score 100 = 1.0x, Score 150 = 1.5x, Score 50 = 0.5x
        const creditMultiplier = newScore / 100;

        // 5. Update risk profile with new score and credit limit
        const updatedProfile = await tx.riskProfile.update({
          where: { id: riskProfile.id },
          data: {
            score: new Decimal(newScore.toFixed(4)),
            creditMultiplier: new Decimal(creditMultiplier.toFixed(2)),
            currentCreditLimit: new Decimal(
              parseFloat(riskProfile.baseCreditLimit.toString()) * creditMultiplier
            ),
            lastCalculatedAt: now,
          },
        });

        this.logger.log(
          `Risk score updated for org ${input.organizationId}: ${riskProfile.score} ? ${newScore.toFixed(2)}`
        );

        return {
          success: true,
          riskProfile: updatedProfile,
          newEvent,
          scoreChange: newScore - parseFloat(riskProfile.score.toString()),
        };
      });
    } catch (error) {
      this.logger.error(`Error processing financial event: ${error}`);
      throw error;
    }
  }

  /**
   * Create reputation vouch (risk-sharing guarantee)
   * If vouchee defaults, voucher loses credit proportionally
   */
  async vouchForOrganization(input: VouchInput): Promise<any> {
    try {
      // Validate voucher exists and has sufficient credit
      const voucherProfile = await this.prisma.riskProfile.findUnique({
        where: { organizationId: input.voucherOrganizationId },
      });

      if (!voucherProfile) {
        throw new BadRequestException('Voucher organization has no risk profile');
      }

      const availableCredit = parseFloat(
        voucherProfile.currentCreditLimit.sub(voucherProfile.creditUsed).toString()
      );

      if (availableCredit < input.vouchAmount) {
        throw new BadRequestException(
          `Insufficient credit to vouch. Available: ${availableCredit}, Requested: ${input.vouchAmount}`
        );
      }

      // Check if vouchee exists, create if not
      let voucheeProfile = await this.prisma.riskProfile.findUnique({
        where: { organizationId: input.voucheeOrganizationId },
      });

      if (!voucheeProfile) {
        voucheeProfile = await this.prisma.riskProfile.create({
          data: {
            organizationId: input.voucheeOrganizationId,
            score: new Decimal(100.0),
            baseCreditLimit: new Decimal(0),
            creditMultiplier: new Decimal(1.0),
            currentCreditLimit: new Decimal(0),
            creditUsed: new Decimal(0),
            decayLambda: new Decimal(0.1),
          },
        });
      }

      // Calculate expiration date
      const expiresAt = input.expirationDays
        ? new Date(Date.now() + input.expirationDays * 24 * 60 * 60 * 1000)
        : undefined;

      // Create vouch
      const vouch = await this.prisma.reputationVouch.create({
        data: {
          voucherProfileId: voucherProfile.id,
          voucheeProfileId: voucheeProfile.id,
          vouchAmount: new Decimal(input.vouchAmount),
          riskSharePercentage: new Decimal(input.riskSharePercentage),
          isActive: true,
          expiresAt: expiresAt ?? null,
        },
      });

      // Increase vouchee's credit limit temporarily
      await this.prisma.riskProfile.update({
        where: { id: voucheeProfile.id },
        data: {
          baseCreditLimit: voucheeProfile.baseCreditLimit.add(input.vouchAmount),
          currentCreditLimit: voucheeProfile.currentCreditLimit.add(
            input.vouchAmount * parseFloat(voucheeProfile.creditMultiplier.toString())
          ),
        },
      });

      this.logger.log(
        `Vouch created: ${input.voucherOrganizationId} vouches ${input.vouchAmount} for ${input.voucheeOrganizationId}`
      );

      return {
        success: true,
        vouch,
        message: 'Reputation vouch created successfully',
      };
    } catch (error) {
      this.logger.error(`Error creating vouch: ${error}`);
      throw error;
    }
  }

  /**
   * Handle vouchee default (Risk-Sharing Vouching)
   * If vouchee defaults, voucher's credit and score are penalized
   */
  async processVoucheeDefault(voucheeOrganizationId: string, defaultAmount: number): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get all active vouches for this vouchee
        const voucheeProfile = await tx.riskProfile.findUnique({
          where: { organizationId: voucheeOrganizationId },
          include: {
            vouchesReceived: {
              where: { isActive: true, isDefaulted: false },
              include: { voucherProfile: true },
            },
          },
        });

        if (!voucheeProfile || voucheeProfile.vouchesReceived.length === 0) {
          this.logger.warn(`No active vouches found for ${voucheeOrganizationId}`);
          return { success: true, vouchesAffected: 0 };
        }

        const results = [];

        // Process each vouch
        for (const vouch of voucheeProfile.vouchesReceived) {
          const vouchAmount = parseFloat(vouch.vouchAmount.toString());
          const riskShare = parseFloat(vouch.riskSharePercentage.toString());

          // Calculate voucher's share of loss
          const voucherLoss = Math.min(defaultAmount * (riskShare / 100), vouchAmount);

          // Mark vouch as defaulted
          await tx.reputationVouch.update({
            where: { id: vouch.id },
            data: {
              isDefaulted: true,
              isActive: false,
              defaultedAt: new Date(),
            },
          });

          // Penalize voucher's score and credit
          const voucherScore = parseFloat(vouch.voucherProfile.score.toString());
          const scorePenalty = (voucherLoss / vouchAmount) * 20; // Max 20 points penalty
          const newScore = Math.max(0, voucherScore - scorePenalty);

          await tx.riskProfile.update({
            where: { id: vouch.voucherProfile.id },
            data: {
              score: new Decimal(newScore.toFixed(4)),
              currentCreditLimit: vouch.voucherProfile.currentCreditLimit.sub(voucherLoss),
            },
          });

          // Create financial event for voucher
          await tx.financialEvent.create({
            data: {
              riskProfileId: vouch.voucherProfile.id,
              eventType: 'VOUCHED_FAILURE',
              impactValue: new Decimal(-scorePenalty),
              description: `Vouchee ${voucheeOrganizationId} defaulted. Loss: ${voucherLoss}`,
              processed: true,
              processedAt: new Date(),
            },
          });

          results.push({
            voucherOrganizationId: vouch.voucherProfile.organizationId,
            loss: voucherLoss,
            scorePenalty,
          });

          this.logger.log(
            `Voucher ${vouch.voucherProfile.organizationId} penalized: -${scorePenalty.toFixed(2)} score, -${voucherLoss} credit`
          );
        }

        // Penalize vouchee as well
        await tx.financialEvent.create({
          data: {
            riskProfileId: voucheeProfile.id,
            eventType: 'DEFAULT',
            impactValue: new Decimal(-50), // Heavy penalty
            description: `Defaulted on ${defaultAmount} payment`,
            processed: true,
            processedAt: new Date(),
          },
        });

        return {
          success: true,
          vouchesAffected: results.length,
          voucherPenalties: results,
        };
      });
    } catch (error) {
      this.logger.error(`Error processing vouchee default: ${error}`);
      throw error;
    }
  }

  /**
   * Get risk profile with current score
   */
  async getRiskProfile(organizationId: string): Promise<any> {
    try {
      const profile = await this.prisma.riskProfile.findUnique({
        where: { organizationId },
        include: {
          financialEvents: {
            orderBy: { occurredAt: 'desc' },
            take: 10,
          },
          vouchesReceived: {
            where: { isActive: true },
          },
          vouchesGiven: {
            where: { isActive: true },
          },
        },
      });

      return profile;
    } catch (error) {
      this.logger.error(`Error getting risk profile: ${error}`);
      throw error;
    }
  }
}

export default RiskEngine;

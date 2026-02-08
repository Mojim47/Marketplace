/**
 * ???????????????????????????????????????????????????????????????????????????
 * USER VERIFICATION SERVICE - State Machine Implementation
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: Manage user verification lifecycle and KYB process
 * Critical: Prevent unverified users from accessing financial features
 * ???????????????????????????????????????????????????????????????????????????
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import {
  KYBSubmissionDTO,
  KYBApprovalDTO,
  STATE_TRANSITION_RULES,
  CREDIT_LIMIT_BY_STATUS,
  RISK_SCORE_BY_STATUS,
  VerificationStatus,
} from './user-verification.types';

type OrganizationType = 'INDIVIDUAL' | 'COMPANY' | 'GOVERNMENT';

@Injectable()
export class UserVerificationService {
  private readonly logger = new Logger(UserVerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit KYB documents and transition to PENDING_KYB
   */
  async submitKYB(data: KYBSubmissionDTO): Promise<{
    success: boolean;
    newStatus: VerificationStatus;
    message: string;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          id: true,
          verificationStatus: true,
          organizationId: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Validate state transition
      this.validateStateTransition(
        user.verificationStatus as VerificationStatus,
        VerificationStatus.PENDING_KYB
      );

      // Update user and organization
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Update user status
        await tx.user.update({
          where: { id: data.userId },
          data: {
            verificationStatus: VerificationStatus.PENDING_KYB,
          },
        });

        // Update organization details
        if (data.organizationId) {
          await tx.organization.update({
            where: { id: data.organizationId },
            data: {
              name: data.businessName,
              type: data.businessType as OrganizationType,
              // Store KYB documents in metadata or separate table
            },
          });
        }

        // Log state transition
        await tx.auditLog.create({
          data: {
            userId: data.userId,
            action: 'KYB_SUBMITTED',
            entity: 'User',
            entityId: data.userId,
            changes: JSON.stringify({
              fromStatus: user.verificationStatus,
              toStatus: VerificationStatus.PENDING_KYB,
              businessName: data.businessName,
            }),
          },
        });
      });

      this.logger.log(`KYB submitted for user ${data.userId}`);

      return {
        success: true,
        newStatus: VerificationStatus.PENDING_KYB,
        message: 'KYB documents submitted. Verification in progress.',
      };
    } catch (error: any) {
      this.logger.error(`KYB submission failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-approve KYB and transition to ACTIVE_LIMITED
   * Creates initial RiskProfile with base credit and score
   */
  async autoApproveKYB(userId: string): Promise<{
    success: boolean;
    newStatus: VerificationStatus;
    riskProfile: any;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          verificationStatus: true,
          organizationId: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Validate state transition
      this.validateStateTransition(
        user.verificationStatus as VerificationStatus,
        VerificationStatus.ACTIVE_LIMITED
      );

      // Transaction: Update user + Create RiskProfile
      const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Update user status
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            verificationStatus: VerificationStatus.ACTIVE_LIMITED,
          },
        });

        // Create RiskProfile if organization exists
        let riskProfile = null;
        if (user.organizationId) {
          // Check if profile already exists
          const existing = await tx.riskProfile.findUnique({
            where: { organizationId: user.organizationId },
          });

          if (!existing) {
            const baseCreditLimit = new Decimal(
              CREDIT_LIMIT_BY_STATUS[VerificationStatus.ACTIVE_LIMITED]
            );
            const baseScore = new Decimal(
              RISK_SCORE_BY_STATUS[VerificationStatus.ACTIVE_LIMITED]
            );

            riskProfile = await tx.riskProfile.create({
              data: {
                organizationId: user.organizationId,
                score: baseScore,
                baseCreditLimit: baseCreditLimit,
                currentCreditLimit: baseCreditLimit,
                decayLambda: new Decimal('0.1'), // Default Lambda
              },
            });

            this.logger.log(`RiskProfile created for org ${user.organizationId}`);
          } else {
            riskProfile = existing;
          }
        }

        // Log state transition
        await tx.auditLog.create({
          data: {
            userId: userId,
            action: 'KYB_AUTO_APPROVED',
            entity: 'User',
            entityId: userId,
            changes: JSON.stringify({
              fromStatus: user.verificationStatus,
              toStatus: VerificationStatus.ACTIVE_LIMITED,
              creditLimit: CREDIT_LIMIT_BY_STATUS[VerificationStatus.ACTIVE_LIMITED],
              riskScore: RISK_SCORE_BY_STATUS[VerificationStatus.ACTIVE_LIMITED],
            }),
          },
        });

        return { updatedUser, riskProfile };
      });

      this.logger.log(`User ${userId} auto-approved to ACTIVE_LIMITED`);

      return {
        success: true,
        newStatus: VerificationStatus.ACTIVE_LIMITED,
        riskProfile: result.riskProfile,
      };
    } catch (error: any) {
      this.logger.error(`Auto-approval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Manual approval by admin to ACTIVE_FULL
   * Increases credit limit and risk score
   */
  async manualApproveKYB(data: KYBApprovalDTO, approvedBy: string): Promise<{
    success: boolean;
    newStatus: VerificationStatus;
    riskProfile: any;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          id: true,
          verificationStatus: true,
          organizationId: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (!data.approved) {
        // Reject KYB
        return this.rejectKYB(data.userId, data.rejectionReason || 'Failed verification');
      }

      // Validate state transition
      this.validateStateTransition(
        user.verificationStatus as VerificationStatus,
        VerificationStatus.ACTIVE_FULL
      );

      // Transaction: Update user + Update RiskProfile
      const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Update user status
        await tx.user.update({
          where: { id: data.userId },
          data: {
            verificationStatus: VerificationStatus.ACTIVE_FULL,
          },
        });

        // Update RiskProfile
        let riskProfile = null;
        if (user.organizationId) {
          const baseCreditLimit = new Decimal(
            data.creditLimitBase || CREDIT_LIMIT_BY_STATUS[VerificationStatus.ACTIVE_FULL]
          );
          const baseScore = new Decimal(
            data.riskScoreBase || RISK_SCORE_BY_STATUS[VerificationStatus.ACTIVE_FULL]
          );

          riskProfile = await tx.riskProfile.upsert({
            where: { organizationId: user.organizationId },
            create: {
              organizationId: user.organizationId,
              score: baseScore,
              baseCreditLimit: baseCreditLimit,
              currentCreditLimit: baseCreditLimit,
              decayLambda: new Decimal('0.1'),
            },
            update: {
              score: baseScore,
              baseCreditLimit: baseCreditLimit,
              currentCreditLimit: baseCreditLimit,
            },
          });
        }

        // Log state transition
        await tx.auditLog.create({
          data: {
            userId: data.userId,
            action: 'KYB_MANUALLY_APPROVED',
            entity: 'User',
            entityId: data.userId,
            changes: JSON.stringify({
              fromStatus: user.verificationStatus,
              toStatus: VerificationStatus.ACTIVE_FULL,
              approvedBy,
              creditLimit: data.creditLimitBase || CREDIT_LIMIT_BY_STATUS[VerificationStatus.ACTIVE_FULL],
              riskScore: data.riskScoreBase || RISK_SCORE_BY_STATUS[VerificationStatus.ACTIVE_FULL],
              notes: data.approverNotes,
            }),
          },
        });

        return { riskProfile };
      });

      this.logger.log(`User ${data.userId} manually approved to ACTIVE_FULL by ${approvedBy}`);

      return {
        success: true,
        newStatus: VerificationStatus.ACTIVE_FULL,
        riskProfile: result.riskProfile,
      };
    } catch (error: any) {
      this.logger.error(`Manual approval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reject KYB application
   */
  async rejectKYB(userId: string, reason: string): Promise<{
    success: boolean;
    newStatus: VerificationStatus;
    riskProfile: null;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          verificationStatus: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            verificationStatus: VerificationStatus.REJECTED,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: userId,
            action: 'KYB_REJECTED',
            entity: 'User',
            entityId: userId,
            changes: JSON.stringify({
              fromStatus: user.verificationStatus,
              toStatus: VerificationStatus.REJECTED,
              reason,
            }),
          },
        });
      });

      this.logger.log(`User ${userId} KYB rejected: ${reason}`);

      return {
        success: true,
        newStatus: VerificationStatus.REJECTED,
        riskProfile: null,
      };
    } catch (error: any) {
      this.logger.error(`KYB rejection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId: string, reason: string, suspendedBy: string): Promise<{
    success: boolean;
    newStatus: VerificationStatus;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          verificationStatus: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      this.validateStateTransition(
        user.verificationStatus as VerificationStatus,
        VerificationStatus.SUSPENDED
      );

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            verificationStatus: VerificationStatus.SUSPENDED,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: userId,
            action: 'USER_SUSPENDED',
            entity: 'User',
            entityId: userId,
            changes: JSON.stringify({
              fromStatus: user.verificationStatus,
              toStatus: VerificationStatus.SUSPENDED,
              reason,
              suspendedBy,
            }),
          },
        });
      });

      this.logger.log(`User ${userId} suspended by ${suspendedBy}: ${reason}`);

      return {
        success: true,
        newStatus: VerificationStatus.SUSPENDED,
      };
    } catch (error: any) {
      this.logger.error(`User suspension failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user verification status and risk profile
   */
  async getUserVerificationStatus(userId: string): Promise<{
    userId: string;
    verificationStatus: VerificationStatus;
    organizationId: string | null;
    riskProfile: any | null;
    canAccessFinancialFeatures: boolean;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          verificationStatus: true,
          organizationId: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      let riskProfile = null;
      if (user.organizationId) {
        riskProfile = await this.prisma.riskProfile.findUnique({
          where: { organizationId: user.organizationId },
        });
      }

      const canAccessFinancialFeatures = (
        user.verificationStatus === VerificationStatus.ACTIVE_LIMITED ||
        user.verificationStatus === VerificationStatus.ACTIVE_FULL
      );

      return {
        userId: user.id,
        verificationStatus: user.verificationStatus as VerificationStatus,
        organizationId: user.organizationId,
        riskProfile,
        canAccessFinancialFeatures,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get verification status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate state transition
   */
  private validateStateTransition(
    fromStatus: VerificationStatus,
    toStatus: VerificationStatus
  ): void {
    const allowedTransitions = (STATE_TRANSITION_RULES as any)[fromStatus] as VerificationStatus[] | undefined;

    if (!allowedTransitions || !allowedTransitions.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid state transition: ${fromStatus} ? ${toStatus}`
      );
    }
  }

  /**
   * Check if user can access financial features
   */
  async canAccessFinancialFeatures(userId: string): Promise<boolean> {
    const status = await this.getUserVerificationStatus(userId);
    return status.canAccessFinancialFeatures;
  }
}

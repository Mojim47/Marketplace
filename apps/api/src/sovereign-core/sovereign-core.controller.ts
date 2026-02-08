/**
 * ???????????????????????????????????????????????????????????????????????????
 * SOVEREIGN CORE CONTROLLER - WARRANTY & RISK ENDPOINTS
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: API endpoints for warranty registration and risk event processing
 * Critical: Strong RBAC enforcement for warranty activation (INSTALLER only)
 * ???????????????????????????????????????????????????????????????????????????
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RiskEngine } from './risk-engine.service';
import { PrismaClient } from '@prisma/client';

type UserRole = 'ADMIN' | 'CUSTOMER' | 'VENDOR' | 'INSTALLER' | 'SUPPORT' | 'EXECUTOR';

enum UserRoleEnum {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  INSTALLER = 'INSTALLER',
  SUPPORT = 'SUPPORT',
  EXECUTOR = 'EXECUTOR',
}

enum WarrantyStatusEnum {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  VOIDED = 'VOIDED',
}

type WarrantyStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'VOIDED';

const prisma = new PrismaClient();

@Controller('sovereign-core')
export class SovereignCoreController {
  constructor(private readonly riskEngine: RiskEngine) {}

  /**
   * POST /api/sovereign-core/warranty/register
   * Register warranty - INSTALLER role ONLY
   * Golden Rule: serialNumber must be UNIQUE
   */
  @Post('warranty/register')
  async registerWarranty(
    @Request() req: any,
    @Body()
    body: {
      productId: string;
      serialNumber: string;
      installationProjectId: string;
      customerId: string;
      customerName: string;
      customerMobile: string;
      customerAddress: string;
      warrantyMonths?: number;
    }
  ) {
    const installerId = req.user.sub || req.user.id;

    try {
      // Validate that installer is EXECUTOR/INSTALLER
      const installer = await prisma.user.findUnique({
        where: { id: installerId },
        select: { role: true, executorProfile: true },
      });

      if (!installer || installer.role !== UserRoleEnum.EXECUTOR) {
        throw new ForbiddenException(
          'Only users with INSTALLER/EXECUTOR role can register warranties'
        );
      }

      // Validate serial number uniqueness
      const existingWarranty = await prisma.warrantyRegistry.findUnique({
        where: { serialNumber: body.serialNumber },
      });

      if (existingWarranty) {
        throw new BadRequestException(
          `Serial number ${body.serialNumber} is already registered`
        );
      }

      // Validate installation project exists and belongs to installer
      const project = await prisma.installationProject.findUnique({
        where: { id: body.installationProjectId },
      });

      if (!project || project.installerId !== installerId) {
        throw new BadRequestException(
          'Invalid installation project or unauthorized access'
        );
      }

      // Calculate expiration date
      const warrantyMonths = body.warrantyMonths || 12;
      const startsAt = new Date();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + warrantyMonths);

      // Create warranty registry
      const warranty = await prisma.warrantyRegistry.create({
        data: {
          productId: body.productId,
          serialNumber: body.serialNumber,
          activatedBy: installerId,
          installationProjectId: body.installationProjectId,
          customerId: body.customerId,
          customerName: body.customerName,
          customerMobile: body.customerMobile,
          customerAddress: body.customerAddress,
          warrantyMonths,
          startsAt,
          expiresAt,
          status: WarrantyStatusEnum.ACTIVE,
        },
      });

      return {
        success: true,
        warranty,
        message: 'Warranty registered successfully',
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * GET /api/sovereign-core/warranty/:serialNumber
   * Get warranty by serial number
   */
  @Get('warranty/:serialNumber')
  async getWarranty(@Param('serialNumber') serialNumber: string) {
    try {
      const warranty = await prisma.warrantyRegistry.findUnique({
        where: { serialNumber },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          installer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mobile: true,
            },
          },
          installationProject: {
            select: {
              id: true,
              projectName: true,
              status: true,
            },
          },
        },
      });

      if (!warranty) {
        throw new BadRequestException('Warranty not found');
      }

      return {
        success: true,
        warranty,
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * POST /api/sovereign-core/risk/process-event
   * Process financial event and update risk score
   * Requires ADMIN or FINANCE_CONTROLLER role
   */
  @Post('risk/process-event')
  async processRiskEvent(
    @Body()
    body: {
      organizationId: string;
      eventType:
        | 'PAYMENT_ON_TIME'
        | 'PAYMENT_LATE'
        | 'DEFAULT'
        | 'CHEQUE_BOUNCED'
        | 'CREDIT_INCREASE'
        | 'CREDIT_DECREASE';
      impactValue: number;
      description: string;
      relatedOrderId?: string;
      relatedProformaId?: string;
      relatedChequeId?: string;
    }
  ) {
    try {
      const result = await this.riskEngine.processFinancialEvent({
        organizationId: body.organizationId,
        eventType: body.eventType as any,
        impactValue: body.impactValue,
        description: body.description,
        relatedOrderId: body.relatedOrderId,
        relatedProformaId: body.relatedProformaId,
        relatedChequeId: body.relatedChequeId,
      });

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * POST /api/sovereign-core/risk/vouch
   * Create reputation vouch (risk-sharing guarantee)
   */
  @Post('risk/vouch')
  async createVouch(
    @Request() req: any,
    @Body()
    body: {
      voucheeOrganizationId: string;
      vouchAmount: number;
      riskSharePercentage: number;
      expirationDays?: number;
    }
  ) {
    const userId = req.user.sub || req.user.id;

    try {
      // Get voucher's organization
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        throw new ForbiddenException(
          'User must belong to an organization to vouch'
        );
      }

      const result = await this.riskEngine.vouchForOrganization({
        voucherOrganizationId: user.organizationId,
        voucheeOrganizationId: body.voucheeOrganizationId,
        vouchAmount: body.vouchAmount,
        riskSharePercentage: body.riskSharePercentage,
        expirationDays: body.expirationDays,
      });

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * GET /api/sovereign-core/risk/profile/:organizationId
   * Get risk profile and credit status
   */
  @Get('risk/profile/:organizationId')
  async getRiskProfile(@Param('organizationId') organizationId: string) {
    try {
      const profile = await this.riskEngine.getRiskProfile(organizationId);

      if (!profile) {
        throw new BadRequestException('Risk profile not found');
      }

      return {
        success: true,
        profile,
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * POST /api/sovereign-core/risk/process-default
   * Process vouchee default and penalize vouchers
   * Requires ADMIN role
   */
  @Post('risk/process-default')
  async processDefault(
    @Body()
    body: {
      voucheeOrganizationId: string;
      defaultAmount: number;
    }
  ) {
    try {
      const result = await this.riskEngine.processVoucheeDefault(
        body.voucheeOrganizationId,
        body.defaultAmount
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }
}

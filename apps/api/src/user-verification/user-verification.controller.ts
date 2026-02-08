/**
 * ???????????????????????????????????????????????????????????????????????????
 * USER VERIFICATION CONTROLLER - KYB API Endpoints
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: REST API for user verification and KYB process
 * Critical: Gateway for clean data entry into the system
 * ???????????????????????????????????????????????????????????????????????????
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { UserVerificationService } from './user-verification.service';
import {
  KYBSubmissionDTO,
  KYBApprovalDTO,
} from './user-verification.types';

@Controller('user-verification')
export class UserVerificationController {
  constructor(private readonly verificationService: UserVerificationService) {}

  /**
   * POST /api/user-verification/submit-kyb
   * Submit KYB documents for verification
   */
  @Post('submit-kyb')
  async submitKYB(
    @Request() req: any,
    @Body() body: KYBSubmissionDTO
  ) {
    try {
      const userId = req.user?.sub || req.user?.id || body.userId;

      const result = await this.verificationService.submitKYB({
        ...body,
        userId,
      });

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * POST /api/user-verification/auto-approve/:userId
   * Auto-approve KYB (system triggered)
   */
  @Post('auto-approve/:userId')
  async autoApproveKYB(@Param('userId') userId: string) {
    try {
      const result = await this.verificationService.autoApproveKYB(userId);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * POST /api/user-verification/manual-approve
   * Manual approval by admin (requires ADMIN role)
   */
  @Post('manual-approve')
  async manualApproveKYB(
    @Request() req: any,
    @Body() body: KYBApprovalDTO
  ) {
    try {
      const approvedBy = req.user?.sub || req.user?.id || 'SYSTEM';

      const result = await this.verificationService.manualApproveKYB(
        body,
        approvedBy
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * POST /api/user-verification/suspend
   * Suspend user account (requires ADMIN role)
   */
  @Post('suspend')
  async suspendUser(
    @Request() req: any,
    @Body() body: { userId: string; reason: string }
  ) {
    try {
      const suspendedBy = req.user?.sub || req.user?.id || 'SYSTEM';

      const result = await this.verificationService.suspendUser(
        body.userId,
        body.reason,
        suspendedBy
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * GET /api/user-verification/status/:userId
   * Get user verification status and risk profile
   */
  @Get('status/:userId')
  async getUserStatus(@Param('userId') userId: string) {
    try {
      const status = await this.verificationService.getUserVerificationStatus(userId);
      return status;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * GET /api/user-verification/can-access-financial/:userId
   * Check if user can access financial features
   */
  @Get('can-access-financial/:userId')
  async canAccessFinancial(@Param('userId') userId: string) {
    try {
      const canAccess = await this.verificationService.canAccessFinancialFeatures(userId);
      return {
        userId,
        canAccessFinancialFeatures: canAccess,
      };
    } catch (error: any) {
      throw error;
    }
  }
}

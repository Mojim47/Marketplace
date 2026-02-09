/**
 * ???????????????????????????????????????????????????????????????????????????
 * USER VERIFICATION CONTROLLER - KYB API Endpoints
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: REST API for user verification and KYB process
 * Critical: Gateway for clean data entry into the system
 * ???????????????????????????????????????????????????????????????????????????
 */

import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import type { UserVerificationService } from './user-verification.service';
import type { KYBApprovalDTO, KYBSubmissionDTO } from './user-verification.types';

@Controller('user-verification')
export class UserVerificationController {
  constructor(private readonly verificationService: UserVerificationService) {}

  /**
   * POST /api/user-verification/submit-kyb
   * Submit KYB documents for verification
   */
  @Post('submit-kyb')
  async submitKYB(@Request() req: any, @Body() body: KYBSubmissionDTO) {
    const userId = req.user?.sub || req.user?.id || body.userId;

    const result = await this.verificationService.submitKYB({
      ...body,
      userId,
    });

    return result;
  }

  /**
   * POST /api/user-verification/auto-approve/:userId
   * Auto-approve KYB (system triggered)
   */
  @Post('auto-approve/:userId')
  async autoApproveKYB(@Param('userId') userId: string) {
    const result = await this.verificationService.autoApproveKYB(userId);
    return result;
  }

  /**
   * POST /api/user-verification/manual-approve
   * Manual approval by admin (requires ADMIN role)
   */
  @Post('manual-approve')
  async manualApproveKYB(@Request() req: any, @Body() body: KYBApprovalDTO) {
    const approvedBy = req.user?.sub || req.user?.id || 'SYSTEM';

    const result = await this.verificationService.manualApproveKYB(body, approvedBy);

    return result;
  }

  /**
   * POST /api/user-verification/suspend
   * Suspend user account (requires ADMIN role)
   */
  @Post('suspend')
  async suspendUser(@Request() req: any, @Body() body: { userId: string; reason: string }) {
    const suspendedBy = req.user?.sub || req.user?.id || 'SYSTEM';

    const result = await this.verificationService.suspendUser(
      body.userId,
      body.reason,
      suspendedBy
    );

    return result;
  }

  /**
   * GET /api/user-verification/status/:userId
   * Get user verification status and risk profile
   */
  @Get('status/:userId')
  async getUserStatus(@Param('userId') userId: string) {
    const status = await this.verificationService.getUserVerificationStatus(userId);
    return status;
  }

  /**
   * GET /api/user-verification/can-access-financial/:userId
   * Check if user can access financial features
   */
  @Get('can-access-financial/:userId')
  async canAccessFinancial(@Param('userId') userId: string) {
    const canAccess = await this.verificationService.canAccessFinancialFeatures(userId);
    return {
      userId,
      canAccessFinancialFeatures: canAccess,
    };
  }
}

import { 
  Controller, 
  Get, 
  Patch, 
  Body, 
  Param, 
  Logger,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request
} from '@nestjs/common'
import { AdminService } from './admin.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../common/guards/index'

// DTOs
interface PlatformStats {
  totalUsers: number
  totalVendors: number
  totalProducts: number
  totalRevenue: number
  activeArSessions: number
  todaySignups: number
}

interface PlatformSettings {
  maintenanceMode?: boolean
  enableAR?: boolean
  enableAI?: boolean
  commissionRate?: number
}

interface BanUserDto {
  reason: string
}

interface AuthenticatedRequest {
  user?: { id: string; [key: string]: any }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  private readonly logger = new Logger(AdminController.name)

  constructor(private readonly adminService: AdminService) {}

  /**
   * Get platform-wide statistics
   * GET /admin/stats
   */
  @Get('stats')
  async getPlatformStats(): Promise<PlatformStats> {
    this.logger.log('Fetching platform statistics')
    return this.adminService.getPlatformStats()
  }

  /**
   * Get current platform settings
   * GET /admin/settings
   */
  @Get('settings')
  async getSettings(): Promise<PlatformSettings> {
    this.logger.log('Fetching platform settings')
    return this.adminService.getSettings()
  }

  /**
   * Update platform settings
   * PATCH /admin/settings
   */
  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @Body() settings: PlatformSettings
  ): Promise<{ message: string; settings: PlatformSettings }> {
    this.logger.log('Updating platform settings', settings)
    const updated = await this.adminService.updateSettings(settings)
    return {
      message: 'Settings updated successfully',
      settings: updated
    }
  }

  /**
   * Ban or unban a user
   * PATCH /admin/users/:id/ban
   */
  @Patch('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  async banUser(
    @Param('id') userId: string,
    @Body() banData: BanUserDto,
    @Request() req: AuthenticatedRequest
  ): Promise<{ message: string }> {
    this.logger.log(`Banning user ${userId}`, banData)
    const adminId = req.user?.id || 'system'
    await this.adminService.banUser(userId, banData.reason, adminId)
    return { message: 'User banned successfully' }
  }

  /**
   * Unban a user
   * PATCH /admin/users/:id/unban
   */
  @Patch('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  async unbanUser(
    @Param('id') userId: string,
    @Request() req: AuthenticatedRequest
  ): Promise<{ message: string }> {
    this.logger.log(`Unbanning user ${userId}`)
    const adminId = req.user?.id || 'system'
    await this.adminService.unbanUser(userId, adminId)
    return { message: 'User unbanned successfully' }
  }

  /**
   * Get all users with pagination
   * GET /admin/users
   */
  @Get('users')
  async getAllUsers() {
    this.logger.log('Fetching all users')
    return this.adminService.getAllUsers()
  }

  /**
   * Get all vendor applications
   * GET /admin/vendors/pending
   */
  @Get('vendors/pending')
  async getPendingVendors() {
    this.logger.log('Fetching pending vendor applications')
    return this.adminService.getPendingVendors()
  }

  /**
   * Approve vendor application
   * PATCH /admin/vendors/:id/approve
   */
  @Patch('vendors/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveVendor(
    @Param('id') vendorId: string,
    @Request() req: AuthenticatedRequest
  ): Promise<{ message: string }> {
    this.logger.log(`Approving vendor ${vendorId}`)
    const adminId = req.user?.id || 'system'
    await this.adminService.approveVendor(vendorId, adminId)
    return { message: 'Vendor approved successfully' }
  }

  /**
   * Reject vendor application
   * PATCH /admin/vendors/:id/reject
   */
  @Patch('vendors/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectVendor(
    @Param('id') vendorId: string,
    @Body() data: { reason: string },
    @Request() req: AuthenticatedRequest
  ): Promise<{ message: string }> {
    this.logger.log(`Rejecting vendor ${vendorId}`, data)
    const adminId = req.user?.id || 'system'
    await this.adminService.rejectVendor(vendorId, data.reason, adminId)
    return { message: 'Vendor rejected successfully' }
  }
}

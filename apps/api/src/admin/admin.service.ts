import { Injectable, Logger, NotFoundException, Inject, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'

interface PlatformStats {
  totalUsers: number
  totalVendors: number
  totalProducts: number
  totalRevenue: number
  activeArSessions: number
  todaySignups: number
  pendingOrders: number
  activeExecutors: number
}

interface PlatformSettings {
  maintenanceMode?: boolean
  enableAR?: boolean
  enableAI?: boolean
  commissionRate?: number
  minOrderAmount?: number
  maxOrderAmount?: number
  supportEmail?: string
  supportPhone?: string
}

const SETTINGS_CACHE_KEY = 'platform:settings'
const STATS_CACHE_KEY = 'platform:stats'
const AR_SESSIONS_KEY = 'ar:active_sessions'

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  async onModuleInit() {
    // Load settings from database on startup
    await this.loadSettingsFromDatabase()
  }

  /**
   * Load platform settings from database
   */
  private async loadSettingsFromDatabase(): Promise<void> {
    try {
      const settings = await this.prisma.platformSettings.findFirst({
        where: { isActive: true }
      })
      
      if (settings) {
        await this.cacheManager.set(SETTINGS_CACHE_KEY, settings.config, 3600000) // 1 hour
        this.logger.log('Platform settings loaded from database')
      }
    } catch (error) {
      this.logger.warn('Could not load platform settings from database, using defaults')
    }
  }

  /**
   * Get platform-wide statistics
   */
  async getPlatformStats(): Promise<PlatformStats> {
    try {
      // Try to get from cache first
      const cachedStats = await this.cacheManager.get<PlatformStats>(STATS_CACHE_KEY)
      if (cachedStats) {
        return cachedStats
      }

      const [totalUsers, totalVendors, totalProducts, pendingOrders, activeExecutors] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.vendor.count(),
        this.prisma.product.count(),
        this.prisma.order.count({ where: { status: 'PENDING' } }),
        this.prisma.executor.count({ where: { isActive: true } })
      ])

      // Get today's signups
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const todaySignups = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: todayStart
          }
        }
      })

      // Calculate total revenue from orders
      const revenueData = await this.prisma.order.aggregate({
        _sum: {
          totalAmount: true
        },
        where: {
          status: 'DELIVERED',
          paymentStatus: 'COMPLETED'
        }
      })
      const totalRevenueRaw = revenueData._sum.totalAmount
      const totalRevenue = totalRevenueRaw ? totalRevenueRaw.toNumber() : 0

      // Get active AR sessions from Redis cache
      let activeArSessions = 0
      try {
        const arSessionsCount = await this.cacheManager.get<number>(AR_SESSIONS_KEY)
        activeArSessions = arSessionsCount || 0
      } catch {
        this.logger.debug('Could not fetch AR sessions count from cache')
      }

      const stats: PlatformStats = {
        totalUsers,
        totalVendors,
        totalProducts,
        totalRevenue,
        activeArSessions,
        todaySignups,
        pendingOrders,
        activeExecutors
      }

      // Cache stats for 5 minutes
      await this.cacheManager.set(STATS_CACHE_KEY, stats, 300000)

      return stats
    } catch (error) {
      this.logger.error('Failed to fetch platform stats', error)
      throw error
    }
  }

  /**
   * Update platform settings
   */
  async updateSettings(settings: PlatformSettings): Promise<PlatformSettings> {
    try {
      // Get current settings
      const currentSettings = await this.getSettings()
      
      // Merge with new settings
      const updatedSettings = {
        ...currentSettings,
        ...settings
      }

      // Persist to database
      await this.prisma.platformSettings.upsert({
        where: { id: 'default' },
        update: {
          config: updatedSettings as any,
          updatedAt: new Date()
        },
        create: {
          id: 'default',
          config: updatedSettings as any,
          isActive: true
        }
      })

      // Update cache
      await this.cacheManager.set(SETTINGS_CACHE_KEY, updatedSettings, 3600000)

      this.logger.log('Platform settings updated', { settings: updatedSettings })

      return updatedSettings
    } catch (error) {
      this.logger.error('Failed to update platform settings', error)
      throw error
    }
  }

  /**
   * Get current platform settings
   */
  async getSettings(): Promise<PlatformSettings> {
    // Try cache first
    const cachedSettings = await this.cacheManager.get<PlatformSettings>(SETTINGS_CACHE_KEY)
    if (cachedSettings) {
      return cachedSettings
    }

    // Load from database
    try {
      const dbSettings = await this.prisma.platformSettings.findFirst({
        where: { isActive: true }
      })
      
      if (dbSettings) {
        const settings = dbSettings.config as PlatformSettings
        await this.cacheManager.set(SETTINGS_CACHE_KEY, settings, 3600000)
        return settings
      }
    } catch {
      this.logger.debug('Could not load settings from database')
    }

    // Return defaults
    return {
      maintenanceMode: false,
      enableAR: true,
      enableAI: true,
      commissionRate: 10,
      minOrderAmount: 100000,
      maxOrderAmount: 100000000000,
      supportEmail: 'support@nextgen.ir',
      supportPhone: '021-12345678'
    }
  }

  /**
   * Ban a user
   */
  async banUser(userId: string, reason: string, adminId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`)
    }

    await this.prisma.$transaction([
      // Update user status
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          bannedAt: new Date(),
          banReason: reason
        }
      }),
      // Create audit log
      this.prisma.auditLog.create({
        data: {
          action: 'USER_BANNED',
          entityType: 'User',
          entityId: userId,
          performedBy: adminId,
          details: { reason },
          ipAddress: '',
          userAgent: ''
        }
      })
    ])

    this.logger.log(`User ${userId} banned by admin ${adminId}. Reason: ${reason}`)
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: string, adminId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`)
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: true,
          bannedAt: null,
          banReason: null
        }
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'USER_UNBANNED',
          entityType: 'User',
          entityId: userId,
          performedBy: adminId,
          details: {},
          ipAddress: '',
          userAgent: ''
        }
      })
    ])

    this.logger.log(`User ${userId} unbanned by admin ${adminId}`)
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { mobile: { contains: search } }
      ]
    } : {}

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          role: true,
          isActive: true,
          bannedAt: true,
          banReason: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: { orders: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.user.count({ where })
    ])

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get pending vendor applications
   */
  async getPendingVendors(page = 1, limit = 20) {
    const skip = (page - 1) * limit

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where: { status: 'pending' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              mobile: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.vendor.count({ where: { status: 'pending' } })
    ])

    return {
      vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Approve vendor application
   */
  async approveVendor(vendorId: string, adminId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true }
    })

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`)
    }

    await this.prisma.$transaction([
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'active',
          verifiedAt: new Date()
        }
      }),
      // Update user role to SELLER
      this.prisma.user.update({
        where: { id: vendor.userId },
        data: { role: 'SELLER' }
      }),
      // Create audit log
      this.prisma.auditLog.create({
        data: {
          action: 'VENDOR_APPROVED',
          entityType: 'Vendor',
          entityId: vendorId,
          performedBy: adminId,
          details: { businessName: vendor.businessName },
          ipAddress: '',
          userAgent: ''
        }
      })
    ])

    this.logger.log(`Vendor ${vendorId} (${vendor.businessName}) approved by admin ${adminId}`)
  }

  /**
   * Reject vendor application
   */
  async rejectVendor(vendorId: string, reason: string, adminId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId }
    })

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`)
    }

    await this.prisma.$transaction([
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          rejectedAt: new Date()
        }
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'VENDOR_REJECTED',
          entityType: 'Vendor',
          entityId: vendorId,
          performedBy: adminId,
          details: { reason, businessName: vendor.businessName },
          ipAddress: '',
          userAgent: ''
        }
      })
    ])

    this.logger.log(`Vendor ${vendorId} rejected by admin ${adminId}. Reason: ${reason}`)
  }

  /**
   * Get dashboard summary for admin
   */
  async getDashboardSummary() {
    const stats = await this.getPlatformStats()
    
    // Get recent orders
    const recentOrders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    })

    // Get recent signups
    const recentUsers = await this.prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    })

    // Get revenue by day (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const revenueByDay = await this.prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= ${sevenDaysAgo}
        AND status = 'DELIVERED'
        AND payment_status = 'COMPLETED'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `

    return {
      stats,
      recentOrders,
      recentUsers,
      revenueByDay
    }
  }
}

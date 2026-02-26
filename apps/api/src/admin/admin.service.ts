import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { PrismaService } from '../database/prisma.service';

interface PlatformStats {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalRevenue: number;
  activeArSessions: number;
  todaySignups: number;
  pendingOrders: number;
  activeExecutors: number;
}

interface PlatformSettings {
  maintenanceMode?: boolean;
  enableAR?: boolean;
  enableAI?: boolean;
  commissionRate?: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  supportEmail?: string;
  supportPhone?: string;
}

interface VendorStoryCapability {
  vendorId: string;
  vendorName: string;
  active: boolean;
  storiesEnabled: boolean;
  storyRolloutPercent: number;
  createdAt: Date;
}

interface VendorStoryAnalytics {
  vendorId: string;
  vendorName: string;
  active: boolean;
  storiesEnabled: boolean;
  storyRolloutPercent: number;
  activeStories: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
  freshness: number;
  rankScore: number;
  windowDays: number;
}

interface UiFunnelAnalytics {
  surface: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
  uniqueSessions: number;
  windowDays: number;
}

interface UiFunnelTrendPoint {
  date: string;
  surface: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
}

const SETTINGS_CACHE_KEY = 'platform:settings';
const STATS_CACHE_KEY = 'platform:stats';
const AR_SESSIONS_KEY = 'ar:active_sessions';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function toInt(value: unknown): number {
  if (typeof value === 'number') {
    return Math.trunc(value);
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  async onModuleInit() {
    // Load settings from database on startup
    await this.loadSettingsFromDatabase();
  }

  /**
   * Load platform settings from database
   */
  private async loadSettingsFromDatabase(): Promise<void> {
    try {
      const settings = await this.prisma.platformSettings.findFirst({
        where: { isActive: true },
      });

      if (settings) {
        await this.cacheManager.set(SETTINGS_CACHE_KEY, settings.config, 3600000); // 1 hour
        this.logger.log('Platform settings loaded from database');
      }
    } catch (_error) {
      this.logger.warn('Could not load platform settings from database, using defaults');
    }
  }

  /**
   * Get platform-wide statistics
   */
  async getPlatformStats(): Promise<PlatformStats> {
    try {
      // Try to get from cache first
      const cachedStats = await this.cacheManager.get<PlatformStats>(STATS_CACHE_KEY);
      if (cachedStats) {
        return cachedStats;
      }

      const [totalUsers, totalVendors, totalProducts, pendingOrders, activeExecutors] =
        await Promise.all([
          this.prisma.user.count(),
          this.prisma.vendor.count(),
          this.prisma.product.count(),
          this.prisma.order.count({ where: { status: 'PENDING' } }),
          this.prisma.executor.count({ where: { isActive: true } }),
        ]);

      // Get today's signups
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todaySignups = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      });

      // Calculate total revenue from orders
      const revenueData = await this.prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
        where: {
          status: 'DELIVERED',
          paymentStatus: 'COMPLETED',
        },
      });
      const totalRevenueRaw = revenueData._sum.totalAmount;
      const totalRevenue = totalRevenueRaw ? totalRevenueRaw.toNumber() : 0;

      // Get active AR sessions from Redis cache
      let activeArSessions = 0;
      try {
        const arSessionsCount = await this.cacheManager.get<number>(AR_SESSIONS_KEY);
        activeArSessions = arSessionsCount || 0;
      } catch {
        this.logger.debug('Could not fetch AR sessions count from cache');
      }

      const stats: PlatformStats = {
        totalUsers,
        totalVendors,
        totalProducts,
        totalRevenue,
        activeArSessions,
        todaySignups,
        pendingOrders,
        activeExecutors,
      };

      // Cache stats for 5 minutes
      await this.cacheManager.set(STATS_CACHE_KEY, stats, 300000);

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch platform stats', error);
      throw error;
    }
  }

  /**
   * Update platform settings
   */
  async updateSettings(settings: PlatformSettings): Promise<PlatformSettings> {
    try {
      // Get current settings
      const currentSettings = await this.getSettings();

      // Merge with new settings
      const updatedSettings = {
        ...currentSettings,
        ...settings,
      };

      // Persist to database
      await this.prisma.platformSettings.upsert({
        where: { id: 'default' },
        update: {
          config: updatedSettings as any,
          updatedAt: new Date(),
        },
        create: {
          id: 'default',
          config: updatedSettings as any,
          isActive: true,
        },
      });

      // Update cache
      await this.cacheManager.set(SETTINGS_CACHE_KEY, updatedSettings, 3600000);

      this.logger.log('Platform settings updated', { settings: updatedSettings });

      return updatedSettings;
    } catch (error) {
      this.logger.error('Failed to update platform settings', error);
      throw error;
    }
  }

  /**
   * Get current platform settings
   */
  async getSettings(): Promise<PlatformSettings> {
    // Try cache first
    const cachedSettings = await this.cacheManager.get<PlatformSettings>(SETTINGS_CACHE_KEY);
    if (cachedSettings) {
      return cachedSettings;
    }

    // Load from database
    try {
      const dbSettings = await this.prisma.platformSettings.findFirst({
        where: { isActive: true },
      });

      if (dbSettings) {
        const settings = dbSettings.config as PlatformSettings;
        await this.cacheManager.set(SETTINGS_CACHE_KEY, settings, 3600000);
        return settings;
      }
    } catch {
      this.logger.debug('Could not load settings from database');
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
      supportPhone: '021-12345678',
    };
  }

  /**
   * Ban a user
   */
  async banUser(userId: string, reason: string, adminId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.$transaction([
      // Update user status
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          bannedAt: new Date(),
          banReason: reason,
        },
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
          userAgent: '',
        },
      }),
    ]);

    this.logger.log(`User ${userId} banned by admin ${adminId}. Reason: ${reason}`);
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: string, adminId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: true,
          bannedAt: null,
          banReason: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'USER_UNBANNED',
          entityType: 'User',
          entityId: userId,
          performedBy: adminId,
          details: {},
          ipAddress: '',
          userAgent: '',
        },
      }),
    ]);

    this.logger.log(`User ${userId} unbanned by admin ${adminId}`);
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { mobile: { contains: search } },
          ],
        }
      : {};

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
            select: { orders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get pending vendor applications
   */
  async getPendingVendors(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where: { status: 'pending' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              mobile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vendor.count({ where: { status: 'pending' } }),
    ]);

    return {
      vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVendorStoryCapabilities(): Promise<VendorStoryCapability[]> {
    const vendors = await this.prisma.vendor.findMany({
      select: {
        id: true,
        name: true,
        is_active: true,
        stories_enabled: true,
        story_rollout_percent: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return vendors.map((vendor) => ({
      vendorId: vendor.id,
      vendorName: vendor.name,
      active: vendor.is_active,
      storiesEnabled: vendor.stories_enabled,
      storyRolloutPercent: vendor.story_rollout_percent,
      createdAt: vendor.created_at,
    }));
  }

  async setVendorStoryCapability(
    vendorId: string,
    storiesEnabled: boolean,
    storyRolloutPercent?: number
  ): Promise<{ vendorId: string; storiesEnabled: boolean; storyRolloutPercent: number }> {
    const safeRollout =
      typeof storyRolloutPercent === 'number'
        ? Math.max(0, Math.min(100, Math.round(storyRolloutPercent)))
        : undefined;

    const vendor = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        stories_enabled: storiesEnabled,
        ...(safeRollout === undefined ? {} : { story_rollout_percent: safeRollout }),
      },
      select: { id: true, stories_enabled: true, story_rollout_percent: true },
    });

    return {
      vendorId: vendor.id,
      storiesEnabled: vendor.stories_enabled,
      storyRolloutPercent: vendor.story_rollout_percent,
    };
  }

  async getVendorStoryAnalytics(windowDays = 14): Promise<VendorStoryAnalytics[]> {
    const safeWindowDays = clamp(Math.round(windowDays || 14), 1, 90);
    const now = new Date();
    const since = new Date(now.getTime() - safeWindowDays * 24 * 60 * 60 * 1000);

    const [vendors, eventRows] = await Promise.all([
      this.prisma.vendor.findMany({
        select: {
          id: true,
          name: true,
          is_active: true,
          stories_enabled: true,
          story_rollout_percent: true,
          stories: {
            where: {
              is_active: true,
              expires_at: { gt: now },
            },
            select: {
              id: true,
              created_at: true,
              expires_at: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.vendorStoryEvent.groupBy({
        by: ['vendor_id', 'event_type'],
        where: {
          created_at: { gte: since },
          event_type: { in: ['impression', 'click', 'conversion'] },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const counts = new Map<string, { impression: number; click: number; conversion: number }>();
    for (const row of eventRows) {
      const bucket = counts.get(row.vendor_id) ?? { impression: 0, click: 0, conversion: 0 };
      if (row.event_type === 'impression') {
        bucket.impression = row._count._all;
      } else if (row.event_type === 'click') {
        bucket.click = row._count._all;
      } else if (row.event_type === 'conversion') {
        bucket.conversion = row._count._all;
      }
      counts.set(row.vendor_id, bucket);
    }

    const analytics = vendors.map((vendor) => {
      const vendorCounts = counts.get(vendor.id) ?? { impression: 0, click: 0, conversion: 0 };
      const ctr = vendorCounts.impression > 0 ? vendorCounts.click / vendorCounts.impression : 0;
      const cvr = vendorCounts.click > 0 ? vendorCounts.conversion / vendorCounts.click : 0;

      let freshness = 0;
      if (vendor.stories.length > 0) {
        const totalFreshness = vendor.stories.reduce((sum, story) => {
          const created = story.created_at.getTime();
          const expires = story.expires_at.getTime();
          const duration = Math.max(1, expires - created);
          const remaining = Math.max(0, expires - now.getTime());
          return sum + clamp(remaining / duration, 0, 1);
        }, 0);
        freshness = totalFreshness / vendor.stories.length;
      }

      const rankScore = freshness * (1 + ctr * 2.2 + cvr * 4.5);

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        active: vendor.is_active,
        storiesEnabled: vendor.stories_enabled,
        storyRolloutPercent: vendor.story_rollout_percent,
        activeStories: vendor.stories.length,
        impressions: vendorCounts.impression,
        clicks: vendorCounts.click,
        conversions: vendorCounts.conversion,
        ctr: round(ctr),
        cvr: round(cvr),
        freshness: round(freshness),
        rankScore: round(rankScore),
        windowDays: safeWindowDays,
      };
    });

    return analytics.sort((a, b) => b.rankScore - a.rankScore);
  }

  async getUiFunnelAnalytics(windowDays = 14): Promise<UiFunnelAnalytics[]> {
    const safeWindowDays = clamp(Math.round(windowDays || 14), 1, 90);
    const since = new Date(Date.now() - safeWindowDays * 24 * 60 * 60 * 1000);
    const sinceDate = since.toISOString().slice(0, 10);

    const fallbackSurfaces = ['home_rail', 'category_grid', 'product_detail', 'product_related'];

    type RawFunnelRow = {
      surface: string | null;
      impressions: number | string | bigint | null;
      clicks: number | string | bigint | null;
      conversions: number | string | bigint | null;
      unique_sessions: number | string | bigint | null;
    };

    try {
      const rows = await this.prisma.$queryRawUnsafe<RawFunnelRow[]>(
        `
          WITH counts AS (
            SELECT
              surface,
              SUM(event_count) FILTER (WHERE event_type = 'ui:commerce_impression') AS impressions,
              SUM(event_count) FILTER (WHERE event_type = 'ui:commerce_click') AS clicks,
              SUM(event_count) FILTER (WHERE event_type = 'ui:commerce_conversion') AS conversions
            FROM ui_funnel_event_rollups
            WHERE bucket_date >= $1::date
            GROUP BY surface
          ),
          sessions AS (
            SELECT
              surface,
              COUNT(*) AS unique_sessions
            FROM ui_funnel_surface_sessions
            WHERE bucket_date >= $1::date
            GROUP BY surface
          )
          SELECT
            COALESCE(c.surface, s.surface, 'unknown') AS surface,
            COALESCE(c.impressions, 0) AS impressions,
            COALESCE(c.clicks, 0) AS clicks,
            COALESCE(c.conversions, 0) AS conversions,
            COALESCE(s.unique_sessions, 0) AS unique_sessions
          FROM counts c
          FULL OUTER JOIN sessions s ON s.surface = c.surface
          ORDER BY conversions DESC, clicks DESC, impressions DESC
        `,
        sinceDate
      );

      const map = new Map<string, UiFunnelAnalytics>();
      for (const row of rows) {
        const surface = (row.surface || 'unknown').slice(0, 64);
        const impressions = toInt(row.impressions);
        const clicks = toInt(row.clicks);
        const conversions = toInt(row.conversions);
        const uniqueSessions = toInt(row.unique_sessions);
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const cvr = clicks > 0 ? conversions / clicks : 0;

        map.set(surface, {
          surface,
          impressions,
          clicks,
          conversions,
          ctr: round(ctr),
          cvr: round(cvr),
          uniqueSessions,
          windowDays: safeWindowDays,
        });
      }

      for (const surface of fallbackSurfaces) {
        if (!map.has(surface)) {
          map.set(surface, {
            surface,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            ctr: 0,
            cvr: 0,
            uniqueSessions: 0,
            windowDays: safeWindowDays,
          });
        }
      }

      return Array.from(map.values()).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(`UI funnel rollup query failed, falling back to raw events: ${message}`);
      try {
        const rows = await this.prisma.$queryRawUnsafe<RawFunnelRow[]>(
          `
            SELECT
              COALESCE(data->>'surface', 'unknown') AS surface,
              COUNT(*) FILTER (WHERE event_type = 'ui:commerce_impression') AS impressions,
              COUNT(*) FILTER (WHERE event_type = 'ui:commerce_click') AS clicks,
              COUNT(*) FILTER (WHERE event_type = 'ui:commerce_conversion') AS conversions,
              COUNT(DISTINCT COALESCE(data->>'sessionId', '')) AS unique_sessions
            FROM system_events
            WHERE occurred_at >= $1::timestamptz
              AND event_type IN ('ui:commerce_impression', 'ui:commerce_click', 'ui:commerce_conversion')
            GROUP BY COALESCE(data->>'surface', 'unknown')
            ORDER BY conversions DESC, clicks DESC, impressions DESC
          `,
          since.toISOString()
        );

        const map = new Map<string, UiFunnelAnalytics>();
        for (const row of rows) {
          const surface = (row.surface || 'unknown').slice(0, 64);
          const impressions = toInt(row.impressions);
          const clicks = toInt(row.clicks);
          const conversions = toInt(row.conversions);
          const uniqueSessions = toInt(row.unique_sessions);
          const ctr = impressions > 0 ? clicks / impressions : 0;
          const cvr = clicks > 0 ? conversions / clicks : 0;

          map.set(surface, {
            surface,
            impressions,
            clicks,
            conversions,
            ctr: round(ctr),
            cvr: round(cvr),
            uniqueSessions,
            windowDays: safeWindowDays,
          });
        }

        for (const surface of fallbackSurfaces) {
          if (!map.has(surface)) {
            map.set(surface, {
              surface,
              impressions: 0,
              clicks: 0,
              conversions: 0,
              ctr: 0,
              cvr: 0,
              uniqueSessions: 0,
              windowDays: safeWindowDays,
            });
          }
        }

        return Array.from(map.values()).sort(
          (a, b) => b.conversions - a.conversions || b.clicks - a.clicks
        );
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : 'unknown_error';
        this.logger.warn(`UI funnel raw fallback query failed: ${fallbackMessage}`);
        return fallbackSurfaces.map((surface) => ({
          surface,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          cvr: 0,
          uniqueSessions: 0,
          windowDays: safeWindowDays,
        }));
      }
    }
  }

  async getUiFunnelTrend(windowDays = 7): Promise<UiFunnelTrendPoint[]> {
    const safeWindowDays = clamp(Math.round(windowDays || 7), 3, 90);
    const sinceDate = new Date(Date.now() - safeWindowDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    type RawTrendRow = {
      date: Date | string;
      surface: string;
      impressions: number | string | bigint | null;
      clicks: number | string | bigint | null;
      conversions: number | string | bigint | null;
    };

    try {
      const rows = await this.prisma.$queryRawUnsafe<RawTrendRow[]>(
        `
          SELECT
            bucket_date AS date,
            surface,
            SUM(event_count) FILTER (WHERE event_type = 'ui:commerce_impression') AS impressions,
            SUM(event_count) FILTER (WHERE event_type = 'ui:commerce_click') AS clicks,
            SUM(event_count) FILTER (WHERE event_type = 'ui:commerce_conversion') AS conversions
          FROM ui_funnel_event_rollups
          WHERE bucket_date >= $1::date
          GROUP BY bucket_date, surface
          ORDER BY bucket_date DESC, surface ASC
        `,
        sinceDate
      );

      return rows.map((row) => {
        const impressions = toInt(row.impressions);
        const clicks = toInt(row.clicks);
        const conversions = toInt(row.conversions);
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const cvr = clicks > 0 ? conversions / clicks : 0;

        const dateValue =
          row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);

        return {
          date: dateValue,
          surface: row.surface,
          impressions,
          clicks,
          conversions,
          ctr: round(ctr),
          cvr: round(cvr),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(`UI funnel trend query failed: ${message}`);
      return [];
    }
  }

  /**
   * Approve vendor application
   */
  async approveVendor(vendorId: string, adminId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'active',
          verifiedAt: new Date(),
        },
      }),
      // Update user role to SELLER
      this.prisma.user.update({
        where: { id: vendor.userId },
        data: { role: 'SELLER' },
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
          userAgent: '',
        },
      }),
    ]);

    this.logger.log(`Vendor ${vendorId} (${vendor.businessName}) approved by admin ${adminId}`);
  }

  /**
   * Reject vendor application
   */
  async rejectVendor(vendorId: string, reason: string, adminId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          rejectedAt: new Date(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'VENDOR_REJECTED',
          entityType: 'Vendor',
          entityId: vendorId,
          performedBy: adminId,
          details: { reason, businessName: vendor.businessName },
          ipAddress: '',
          userAgent: '',
        },
      }),
    ]);

    this.logger.log(`Vendor ${vendorId} rejected by admin ${adminId}. Reason: ${reason}`);
  }

  /**
   * Get dashboard summary for admin
   */
  async getDashboardSummary() {
    const stats = await this.getPlatformStats();

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
          select: { firstName: true, lastName: true },
        },
      },
    });

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
        createdAt: true,
      },
    });

    // Get revenue by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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
    `;

    return {
      stats,
      recentOrders,
      recentUsers,
      revenueByDay,
    };
  }
}

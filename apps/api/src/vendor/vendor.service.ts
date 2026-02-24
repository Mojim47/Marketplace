import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CreateVendorDto, PaginationDto, UpdateVendorDto } from '../common/dto/index';
import type { PrismaService } from '../database/prisma.service';

export interface VendorWithProducts {
  id: string;
  businessName: string;
  description?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  products?: Array<{
    id: string;
    name: string;
    price: any;
    stock: number;
    category: any;
  }>;
}

export interface VendorStoryRecord {
  id: string;
  vendor_id: string;
  title: string;
  media_url: string;
  caption?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  is_active: boolean;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVendorStoryDto {
  title: string;
  mediaUrl: string;
  caption?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  expiresAt?: string;
}

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new vendor profile for a user
   * One user can only have one vendor profile (One-to-One relation)
   */
  async create(
    userId: string,
    tenantId: string,
    dto: CreateVendorDto
  ): Promise<VendorWithProducts> {
    this.logger.log(`Creating vendor profile for user: ${userId}`);

    // Check if user already has a vendor profile
    const existingVendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });

    if (existingVendor) {
      throw new ConflictException('User already has a vendor profile');
    }

    // Create vendor profile
    const vendor = await this.prisma.vendor.create({
      data: {
        tenantId,
        businessName: dto.businessName,
        businessSlug: dto.businessName.toLowerCase().replace(/\s+/g, '-'),
        businessType: 'retail',
        email: '',
        phone: '',
        province: '',
        city: '',
        postalCode: '',
        address: '',
        userId,
      },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            category: true,
          },
        },
      },
    });

    this.logger.log(`Vendor profile created: ${vendor.id}`);
    return vendor;
  }

  /**
   * Get all vendors (Admin only)
   * Supports pagination
   */
  async findAll(pagination: PaginationDto): Promise<{
    vendors: VendorWithProducts[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { skip = 0, take = 10 } = pagination;

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        skip,
        take,
        include: {
          products: {
            select: {
              id: true,
              name: true,
              price: true,
              stock: true,
              category: true,
            },
            take: 5, // Limit products per vendor in list view
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendor.count(),
    ]);

    return {
      vendors,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
    };
  }

  /**
   * Get vendor profile by ID (Public - for storefront)
   * Includes all products
   */
  async findOne(id: string): Promise<VendorWithProducts> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            category: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    return vendor;
  }

  /**
   * Get vendor profile by user ID
   */
  async findByUserId(userId: string): Promise<VendorWithProducts | null> {
    return this.prisma.vendor.findUnique({
      where: { userId },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            category: true,
          },
        },
      },
    });
  }

  /**
   * Update vendor profile
   * Only the owner can update
   */
  async update(id: string, userId: string, dto: UpdateVendorDto): Promise<VendorWithProducts> {
    // Check if vendor exists and belongs to user
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    if (vendor.userId !== userId) {
      throw new ForbiddenException('You can only update your own vendor profile');
    }

    // Update vendor
    const updatedVendor = await this.prisma.vendor.update({
      where: { id },
      data: {
        businessName: dto.businessName,
      },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            category: true,
          },
        },
      },
    });

    this.logger.log(`Vendor profile updated: ${id}`);
    return updatedVendor;
  }

  /**
   * Deactivate vendor profile (Soft delete)
   */
  async deactivate(id: string, userId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    if (vendor.userId !== userId) {
      throw new ForbiddenException('You can only deactivate your own vendor profile');
    }

    await this.prisma.vendor.update({
      where: { id },
      data: { status: 'inactive' },
    });

    this.logger.log(`Vendor profile deactivated: ${id}`);
  }

  /**
   * Generate or update vendor slug
   * Creates URL-friendly slug from business name or uses provided slug
   */
  async generateSlug(id: string, customSlug?: string): Promise<string> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    // Generate slug from business name or use custom slug
    const baseSlug =
      customSlug ||
      vendor.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // Ensure uniqueness by checking existing slugs
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.vendor.findUnique({
        where: { businessSlug: slug },
      });

      if (!existing || existing.id === id) {
        break; // Slug is unique or belongs to current vendor
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Update vendor with new slug
    await this.prisma.vendor.update({
      where: { id },
      data: { businessSlug: slug },
    });

    this.logger.log(`Slug generated for vendor ${id}: ${slug}`);
    return slug;
  }

  /**
   * Find vendor by slug (for public storefronts)
   */
  async findBySlug(slug: string): Promise<VendorWithProducts> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { businessSlug: slug },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            category: true,
          },

          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with slug "${slug}" not found`);
    }

    this.logger.log(`Fetched vendor by slug: ${slug}`);
    return vendor;
  }

  async getStoryCapability(
    vendorId: string
  ): Promise<{ vendorId: string; storiesEnabled: boolean; storyRolloutPercent: number }> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, stories_enabled: true, story_rollout_percent: true },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    return {
      vendorId: vendor.id,
      storiesEnabled: vendor.stories_enabled,
      storyRolloutPercent: vendor.story_rollout_percent,
    };
  }

  async setStoryCapability(
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

  async listStories(vendorId: string, includeExpired = false): Promise<VendorStoryRecord[]> {
    const now = new Date();
    return this.prisma.vendorStory.findMany({
      where: {
        vendor_id: vendorId,
        is_active: true,
        ...(includeExpired ? {} : { expires_at: { gt: now } }),
      },
      orderBy: [{ created_at: 'desc' }],
    });
  }

  async createStory(vendorId: string, dto: CreateVendorStoryDto): Promise<VendorStoryRecord> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, stories_enabled: true },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    if (!vendor.stories_enabled) {
      throw new ForbiddenException('Stories are disabled for this vendor by admin policy');
    }

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt must be a valid ISO date string');
    }

    return this.prisma.vendorStory.create({
      data: {
        vendor_id: vendorId,
        title: dto.title.trim(),
        media_url: dto.mediaUrl.trim(),
        caption: dto.caption?.trim() || null,
        cta_label: dto.ctaLabel?.trim() || null,
        cta_url: dto.ctaUrl?.trim() || null,
        expires_at: expiresAt,
      },
    });
  }

  async deleteStory(vendorId: string, storyId: string): Promise<void> {
    const story = await this.prisma.vendorStory.findFirst({
      where: { id: storyId, vendor_id: vendorId },
      select: { id: true },
    });

    if (!story) {
      throw new NotFoundException(`Story with ID ${storyId} not found for vendor ${vendorId}`);
    }

    await this.prisma.vendorStory.update({
      where: { id: storyId },
      data: { is_active: false },
    });
  }
}

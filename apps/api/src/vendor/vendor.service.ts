import {
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
}

import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Patch, 
  Delete,
  Query,
  Logger,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { VendorService, VendorWithProducts } from './vendor.service';
import { CreateVendorDto, UpdateVendorDto, PaginationDto } from '../common/dto/index';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('v1/vendors')
export class VendorController {
  private readonly logger = new Logger(VendorController.name);

  constructor(private readonly vendorService: VendorService) {}

  /**
   * Create vendor profile
   * POST /v1/vendors
   * Requires: Authentication
   * One user can only create one vendor profile
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateVendorDto,
    @Request() req: any
  ): Promise<VendorWithProducts> {
    const userId = req.user.sub;
    const tenantId = req.user.tenantId;
    this.logger.log(`Creating vendor profile for user: ${userId}`);
    return this.vendorService.create(userId, tenantId, dto);
  }

  /**
   * Get all vendors (Admin only)
   * GET /v1/vendors
   * Requires: Authentication + ADMIN role
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'admin')
  async findAll(@Query() pagination: PaginationDto): Promise<{
    vendors: VendorWithProducts[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.logger.log('Admin fetching all vendors');
    return this.vendorService.findAll(pagination);
  }

  /**
   * Get vendor profile by ID (Public - for storefront)
   * GET /v1/vendors/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<VendorWithProducts> {
    this.logger.log(`Fetching vendor profile: ${id}`);
    return this.vendorService.findOne(id);
  }

  /**
   * Get current user's vendor profile
   * GET /v1/vendors/me/profile
   * Requires: Authentication
   */
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req: any): Promise<VendorWithProducts | null> {
    const userId = req.user.sub;
    this.logger.log(`Fetching vendor profile for user: ${userId}`);
    return this.vendorService.findByUserId(userId);
  }

  /**
   * Update vendor profile
   * PATCH /v1/vendors/:id
   * Requires: Authentication (owner only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @Request() req: any
  ): Promise<VendorWithProducts> {
    const userId = req.user.sub;
    this.logger.log(`Updating vendor profile: ${id}`);
    return this.vendorService.update(id, userId, dto);
  }

  /**
   * Deactivate vendor profile
   * DELETE /v1/vendors/:id
   * Requires: Authentication (owner only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @Param('id') id: string,
    @Request() req: any
  ): Promise<void> {
    const userId = req.user.sub;
    this.logger.log(`Deactivating vendor profile: ${id}`);
    await this.vendorService.deactivate(id, userId);
  }

  /**
   * Generate or update vendor slug
   * POST /v1/vendors/:id/slug
   * Requires: Authentication + ADMIN role
   */
  @Post(':id/slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async generateSlug(
    @Param('id') id: string,
    @Body() data: { slug?: string }
  ): Promise<{ message: string; slug: string }> {
    this.logger.log(`Generating slug for vendor: ${id}`);
    const slug = await this.vendorService.generateSlug(id, data.slug);
    return {
      message: 'Slug generated successfully',
      slug
    };
  }

  /**
   * Get vendor by slug (public)
   * GET /v1/vendors/slug/:slug
   */
  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string
  ): Promise<VendorWithProducts> {
    this.logger.log(`Fetching vendor by slug: ${slug}`);
    return this.vendorService.findBySlug(slug);
  }
}

import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductService, SellerOfferService } from '@nextgen/product';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProductOwnershipGuard } from '../common/guards/product-ownership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductSearchDto,
  CreateVariantDto,
} from './dto';

@ApiTags('marketplace/products')
@Controller('marketplace/products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly sellerOfferService: SellerOfferService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'جستجو و ليست محصولات' })
  @ApiResponse({ status: 200, description: 'ليست محصولات' })
  async search(@Query() query: ProductSearchDto) {
    return this.productService.search({
      query: query.query,
      categoryId: query.categoryId,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock,
      sortBy: query.sortBy as any,
      sortOrder: query.sortOrder,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('search/persian')
  @ApiOperation({ summary: 'جستجوي فارسي با pg_trgm' })
  @ApiQuery({ name: 'q', description: 'عبارت جستجو' })
  async searchPersian(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.productService.searchPersian(query, limit);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'دريافت محصول با اسلاگ' })
  @ApiParam({ name: 'slug', description: 'اسلاگ محصول' })
  @ApiResponse({ status: 200, description: 'جزئيات محصول' })
  @ApiResponse({ status: 404, description: 'محصول يافت نشد' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'دريافت محصول با شناسه' })
  @ApiParam({ name: 'id', description: 'شناسه محصول' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.findById(id);
  }

  @Get(':id/offers')
  @ApiOperation({ summary: 'دريافت پيشنهادات فروشندگان براي محصول' })
  @ApiParam({ name: 'id', description: 'شناسه محصول' })
  async getOffers(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellerOfferService.getOffersForProduct(id);
  }

  @Get(':id/buy-box')
  @ApiOperation({ summary: 'دريافت برنده Buy Box' })
  @ApiParam({ name: 'id', description: 'شناسه محصول' })
  async getBuyBoxWinner(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellerOfferService.getBuyBoxWinner(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ايجاد محصول جديد' })
  @ApiResponse({ status: 201, description: 'محصول ايجاد شد' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ) {
    return this.productService.create({
      ...dto,
      vendorId: user.vendorId,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, ProductOwnershipGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ويرايش محصول' })
  @ApiParam({ name: 'id', description: 'شناسه محصول' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, ProductOwnershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف محصول' })
  @ApiParam({ name: 'id', description: 'شناسه محصول' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.productService.delete(id);
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // Seller Offer endpoints
  // ?????????????????????????????????????????????????????????????????????????????

  @Post(':productId/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ايجاد پيشنهاد فروشنده' })
  async createOffer(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { variantId: string; price: number; quantity: number },
  ) {
    return this.sellerOfferService.createOffer({
      productId,
      variantId: dto.variantId,
      sellerId: user.vendorId,
      price: dto.price,
      quantity: dto.quantity,
    });
  }

  @Put('offers/:offerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ويرايش پيشنهاد فروشنده' })
  async updateOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { price?: number; quantity?: number; isActive?: boolean },
  ) {
    return this.sellerOfferService.updateOffer(offerId, dto);
  }
}


import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, Inject, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductSearchService, ProductSearchOptions } from './product-search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateProductDto, UpdateProductDto, SearchProductsDto } from './dto';
import { StorageService, UploadFile } from '@nextgen/storage';
import { STORAGE_TOKENS } from '../shared/storage/tokens';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@ApiTags('products')
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(
    private readonly service: ProductsService,
    private readonly searchService: ProductSearchService,
    @Inject(STORAGE_TOKENS.STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'ليست محصولات' })
  findAll(@Query() filters: any) {
    return this.service.findAll(filters);
  }

  /**
   * جستجوي محصولات با پشتيباني فارسي
   * Requirements: 8.1, 8.2, 8.3
   */
  @Get('search')
  @ApiOperation({ summary: 'جستجوي محصولات با پشتيباني فارسي' })
  @ApiQuery({ name: 'query', required: true, description: 'عبارت جستجو' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'فيلتر دسته‌بندي' })
  @ApiQuery({ name: 'vendorId', required: false, description: 'فيلتر فروشنده' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'حداقل قيمت' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'حداکثر قيمت' })
  @ApiQuery({ name: 'inStockOnly', required: false, description: 'فقط موجود' })
  @ApiQuery({ name: 'limit', required: false, description: 'تعداد نتايج' })
  @ApiQuery({ name: 'offset', required: false, description: 'شروع از' })
  @ApiResponse({ status: 200, description: 'نتايج جستجو' })
  async searchProducts(@Query() dto: SearchProductsDto) {
    const options: ProductSearchOptions = {
      query: dto.query,
      filters: {
        categoryId: dto.categoryId,
        vendorId: dto.vendorId,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        inStockOnly: dto.inStockOnly,
      },
      limit: dto.limit,
      offset: dto.offset,
    };

    return this.searchService.search(options);
  }

  /**
   * پيشنهاد جستجو (autocomplete)
   * Requirements: 8.2
   */
  @Get('search/suggestions')
  @ApiOperation({ summary: 'پيشنهاد جستجو (autocomplete)' })
  @ApiQuery({ name: 'prefix', required: true, description: 'پيشوند جستجو' })
  @ApiQuery({ name: 'limit', required: false, description: 'تعداد پيشنهادات' })
  @ApiResponse({ status: 200, description: 'پيشنهادات جستجو' })
  async getSearchSuggestions(
    @Query('prefix') prefix: string,
    @Query('limit') limit?: number,
  ) {
    const suggestions = await this.searchService.getSuggestions(prefix, limit || 10);
    return { suggestions, prefix };
  }

  /**
   * جستجوي fuzzy
   * Requirements: 8.2
   */
  @Get('search/fuzzy')
  @ApiOperation({ summary: 'جستجوي fuzzy با تحمل غلط املايي' })
  @ApiQuery({ name: 'query', required: true, description: 'عبارت جستجو' })
  @ApiQuery({ name: 'threshold', required: false, description: 'آستانه شباهت (0-1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'تعداد نتايج' })
  @ApiResponse({ status: 200, description: 'نتايج مشابه' })
  async fuzzySearch(
    @Query('query') query: string,
    @Query('threshold') threshold?: number,
    @Query('limit') limit?: number,
  ) {
    const results = await this.searchService.fuzzySearch(
      query,
      threshold || 0.6,
      limit || 10,
    );
    return { results, query, threshold: threshold || 0.6 };
  }

  /**
   * ايندکس مجدد همه محصولات
   * Requirements: 8.1
   */
  @Post('search/reindex')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ايندکس مجدد همه محصولات (فقط ادمين)' })
  @ApiResponse({ status: 200, description: 'نتيجه ايندکس' })
  async reindexProducts() {
    const result = await this.searchService.reindexAllProducts();
    return {
      success: true,
      message: 'ايندکس مجدد با موفقيت انجام شد',
      ...result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئيات محصول' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ايجاد محصول جديد' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() data: CreateProductDto) {
    return this.service.create(user.vendorId, data as any);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ويرايش محصول' })
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() data: UpdateProductDto) {
    return this.service.update(id, user.vendorId, data as unknown as Record<string, unknown>);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حذف محصول' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.delete(id, user.vendorId);
  }

  /**
   * آپلود تصوير محصول
   * Requirements: 6.1
   */
  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'آپلود تصوير محصول' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'تصوير با موفقيت آپلود شد' })
  @UseInterceptors(FileInterceptor('image'))
  async uploadProductImage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('تصويري انتخاب نشده است');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('نوع فايل مجاز نيست. فقط تصاوير JPEG، PNG، GIF و WebP مجاز هستند');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('حجم تصوير بيش از حد مجاز است. حداکثر 10MB');
    }

    // Verify product exists and belongs to vendor
    const product = await this.service.findOne(id);
    if (!product) {
      throw new BadRequestException('محصول يافت نشد');
    }

    const uploadFile: UploadFile = {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };

    const result = await this.storageService.upload(uploadFile, {
      path: `products/${id}`,
      acl: 'public-read',
    });

    // Update product with new image
    const currentImages = (product as any).images || [];
    await this.service.update(id, user.vendorId, {
      images: [...currentImages, result.url],
    });

    return {
      success: true,
      message: 'تصوير با موفقيت آپلود شد',
      image: {
        key: result.key,
        url: result.url,
        size: result.size,
      },
    };
  }

  /**
   * آپلود چند تصوير محصول
   * Requirements: 6.1
   */
  @Post(':id/images/multiple')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'آپلود چند تصوير محصول' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'تصاوير با موفقيت آپلود شدند' })
  @UseInterceptors(FilesInterceptor('images', 10)) // Max 10 images
  async uploadMultipleProductImages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('تصويري انتخاب نشده است');
    }

    // Verify product exists and belongs to vendor
    const product = await this.service.findOne(id);
    if (!product) {
      throw new BadRequestException('محصول يافت نشد');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024;
    const uploadedImages: { key: string; url: string; size: number }[] = [];

    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(`نوع فايل ${file.originalname} مجاز نيست`);
      }

      // Validate file size
      if (file.size > maxSize) {
        throw new BadRequestException(`حجم فايل ${file.originalname} بيش از حد مجاز است`);
      }

      const uploadFile: UploadFile = {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };

      const result = await this.storageService.upload(uploadFile, {
        path: `products/${id}`,
        acl: 'public-read',
      });

      uploadedImages.push({
        key: result.key,
        url: result.url,
        size: result.size,
      });
    }

    // Update product with new images
    const currentImages = (product as any).images || [];
    const newImageUrls = uploadedImages.map(img => img.url);
    await this.service.update(id, user.vendorId, {
      images: [...currentImages, ...newImageUrls],
    });

    return {
      success: true,
      message: 'تصاوير با موفقيت آپلود شدند',
      images: uploadedImages,
    };
  }

  /**
   * حذف تصوير محصول
   * Requirements: 6.4
   */
  @Delete(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حذف تصوير محصول' })
  @ApiResponse({ status: 200, description: 'تصوير با موفقيت حذف شد' })
  async deleteProductImage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { imageUrl: string },
  ) {
    if (!body.imageUrl) {
      throw new BadRequestException('آدرس تصوير الزامي است');
    }

    // Verify product exists and belongs to vendor
    const product = await this.service.findOne(id);
    if (!product) {
      throw new BadRequestException('محصول يافت نشد');
    }

    // Extract key from URL
    const urlParts = body.imageUrl.split('/');
    const key = urlParts.slice(-4).join('/'); // Get path like products/id/year/month/day/uuid.ext

    try {
      await this.storageService.delete(key);
    } catch (error) {
      // Continue even if file doesn't exist in storage
      console.warn(`Failed to delete file from storage: ${key}`);
    }

    // Update product to remove image URL
    const currentImages = (product as any).images || [];
    const updatedImages = currentImages.filter((img: string) => img !== body.imageUrl);
    await this.service.update(id, user.vendorId, {
      images: updatedImages,
    });

    return {
      success: true,
      message: 'تصوير با موفقيت حذف شد',
    };
  }
}


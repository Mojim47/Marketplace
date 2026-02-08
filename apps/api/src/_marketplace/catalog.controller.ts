import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { CatalogService } from '@nextgen/catalog';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  MoveCategoryDto,
} from './dto';

@ApiTags('marketplace/catalog')
@Controller('marketplace/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'دريافت درخت دسته‌بندي‌ها' })
  @ApiResponse({ status: 200, description: 'درخت دسته‌بندي‌ها' })
  async getCategoryTree() {
    return this.catalogService.getCategoryTree();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'دريافت دسته‌بندي با اسلاگ' })
  @ApiParam({ name: 'slug', description: 'اسلاگ دسته‌بندي' })
  @ApiResponse({ status: 200, description: 'جزئيات دسته‌بندي' })
  @ApiResponse({ status: 404, description: 'دسته‌بندي يافت نشد' })
  async getCategoryBySlug(@Param('slug') slug: string) {
    return this.catalogService.getCategoryBySlug(slug);
  }

  @Get('categories/id/:id')
  @ApiOperation({ summary: 'دريافت دسته‌بندي با شناسه' })
  @ApiParam({ name: 'id', description: 'شناسه دسته‌بندي' })
  async getCategoryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getCategory(id);
  }

  @Get('categories/:id/breadcrumb')
  @ApiOperation({ summary: 'دريافت مسير دسته‌بندي (Breadcrumb)' })
  @ApiParam({ name: 'id', description: 'شناسه دسته‌بندي' })
  async getBreadcrumb(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getAncestors(id);
  }

  @Get('categories/:id/descendants')
  @ApiOperation({ summary: 'دريافت زيردسته‌ها' })
  @ApiParam({ name: 'id', description: 'شناسه دسته‌بندي' })
  async getDescendants(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getDescendants(id);
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // Admin endpoints
  // ?????????????????????????????????????????????????????????????????????????????

  @Post('categories')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ايجاد دسته‌بندي جديد' })
  @ApiResponse({ status: 201, description: 'دسته‌بندي ايجاد شد' })
  async createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.catalogService.createCategory(dto);
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ويرايش دسته‌بندي' })
  @ApiParam({ name: 'id', description: 'شناسه دسته‌بندي' })
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(id, dto);
  }

  @Patch('categories/:id/move')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'جابجايي دسته‌بندي' })
  @ApiParam({ name: 'id', description: 'شناسه دسته‌بندي' })
  async moveCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MoveCategoryDto,
  ) {
    return this.catalogService.moveCategory(id, dto);
  }
}


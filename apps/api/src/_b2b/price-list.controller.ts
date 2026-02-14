import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { PriceListService } from './price-list.service';

@ApiTags('b2b')
@Controller('b2b/price-lists')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post()
  @ApiOperation({ summary: '����� ���� ����' })
  async create(@Body() dto: any) {
    return this.priceListService.createPriceList(dto);
  }

  @Get()
  @ApiOperation({ summary: '���� ������' })
  async list(@Query('organizationId') orgId?: string) {
    return this.priceListService.listPriceLists(orgId);
  }

  @Post('products')
  @ApiOperation({ summary: '������ ���� �����' })
  async addProduct(@Body() dto: any) {
    return this.priceListService.addProductPrice(dto);
  }

  @Get('products/:productId/price')
  @ApiOperation({ summary: '������ ���� �����' })
  async getPrice(
    @Param('productId') productId: string,
    @Query('organizationId') orgId: string,
    @Query('quantity') quantity?: number
  ) {
    return this.priceListService.getProductPrice(productId, orgId, quantity || 1);
  }
}

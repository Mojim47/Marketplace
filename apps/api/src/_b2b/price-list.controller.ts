import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { PriceListService } from './price-list.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('b2b')
@Controller('b2b/price-lists')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post()
  @ApiOperation({ summary: '«ÌÃ«œ ·Ì”  ﬁÌ„ ' })
  async create(@Body() dto: any) {
    return this.priceListService.createPriceList(dto)
  }

  @Get()
  @ApiOperation({ summary: '·Ì”  ﬁÌ„ Â«' })
  async list(@Query('organizationId') orgId?: string) {
    return this.priceListService.listPriceLists(orgId)
  }

  @Post('products')
  @ApiOperation({ summary: '«›“Êœ‰ ﬁÌ„  „Õ’Ê·' })
  async addProduct(@Body() dto: any) {
    return this.priceListService.addProductPrice(dto)
  }

  @Get('products/:productId/price')
  @ApiOperation({ summary: 'œ—Ì«›  ﬁÌ„  „Õ’Ê·' })
  async getPrice(
    @Param('productId') productId: string,
    @Query('organizationId') orgId: string,
    @Query('quantity') quantity?: number
  ) {
    return this.priceListService.getProductPrice(productId, orgId, quantity || 1)
  }
}

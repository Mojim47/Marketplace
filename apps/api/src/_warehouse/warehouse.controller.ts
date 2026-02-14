import type { WarehouseService } from '@libs/warehouse';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('warehouses')
@UseGuards(JwtAuthGuard)
export class WarehouseController {
  constructor(private warehouse: WarehouseService) {}

  @Get(':id/inventory')
  async getInventory(@Param('id') id: string, @Query('productId') productId?: string) {
    return this.warehouse.getInventory(id, productId);
  }

  @Patch(':id/inventory')
  async updateInventory(
    @Param('id') warehouseId: string,
    @Body() dto: { productId: string; quantity: number },
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.warehouse.updateInventory(warehouseId, dto.productId, dto.quantity, user.id);
    return { success: true };
  }

  @Post('transfer')
  async transfer(
    @Body() dto: {
      fromWarehouseId: string;
      toWarehouseId: string;
      productId: string;
      quantity: number;
      reason?: string;
    },
    @CurrentUser() user: AuthenticatedUser
  ) {
    const transferId = await this.warehouse.transfer({ ...dto, initiatedBy: user.id });
    return { transferId };
  }

  @Patch('transfer/:id/complete')
  async completeTransfer(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.warehouse.completeTransfer(id, user.id);
    return { success: true };
  }

  @Get('nearest')
  async findNearest(@Query() query: { productId: string; lat: number; lng: number }) {
    return this.warehouse.findNearestWarehouse(query.productId, query.lat, query.lng);
  }
}

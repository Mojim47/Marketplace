import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { InventoryService } from '@nextgen/inventory';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { BulkStockCheckDto, ReserveStockDto, UpdateStockDto, UpsertInventoryDto } from './dto';

@ApiTags('marketplace/inventory')
@Controller('marketplace/inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock/:variantId')
  @ApiOperation({ summary: 'دريافت موجودي واريانت' })
  @ApiParam({ name: 'variantId', description: 'شناسه واريانت' })
  async getStock(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('warehouseId') warehouseId?: string
  ) {
    return this.inventoryService.getStock(variantId, user.vendorId, warehouseId);
  }

  @Post('stock')
  @ApiOperation({ summary: 'ايجاد/بروزرساني موجودي' })
  @ApiResponse({ status: 201, description: 'موجودي ثبت شد' })
  async upsertStock(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertInventoryDto) {
    return this.inventoryService.upsertInventoryItem({
      ...dto,
      sellerId: user.vendorId,
    });
  }

  @Put('stock/:variantId')
  @ApiOperation({ summary: 'بروزرساني تعداد موجودي' })
  @ApiParam({ name: 'variantId', description: 'شناسه واريانت' })
  async updateStock(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStockDto
  ) {
    return this.inventoryService.updateStock(
      variantId,
      user.vendorId,
      dto.quantity,
      user.id,
      dto.reason
    );
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'ليست محصولات با موجودي کم' })
  async getLowStockItems(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.getLowStockItems(user.vendorId);
  }

  @Get('movements/:inventoryItemId')
  @ApiOperation({ summary: 'تاريخچه تغييرات موجودي' })
  @ApiParam({ name: 'inventoryItemId', description: 'شناسه آيتم موجودي' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMovementHistory(
    @Param('inventoryItemId', ParseUUIDPipe) inventoryItemId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number
  ) {
    return this.inventoryService.getMovementHistory(inventoryItemId, limit);
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // Reservation endpoints
  // ?????????????????????????????????????????????????????????????????????????????

  @Post('reserve')
  @ApiOperation({ summary: 'رزرو موجودي' })
  @ApiResponse({ status: 201, description: 'موجودي رزرو شد' })
  async reserveStock(@Body() dto: ReserveStockDto) {
    return this.inventoryService.reserveStock(dto);
  }

  @Delete('reserve/:reservationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'آزادسازي رزرو' })
  @ApiParam({ name: 'reservationId', description: 'شناسه رزرو' })
  async releaseReservation(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.inventoryService.releaseReservation(reservationId, user.id);
  }

  @Post('reserve/:reservationId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تاييد رزرو (کسر از موجودي)' })
  @ApiParam({ name: 'reservationId', description: 'شناسه رزرو' })
  async confirmReservation(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.inventoryService.confirmReservation(reservationId, user.id);
    return { success: true };
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // Bulk operations
  // ?????????????????????????????????????????????????????????????????????????????

  @Post('check-bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'بررسي موجودي چندين آيتم' })
  async checkBulkStock(@Body() dto: BulkStockCheckDto) {
    return this.inventoryService.checkBulkStock({ items: dto.items });
  }
}

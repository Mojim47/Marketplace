import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
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
import type { OrderService, SettlementService } from '@nextgen/order';
import type { ShippingService } from '@nextgen/shipping';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrderOwnershipGuard } from '../common/guards/order-ownership.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { CreateOrderDto, UpdateOrderStatusDto, UpdateSubOrderStatusDto } from './dto';

@ApiTags('marketplace/orders')
@Controller('marketplace/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly settlementService: SettlementService,
    private readonly shippingService: ShippingService
  ) {}

  @Post()
  @ApiOperation({ summary: 'ايجاد سفارش جديد (Multi-Seller)' })
  @ApiResponse({ status: 201, description: 'سفارش ايجاد شد' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orderService.createOrder({
      userId: user.id,
      items: dto.items.map((item) => ({
        ...item,
        productSku: item.productSku ?? '',
      })),
      projectId: dto.projectId,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress,
      shippingMethod: dto.shippingMethod,
      paymentMethod: dto.paymentMethod,
      customerNote: dto.customerNote,
    });
  }

  @Get()
  @ApiOperation({ summary: 'ليست سفارشات من' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.orderService.getUserOrders(user.id, limit, offset);
  }

  @Get(':id')
  @UseGuards(OrderOwnershipGuard)
  @ApiOperation({ summary: 'جزئيات سفارش' })
  @ApiParam({ name: 'id', description: 'شناسه سفارش' })
  @ApiResponse({ status: 200, description: 'جزئيات سفارش' })
  @ApiResponse({ status: 404, description: 'سفارش يافت نشد' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthenticatedUser) {
    const order = await this.orderService.getOrder(id);
    return order;
  }

  @Get('number/:orderNumber')
  @ApiOperation({ summary: 'دريافت سفارش با شماره پيگيري' })
  @ApiParam({ name: 'orderNumber', description: 'شماره سفارش' })
  async findByNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() _user: AuthenticatedUser
  ) {
    return this.orderService.getOrderByNumber(orderNumber);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'تغيير وضعيت سفارش' })
  @ApiParam({ name: 'id', description: 'شناسه سفارش' })
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateOrderStatus(id, {
      status: dto.status as any,
      adminNote: dto.adminNote,
    });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'لغو سفارش' })
  @ApiParam({ name: 'id', description: 'شناسه سفارش' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body('reason') reason?: string) {
    return this.orderService.cancelOrder(id, reason);
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // Sub-Order endpoints
  // ?????????????????????????????????????????????????????????????????????????????

  @Get('sub-orders/seller')
  @ApiOperation({ summary: 'ليست زيرسفارشات فروشنده' })
  async getSellerSubOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.orderService.getSellerSubOrders(user.vendorId, limit, offset);
  }

  @Patch('sub-orders/:id/status')
  @ApiOperation({ summary: 'تغيير وضعيت زيرسفارش' })
  @ApiParam({ name: 'id', description: 'شناسه زيرسفارش' })
  async updateSubOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubOrderStatusDto
  ) {
    return this.orderService.updateSubOrderStatus(id, {
      status: dto.status as any,
      trackingNumber: dto.trackingNumber,
      shippingMethod: dto.shippingMethod,
    });
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // Shipping calculation
  // ?????????????????????????????????????????????????????????????????????????????

  @Post('calculate-shipping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'محاسبه هزينه ارسال' })
  async calculateShipping(
    @Body() dto: {
      sellerId: string;
      destinationZone: string;
      items: Array<{ weight: number; length?: number; width?: number; height?: number }>;
      orderValue: number;
    }
  ) {
    return this.shippingService.calculateShippingRate({
      sellerId: dto.sellerId,
      destinationZone: dto.destinationZone,
      items: dto.items,
      orderValue: dto.orderValue,
    });
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // Settlement endpoints (for sellers)
  // ?????????????????????????????????????????????????????????????????????????????

  @Get('settlements/my')
  @ApiOperation({ summary: 'گزارش تسويه فروشنده' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getMySettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.settlementService.generateSettlementReport(
      user.vendorId,
      new Date(startDate),
      new Date(endDate)
    );
  }
}

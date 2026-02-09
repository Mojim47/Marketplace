import { Body, Controller, Get, Headers, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { CreateOrderDto } from './dto';
import type { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller({ path: 'orders', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'ايجاد سفارش جديد' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CreateOrderDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    return this.service.create(user.id, data, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'ليست سفارشات من' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() filters: any) {
    return this.service.findAll(user.id, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئيات سفارش' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'تغيير وضعيت سفارش' })
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.service.updateStatus(id, status);
  }
}

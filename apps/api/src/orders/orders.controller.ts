import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LaunchJwtAuthGuard } from '../common/guards/launch-jwt-auth.guard';
import type { CreateOrderDto } from './dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller({ path: 'orders', version: '1' })
@UseGuards(LaunchJwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'ايجاد سفارش جديد' })
  create(
    @Request() req: any,
    @Body() data: CreateOrderDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    return this.service.create(req.user.id, data, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'ليست سفارشات من' })
  findAll(@Request() req: any, @Query() filters: any) {
    return this.service.findAll(req.user.id, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئيات سفارش' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user.id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'تغيير وضعيت سفارش' })
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.service.updateStatus(id, status);
  }
}

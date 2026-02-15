import { Module } from '@nestjs/common';
import { DistributedLockService } from '@nextgen/cache';
import { DatabaseModule } from '../database/database.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersCqrsService } from './orders-cqrs.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersCqrsService, DistributedLockService],
  exports: [OrdersService, OrdersCqrsService],
})
export class OrdersModule {}

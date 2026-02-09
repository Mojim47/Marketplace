import { Module } from '@nestjs/common';
import { DistributedLockService } from '@nextgen/cache';
import { DatabaseModule } from '../database/database.module';
import { OrdersCqrsService } from './orders-cqrs.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersCqrsService, DistributedLockService],
  exports: [OrdersService, OrdersCqrsService],
})
export class OrdersModule {}

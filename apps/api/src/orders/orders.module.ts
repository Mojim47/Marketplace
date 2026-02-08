import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersCqrsService } from './orders-cqrs.service';
import { DatabaseModule } from '../database/database.module';
import { DistributedLockService } from '@nextgen/cache';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersCqrsService, DistributedLockService],
  exports: [OrdersService, OrdersCqrsService],
})
export class OrdersModule {}

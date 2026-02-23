import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LocalDistributedLockService } from './local-distributed-lock.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    LocalDistributedLockService,
    {
      provide: 'DISTRIBUTED_LOCK_SERVICE',
      useExisting: LocalDistributedLockService,
    },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}

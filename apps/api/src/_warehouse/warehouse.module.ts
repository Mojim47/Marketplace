import { WarehouseService } from '@libs/warehouse';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WarehouseController } from './warehouse.controller';

@Module({
  imports: [DatabaseModule],
  providers: [WarehouseService],
  controllers: [WarehouseController],
  exports: [WarehouseService],
})
export class WarehouseModule {}

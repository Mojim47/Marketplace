import { Module } from '@nestjs/common';
import { WarehouseService } from '@libs/warehouse';
import { WarehouseController } from './warehouse.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [WarehouseService],
  controllers: [WarehouseController],
  exports: [WarehouseService],
})
export class WarehouseModule {}

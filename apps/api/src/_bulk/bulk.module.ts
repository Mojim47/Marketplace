import { BulkService } from '@libs/bulk';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BulkController } from './bulk.controller';

@Module({
  imports: [DatabaseModule],
  providers: [BulkService],
  controllers: [BulkController],
  exports: [BulkService],
})
export class BulkModule {}

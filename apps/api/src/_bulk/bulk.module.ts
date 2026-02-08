import { Module } from '@nestjs/common';
import { BulkService } from '@libs/bulk';
import { BulkController } from './bulk.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [BulkService],
  controllers: [BulkController],
  exports: [BulkService],
})
export class BulkModule {}

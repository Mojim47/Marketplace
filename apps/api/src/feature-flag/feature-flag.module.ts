import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}

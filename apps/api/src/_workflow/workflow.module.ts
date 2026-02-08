import { Module } from '@nestjs/common';
import { WorkflowService } from '@libs/workflow';
import { WorkflowController } from './workflow.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}

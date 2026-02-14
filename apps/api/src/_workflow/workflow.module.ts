import { WorkflowService } from '@libs/workflow';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WorkflowController } from './workflow.controller';

@Module({
  imports: [DatabaseModule],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}

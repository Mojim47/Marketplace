import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  async process(_job: Job) {}
}

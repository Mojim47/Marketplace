// ═══════════════════════════════════════════════════════════════════════════
// Queue Service - BullMQ Integration
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();

  constructor(private readonly configService: ConfigService) {}

  async addJob(queueName: string, jobName: string, data: any, options?: any) {
    const queue = this.getQueue(queueName);
    return await queue.add(jobName, data, options);
  }

  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: {
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: this.configService.get('REDIS_PORT', 6379),
        },
      });
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName)!;
  }
}
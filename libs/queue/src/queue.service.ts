// ═══════════════════════════════════════════════════════════════════════════
// Queue Service - BullMQ Integration
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private events = new Map<string, QueueEvents>();

  constructor(private readonly configService: ConfigService) {}

  async addJob(queueName: string, jobName: string, data: any, options?: any) {
    const queue = this.getQueue(queueName);
    // default idempotency + retries
    const baseOptions = {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
      ...options,
    };
    return await queue.add(jobName, data, baseOptions);
  }

  /**
   * Register a worker with optional dead-letter queue routing.
   */
  registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    options?: {
      concurrency?: number;
      deadLetterQueue?: string;
    },
  ): Worker {
    const worker = new Worker(
      queueName,
      async (job) => {
        return processor(job);
      },
      {
        connection: {
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
        },
        concurrency: options?.concurrency ?? 5,
      },
    );

    if (options?.deadLetterQueue) {
      worker.on('failed', async (job, err) => {
        this.logger.error(`Job ${job?.id} failed on ${queueName}: ${err?.message}`);
        if (job) {
          await this.addJob(options.deadLetterQueue, `${job.name}-dlq`, {
            originalJob: job,
            error: err?.message,
          });
        }
      });
    }

    worker.on('error', (err) => this.logger.error(`Worker error on ${queueName}: ${err.message}`));
    this.workers.set(queueName, worker);
    return worker;
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

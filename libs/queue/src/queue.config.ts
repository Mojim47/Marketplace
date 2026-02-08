// ═══════════════════════════════════════════════════════════════════════════
// Queue Configuration - BullMQ with Retry Policy and Dead Letter Queue
// ═══════════════════════════════════════════════════════════════════════════

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions: {
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete: number;
    removeOnFail: number;
  };
  deadLetterQueue: {
    enabled: boolean;
    queueName: string;
    maxRetries: number;
  };
}

export function getQueueConfig(): QueueConfig {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
    deadLetterQueue: {
      enabled: true,
      queueName: 'dead-letter',
      maxRetries: 3,
    },
  };
}

export function getDefaultJobOptions() {
  const config = getQueueConfig();
  return {
    attempts: config.defaultJobOptions.attempts,
    backoff: config.defaultJobOptions.backoff,
    removeOnComplete: config.defaultJobOptions.removeOnComplete,
    removeOnFail: config.defaultJobOptions.removeOnFail,
  };
}

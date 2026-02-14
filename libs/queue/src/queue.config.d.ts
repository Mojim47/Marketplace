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
export declare function getQueueConfig(): QueueConfig;
export declare function getDefaultJobOptions(): {
  attempts: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete: number;
  removeOnFail: number;
};
//# sourceMappingURL=queue.config.d.ts.map

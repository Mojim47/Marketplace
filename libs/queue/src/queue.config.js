Object.defineProperty(exports, '__esModule', { value: true });
exports.getQueueConfig = getQueueConfig;
exports.getDefaultJobOptions = getDefaultJobOptions;
function getQueueConfig() {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: Number.parseInt(process.env.REDIS_DB || '0', 10),
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
function getDefaultJobOptions() {
  const config = getQueueConfig();
  return {
    attempts: config.defaultJobOptions.attempts,
    backoff: config.defaultJobOptions.backoff,
    removeOnComplete: config.defaultJobOptions.removeOnComplete,
    removeOnFail: config.defaultJobOptions.removeOnFail,
  };
}
//# sourceMappingURL=queue.config.js.map

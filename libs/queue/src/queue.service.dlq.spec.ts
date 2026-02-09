import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer } from 'testcontainers';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QUEUE_NAMES } from './queue.constants';

let redisContainer: any;
let redisPort: number;

beforeAll(async () => {
  redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
  redisPort = redisContainer.getMappedPort(6379);
});

afterAll(async () => {
  await redisContainer.stop();
});

describe('QueueService DLQ routing', () => {
  it('routes failed job to DLQ', async () => {
    const cfg = new ConfigService({ REDIS_HOST: 'localhost', REDIS_PORT: redisPort });
    const service = new QueueService(cfg);

    // processor that always throws
    service.registerWorker(
      QUEUE_NAMES.MOODIAN_SUBMIT,
      async () => {
        throw new Error('boom');
      },
      { deadLetterQueue: QUEUE_NAMES.MOODIAN_SUBMIT_DLQ, concurrency: 1 },
    );

    await service.addJob(QUEUE_NAMES.MOODIAN_SUBMIT, 'test', { foo: 'bar' }, { attempts: 1 });

    const redis = new IORedis(redisPort, '127.0.0.1');
    // wait briefly for failure routing
    await new Promise((r) => setTimeout(r, 1000));
    const dlqCount = await redis.llen(`bull:${QUEUE_NAMES.MOODIAN_SUBMIT_DLQ}:wait`);
    expect(dlqCount).toBeGreaterThan(0);
    await redis.quit();
  }, 15000);
});

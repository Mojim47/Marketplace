import { Injectable, Inject } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageRecord } from '@nestjs/throttler';
import type Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.pttl(key);

    const results = await pipeline.exec();
    const totalHits = Number(results?.[0]?.[1] ?? 0);
    let timeToExpire = Number(results?.[1]?.[1] ?? -1);

    if (timeToExpire < 0) {
      await this.redis.pexpire(key, ttl);
      timeToExpire = ttl;
    }

    return { totalHits, timeToExpire };
  }
}

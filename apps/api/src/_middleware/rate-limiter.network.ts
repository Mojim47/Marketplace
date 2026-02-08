import type { Redis } from 'ioredis'

export interface TokenBucketConfig { capacity: number; refillPerSec: number }
export class NetworkRateLimiter {
  constructor(private redis: Redis, private cfg: TokenBucketConfig) {}
  async allow(key: string): Promise<boolean> {
    const now = Math.floor(Date.now()/1000)
    const bucketKey = `ratelimit:${key}`
    const state = await this.redis.hmget(bucketKey, 'tokens', 'ts')
    let tokens = Number(state[0] ?? this.cfg.capacity)
    const ts = Number(state[1] ?? now)
    const delta = Math.max(0, now - ts)
    tokens = Math.min(this.cfg.capacity, tokens + delta * this.cfg.refillPerSec)
    if (tokens < 1) {
      await this.redis.hmset(bucketKey, { tokens: String(tokens), ts: String(now) })
      return false
    }
    tokens -= 1
    await this.redis.hmset(bucketKey, { tokens: String(tokens), ts: String(now) })
    return true
  }
}

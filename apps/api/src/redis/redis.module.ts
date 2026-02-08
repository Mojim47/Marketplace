/**
 * Redis Module
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 * 
 * Provides Redis-backed services for stateless API:
 * - STATE_SERVICE: General state storage with distributed locking
 * - SESSION_SERVICE: User session management
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RedisModuleOptions {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

/** Redis State Service - Inline implementation for API */
class RedisStateService {
  constructor(private readonly redis: Redis) {}

  private getStateKey(key: string): string {
    return `state:${key}`;
  }

  private getLockKey(key: string): string {
    return `lock:${key}`;
  }

  async setState<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<boolean> {
    const stateKey = this.getStateKey(key);
    const serialized = JSON.stringify(value);
    const ttl = options?.ttlSeconds ?? 3600;
    const result = await this.redis.setex(stateKey, ttl, serialized);
    return result === 'OK';
  }

  async getState<T>(key: string): Promise<T | null> {
    const stateKey = this.getStateKey(key);
    const data = await this.redis.get(stateKey);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async deleteState(key: string): Promise<boolean> {
    const stateKey = this.getStateKey(key);
    const result = await this.redis.del(stateKey);
    return result === 1;
  }

  async acquireLock(
    key: string,
    options?: { ttlMs?: number; retryAttempts?: number; retryDelayMs?: number }
  ): Promise<{ key: string; token: string } | null> {
    const lockKey = this.getLockKey(key);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ttlMs = options?.ttlMs ?? 10000;
    const retryAttempts = options?.retryAttempts ?? 3;
    const retryDelayMs = options?.retryDelayMs ?? 200;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return { key, token };
      }
      if (attempt < retryAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
    return null;
  }

  async releaseLock(lock: { key: string; token: string }): Promise<boolean> {
    const lockKey = this.getLockKey(lock.key);
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, lockKey, lock.token);
    return result === 1;
  }
}

/** Redis Session Service - Inline implementation for API */
class RedisSessionService {
  constructor(private readonly redis: Redis) {}

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `session:user:${userId}`;
  }

  async createSession(
    userId: string,
    metadata: { userAgent?: string; ipAddress?: string },
    options?: { ttlSeconds?: number }
  ): Promise<string> {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ttl = options?.ttlSeconds ?? 86400;
    const now = new Date();

    const session = {
      id: sessionId,
      userId,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      metadata,
      ttl,
    };

    const sessionKey = this.getSessionKey(sessionId);
    const userSessionsKey = this.getUserSessionsKey(userId);

    const pipeline = this.redis.pipeline();
    pipeline.setex(sessionKey, ttl, JSON.stringify(session));
    pipeline.sadd(userSessionsKey, sessionId);
    pipeline.expire(userSessionsKey, ttl + 3600);
    await pipeline.exec();

    return sessionId;
  }

  async getSession(sessionId: string): Promise<any | null> {
    const sessionKey = this.getSessionKey(sessionId);
    const data = await this.redis.get(sessionKey);
    if (!data) return null;
    return JSON.parse(data);
  }

  async touchSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    session.lastAccessedAt = new Date().toISOString();
    const sessionKey = this.getSessionKey(sessionId);
    await this.redis.setex(sessionKey, session.ttl, JSON.stringify(session));
    return true;
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const sessionKey = this.getSessionKey(sessionId);
    const userSessionsKey = this.getUserSessionsKey(session.userId);

    const pipeline = this.redis.pipeline();
    pipeline.del(sessionKey);
    pipeline.srem(userSessionsKey, sessionId);
    await pipeline.exec();

    return true;
  }

  async isSessionValid(sessionId: string): Promise<boolean> {
    const sessionKey = this.getSessionKey(sessionId);
    const exists = await this.redis.exists(sessionKey);
    return exists === 1;
  }
}

@Global()
@Module({})
export class RedisModule {
  static forRoot(options?: RedisModuleOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: () => {
            if (options?.url) {
              return new Redis(options.url);
            }
            const host = options?.host;
            const port = options?.port;
            if (!host) {
              throw new Error('REDIS_HOST or REDIS_URL environment variable is required');
            }
            return new Redis({
              host,
              port: port ?? 6379,
              password: options?.password,
              db: options?.db ?? 0,
            });
          },
        },
        {
          provide: 'STATE_SERVICE',
          useFactory: (redis: Redis) => new RedisStateService(redis),
          inject: ['REDIS_CLIENT'],
        },
        {
          provide: 'SESSION_SERVICE',
          useFactory: (redis: Redis) => new RedisSessionService(redis),
          inject: ['REDIS_CLIENT'],
        },
      ],
      exports: ['REDIS_CLIENT', 'STATE_SERVICE', 'SESSION_SERVICE'],
    };
  }

  static forRootAsync(): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: (configService: ConfigService) => {
            const url = configService.get<string>('REDIS_URL');
            if (url) {
              return new Redis(url);
            }
            const host = configService.get<string>('REDIS_HOST');
            if (!host) {
              throw new Error('REDIS_URL or REDIS_HOST environment variable is required');
            }
            return new Redis({
              host,
              port: configService.get<number>('REDIS_PORT', 6379),
              password: configService.get<string>('REDIS_PASSWORD'),
              db: configService.get<number>('REDIS_DB', 0),
            });
          },
          inject: [ConfigService],
        },
        {
          provide: 'STATE_SERVICE',
          useFactory: (redis: Redis) => new RedisStateService(redis),
          inject: ['REDIS_CLIENT'],
        },
        {
          provide: 'SESSION_SERVICE',
          useFactory: (redis: Redis) => new RedisSessionService(redis),
          inject: ['REDIS_CLIENT'],
        },
      ],
      exports: ['REDIS_CLIENT', 'STATE_SERVICE', 'SESSION_SERVICE'],
    };
  }
}

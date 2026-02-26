import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly slowQueryThresholdMs = Number(process.env.PRISMA_SLOW_QUERY_MS ?? 300);

  constructor() {
    const requestedEngine = process.env.PRISMA_CLIENT_ENGINE_TYPE?.toLowerCase();
    const isValidRequestedEngine = requestedEngine === 'library' || requestedEngine === 'binary';
    if (requestedEngine && !isValidRequestedEngine) {
      process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';
    }

    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
      errorFormat: 'pretty',
    });

    this.$use(async (params, next) => {
      const startedAt = Date.now();
      const result = await next(params);
      const durationMs = Date.now() - startedAt;
      if (durationMs >= this.slowQueryThresholdMs) {
        this.logger.warn(
          JSON.stringify({
            type: 'slow_query_detected',
            durationMs,
            thresholdMs: this.slowQueryThresholdMs,
            model: params.model ?? 'unknown',
            action: params.action,
            timestamp: new Date().toISOString(),
          })
        );
      }
      return result;
    });

    if (requestedEngine && !isValidRequestedEngine) {
      this.logger.warn(
        `Overriding invalid PRISMA_CLIENT_ENGINE_TYPE=${requestedEngine} to binary for deterministic runtime startup.`
      );
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('? Database connected successfully');
    } catch (error) {
      this.logger.error('? Database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

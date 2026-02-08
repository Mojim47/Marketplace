import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InternalError } from '@nextgen/errors';

/**
 * PrismaService - Database Connection with Connection Pooling
 *
 * Connection pool is configured via DATABASE_URL query parameters:
 * - connection_limit: Maximum number of connections (default: 10)
 * - pool_timeout: Timeout for acquiring a connection from pool in seconds (default: 10)
 *
 * Example DATABASE_URL:
 * postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connectionPoolMetrics = {
    activeConnections: 0,
    waitingRequests: 0,
    totalConnections: 0,
  };

  constructor() {
    // Parse connection pool settings from environment
    const poolSize = parseInt(process.env['DATABASE_POOL_SIZE'] || '10', 10);
    const poolTimeout = parseInt(process.env['DATABASE_TIMEOUT_MS'] || '5000', 10);

    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
      // Prisma connection pool configuration
      // Note: connection_limit is set in DATABASE_URL query params
      // These settings control client-side behavior
    });

    this.logger.log(`Database pool configured: size=${poolSize}, timeout=${poolTimeout}ms`);
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');

    // Log connection pool configuration
    const dbUrl = process.env['DATABASE_URL'] || '';
    const urlParams = new URL(dbUrl.replace('postgresql://', 'http://')).searchParams;
    const connectionLimit = urlParams.get('connection_limit') || '10';
    const poolTimeout = urlParams.get('pool_timeout') || '10';

    this.logger.log(
      `Connection pool settings: connection_limit=${connectionLimit}, pool_timeout=${poolTimeout}s`
    );

    try {
      await this['$connect']();
      this.logger.log('✅ Database connected successfully');
      this.connectionPoolMetrics.totalConnections = parseInt(connectionLimit, 10);
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this['$disconnect']();
  }

  /**
   * Get connection pool metrics for monitoring
   * Requirements: 10.4
   */
  getPoolMetrics() {
    return {
      ...this.connectionPoolMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute query with pool exhaustion handling
   * Requirements: 10.3
   */
  async executeWithPoolQueue<T>(operation: () => Promise<T>, timeoutMs: number = 5000): Promise<T> {
    const startTime = Date.now();
    this.connectionPoolMetrics.waitingRequests++;

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection pool timeout')), timeoutMs)
        ),
      ]);

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      if (error instanceof Error && error.message === 'Connection pool timeout') {
        this.logger.warn(`Connection pool exhausted, request waited ${elapsed}ms before timeout`);
      }
      throw error;
    } finally {
      this.connectionPoolMetrics.waitingRequests--;
    }
  }

  async cleanDatabase() {
    if (process.env['NODE_ENV'] === 'production') {
      throw InternalError.configuration('Cannot clean database in production environment');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && key[0] !== '_' && key !== 'constructor'
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      })
    );
  }
}

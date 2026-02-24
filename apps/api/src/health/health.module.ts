import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import {
  DatabaseHealthChecker,
  HealthController,
  QueueLagHealthChecker,
  RedisHealthChecker,
  SchemaHealthChecker,
  StorageHealthChecker,
} from './health.controller';
import { LivezController } from './livez.controller';

/**
 * Health Module
 *
 * Provides real health checks for all dependencies:
 * - Database (PostgreSQL via Prisma)
 * - Redis (via ioredis)
 * - Storage (MinIO/S3)
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
@Module({
  imports: [TerminusModule, DatabaseModule, RedisModule],
  controllers: [HealthController, LivezController],
  providers: [
    DatabaseHealthChecker,
    RedisHealthChecker,
    StorageHealthChecker,
    SchemaHealthChecker,
    QueueLagHealthChecker,
  ],
  exports: [
    DatabaseHealthChecker,
    RedisHealthChecker,
    StorageHealthChecker,
    SchemaHealthChecker,
    QueueLagHealthChecker,
  ],
})
export class HealthModule {}

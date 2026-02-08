import { Module } from '@nestjs/common';
import { 
  HealthController, 
  DatabaseHealthChecker, 
  RedisHealthChecker, 
  StorageHealthChecker 
} from './health.controller';
import { LivezController } from './livez.controller';
import { PrismaModule } from '@nextgen/prisma';
import { RedisModule } from '../redis/redis.module';

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
  imports: [PrismaModule, RedisModule],
  controllers: [HealthController, LivezController],
  providers: [
    DatabaseHealthChecker,
    RedisHealthChecker,
    StorageHealthChecker,
  ],
  exports: [
    DatabaseHealthChecker,
    RedisHealthChecker,
    StorageHealthChecker,
  ],
})
export class HealthModule {}

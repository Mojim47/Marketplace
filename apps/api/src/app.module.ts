import { BullModule } from '@nestjs/bullmq';
import { Global, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';

import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
// Modules
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FeatureFlagModule } from './feature-flag/feature-flag.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { RedisModule } from './redis/redis.module';
import { SearchModule } from './search/search.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';
import { VendorModule } from './vendor/vendor.module';

import { RedisThrottlerStorage } from './common/guards/redis-throttler.storage';
import { UserRateLimitGuard } from './common/guards/user-rate-limit.guard';
// Security Module
import { RateLimitGuard, SecurityModule, WAFGuard } from './shared/security/security.module';

import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { LocalizationInterceptor } from './common/interceptors/localization.interceptor';
// Interceptors
import { SecurityHeadersInterceptor } from './common/interceptors/security-headers.interceptor';

// Filters
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

// Common
import { validateEnv } from '@nextgen/config';
import { CorrelationIdMiddleware } from './_middleware/correlation-id.middleware';
import { ObservabilityModule } from './_observability/observability.module';

@Global()
@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: (config) => validateEnv({ env: config, service: 'api' }),
    }),

    // Database
    DatabaseModule,

    // Redis
    RedisModule.forRootAsync(),

    // Security Module (provides guards and security services)
    SecurityModule.forRoot(),

    // Auth
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),

    // Rate limiting (NestJS built-in, kept for compatibility)
    ThrottlerModule.forRootAsync({
      inject: ['REDIS_CLIENT'],
      useFactory: (redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 100,
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Queues
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl =
          config.get<string>('REDIS_URL') ||
          config.get<string>('KEYDB_URL') ||
          'redis://localhost:6379';
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            username: url.username || undefined,
            password: url.password || undefined,
            db: url.pathname && url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    TenantModule,
    AdminModule,
    VendorModule,
    ProductsModule,
    OrdersModule,
    HealthModule,
    FeatureFlagModule,
    AuditModule,
    MonitoringModule,
    SearchModule,
    ObservabilityModule,
  ],
  providers: [
    // ???????????????????????????????????????????????????????????????????????
    // Global Guards (executed in order)
    // Requirements: 1.3, 10.1, 10.2
    // ???????????????????????????????????????????????????????????????????????

    // WAF Guard - First line of defense against malicious requests
    // Blocks SQL Injection, XSS, Path Traversal attacks
    {
      provide: APP_GUARD,
      useClass: WAFGuard,
    },

    // Rate Limit Guard - Prevents abuse and DDoS attacks
    // Default: 100 requests per minute per IP
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },

    // User-aware throttling guard (per-user or per-IP)
    UserRateLimitGuard,

    // ???????????????????????????????????????????????????????????????????????
    // Global Interceptors (executed in order)
    // Requirements: 1.5, 3.1, 3.2, 7.1
    // ???????????????????????????????????????????????????????????????????????

    // Security Headers Interceptor - Adds security headers to all responses
    // CSP, HSTS, X-Frame-Options, etc.
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityHeadersInterceptor,
    },

    // Localization Interceptor - Transforms dates to Jalali and formats currency
    // Adds createdAtJalali, priceFormatted fields to responses
    {
      provide: APP_INTERCEPTOR,
      useClass: LocalizationInterceptor,
    },

    // Audit Interceptor - Logs all requests and responses
    // Provides audit trail with chain integrity
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },

    // ???????????????????????????????????????????????????????????????????????
    // Global Exception Filter
    // Requirements: 4.4
    // ???????????????????????????????????????????????????????????????????????

    // Global Exception Filter - Handles all exceptions with Persian messages
    // Sanitizes error messages in production
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

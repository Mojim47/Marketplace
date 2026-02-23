import { Global, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { CorrelationIdMiddleware } from './_middleware/correlation-id.middleware';
import { ObservabilityModule } from './_observability/observability.module';
import { AppController } from './app.controller';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AdaptiveThrottlingGuard } from './common/guards/adaptive-throttling.guard';
import { LaunchJwtAuthGuard } from './common/guards/launch-jwt-auth.guard';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OutboxModule } from './outbox/outbox.module';
import { OrdersModule } from './orders/orders.module';
import { RedisModule } from './redis/redis.module';
import { RuntimeModule } from './runtime/runtime.module';

function validateLaunchEnv(config: Record<string, unknown>) {
  const requireString = (key: string) => {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`missing_env_${key}`);
    }
  };

  requireString('DATABASE_URL');
  requireString('REDIS_URL');
  const hasJwtSecret =
    typeof config.JWT_SECRET === 'string' && (config.JWT_SECRET as string).length >= 32;
  const hasRsaKeys =
    typeof config.JWT_PRIVATE_KEY === 'string' &&
    typeof config.JWT_PUBLIC_KEY === 'string' &&
    (config.JWT_PRIVATE_KEY as string).length > 0 &&
    (config.JWT_PUBLIC_KEY as string).length > 0;
  if (!hasJwtSecret && !hasRsaKeys) {
    throw new Error('missing_env_jwt_secret_or_rsa_keys');
  }
  return config;
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: (config) => validateLaunchEnv(config),
    }),
    CacheModule.register({ isGlobal: true }),
    DatabaseModule,
    RedisModule.forRootAsync(),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKey = config.get<string>('JWT_PRIVATE_KEY');
        const publicKey = config.get<string>('JWT_PUBLIC_KEY');
        const secret = config.get<string>('JWT_SECRET');
        const issuer = config.get<string>('JWT_ISSUER') || 'nextgen-marketplace';
        const audience = config.get<string>('JWT_AUDIENCE') || 'nextgen-api';

        if (privateKey && publicKey) {
          return {
            privateKey: privateKey.replace(/\\n/g, '\n'),
            publicKey: publicKey.replace(/\\n/g, '\n'),
            signOptions: {
              algorithm: 'RS256' as const,
              issuer,
              audience,
              expiresIn: '24h',
            },
            verifyOptions: {
              algorithms: ['RS256'] as const,
              issuer,
              audience,
            },
          };
        }

        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must be at least 32 chars when RSA keys are not configured.');
        }

        return {
          secret,
          signOptions: {
            algorithm: 'HS256' as const,
            issuer,
            audience,
            expiresIn: '24h',
          },
          verifyOptions: {
            algorithms: ['HS256'] as const,
            issuer,
            audience,
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    ObservabilityModule,
    MonitoringModule,
    OutboxModule,
    RuntimeModule,
    HealthModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [
    LaunchJwtAuthGuard,
    {
      provide: APP_GUARD,
      useClass: AdaptiveThrottlingGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class LaunchAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProcessor } from './email.processor';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),
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
  ],
  controllers: [WorkerController],
  providers: [WorkerService, EmailProcessor],
})
export class WorkerModule {}

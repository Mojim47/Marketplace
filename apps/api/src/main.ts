import 'reflect-metadata';
import { CacheModule } from '@nestjs/cache-manager';
import { Controller, Get, Logger, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import * as http from 'http';
import { PrismaService } from '../../../libs/prisma/src/prisma.service';
import { AppController, NeonThrottlerGuard } from './app.controller';

@Controller()
class StubController {
  @Get()
  health() {
    return { status: 'LAZARUS_STUB', mode: 'SURVIVAL' };
  }
}

@Module({
  imports: [
    CacheModule.register(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        limit: 10,
        ttl: 60,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    PrismaService,
    NeonThrottlerGuard,
    {
      provide: APP_GUARD,
      useExisting: NeonThrottlerGuard,
    },
  ],
})
class NeonModule {}

@Module({ controllers: [StubController] })
class StubModule {}

async function bootstrap() {
  const logger = new Logger('LazarusKernel');
  const defaultPort = 4000;
  const portValue = process.env.API_PORT ?? process.env.PORT ?? String(defaultPort);
  const parsedPort = Number.parseInt(portValue, 10);
  const port = Number.isNaN(parsedPort) ? defaultPort : parsedPort;

  process.on('uncaughtException', (err) => logger.error(`🔥 UNCAUGHT: ${err.message}`));
  process.on('unhandledRejection', (reason) => logger.error(`🔥 REJECTION: ${reason}`));

  try {
    logger.log('🚀 INITIATING REAL CORE...');

    const app = await NestFactory.create(NeonModule, {
      abortOnError: false,
      logger: ['error', 'warn', 'log'],
    });

    await app.listen(port);
    logger.log(`✅ SYSTEM ONLINE: REAL CORE ACTIVE on http://localhost:${port}`);
  } catch (error: any) {
    logger.error(`💥 CORE DETONATION DETECTED: ${error.message}`);
    logger.warn('🛡️ ENGAGING STUB SYSTEM...');

    try {
      const app = await NestFactory.create(StubModule);
      await app.listen(port);
      logger.log(`✅ SYSTEM ONLINE: STUB MODE on http://localhost:${port}`);
    } catch (stubError: any) {
      logger.error(`☠️ STUB FAILURE: ${stubError.message}`);
      http
        .createServer((req, res) => {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'RAW_NODE_LIFE_SUPPORT' }));
        })
        .listen(port, () => console.log(`🚑 SYSTEM ONLINE: RAW NODE on http://localhost:${port}`));
    }
  }
}
bootstrap();

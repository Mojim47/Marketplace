import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { CacheModule } from '@nestjs/cache-manager';
import { Controller, Get, Logger, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import * as http from 'http';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../../libs/prisma/src/prisma.service';
import {
  apiOperationalErrorsTotal,
  apiProcessMemoryRssBytes,
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from './_observability/metrics.registry';
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

function classifyRuntimeError(error: unknown): { kind: 'operational' | 'programmer'; code?: string } {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : undefined;
  const message =
    error instanceof Error ? error.message.toLowerCase() : typeof error === 'string' ? error.toLowerCase() : '';

  if (
    code === 'EADDRINUSE' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('rate limit')
  ) {
    return { kind: 'operational', code };
  }

  return { kind: 'programmer', code };
}

function emitStructuredLog(level: 'info' | 'warn' | 'error', message: string, details?: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'nextgen-api',
    message,
    ...details,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

async function bootstrap() {
  const logger = new Logger('LazarusKernel');
  const defaultPort = 4000;
  const portValue = process.env.API_PORT ?? process.env.PORT ?? String(defaultPort);
  const parsedPort = Number.parseInt(portValue, 10);
  const port = Number.isNaN(parsedPort) ? defaultPort : parsedPort;

  process.on('uncaughtException', (err) => {
    const classification = classifyRuntimeError(err);
    apiOperationalErrorsTotal.inc({ kind: classification.kind });
    emitStructuredLog('error', 'uncaught_exception', {
      classification: classification.kind,
      code: classification.code,
      error: err instanceof Error ? err.message : String(err),
    });
    logger.error(`🔥 UNCAUGHT: ${err.message}`);
  });
  process.on('unhandledRejection', (reason) => {
    const classification = classifyRuntimeError(reason);
    apiOperationalErrorsTotal.inc({ kind: classification.kind });
    emitStructuredLog('error', 'unhandled_rejection', {
      classification: classification.kind,
      code: classification.code,
      error: reason instanceof Error ? reason.message : String(reason),
    });
    logger.error(`🔥 REJECTION: ${reason}`);
  });

  try {
    logger.log('🚀 INITIATING REAL CORE...');

    const app = await NestFactory.create(NeonModule, {
      abortOnError: false,
      logger: ['error', 'warn', 'log'],
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
      const correlationIdHeader = req.headers['x-correlation-id'];
      const correlationId =
        typeof correlationIdHeader === 'string' && correlationIdHeader.length > 0
          ? correlationIdHeader
          : randomUUID();
      const start = process.hrtime.bigint();
      res.setHeader('X-Correlation-ID', correlationId);

      res.on('finish', () => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const route = req.route?.path || req.path || req.url;
        const statusCode = String(res.statusCode);
        httpRequestDurationSeconds.observe(
          { method: req.method, route, status_code: statusCode },
          durationSeconds
        );
        httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
        emitStructuredLog('info', 'http_request', {
          correlationId,
          method: req.method,
          route,
          statusCode: res.statusCode,
          durationMs: Math.round(durationSeconds * 1000),
        });
      });

      next();
    });

    const alertRssMb = Number.parseInt(process.env.ALERT_MEMORY_RSS_MB || '800', 10);
    setInterval(() => {
      const rss = process.memoryUsage().rss;
      apiProcessMemoryRssBytes.set(rss);
      const rssMb = Math.round(rss / 1024 / 1024);
      if (rssMb >= alertRssMb) {
        emitStructuredLog('warn', 'memory_threshold_exceeded', {
          rssMb,
          thresholdMb: alertRssMb,
        });
      }
    }, 30000).unref();

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

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import {
  apiOperationalErrorsTotal,
  apiProcessMemoryRssBytes,
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from './_observability/metrics.registry';
import { LaunchAppModule } from './app.launch.module';
import { asBootFailure, runDeterministicStartupBarrier } from './bootstrap/boot-fsm';

function classifyRuntimeError(error: unknown): {
  kind: 'operational' | 'programmer';
  code?: string;
} {
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as any).code) : undefined;
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'string'
        ? error.toLowerCase()
        : '';

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

function emitStructuredLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: Record<string, unknown>
) {
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
    logger.error(`UNCAUGHT: ${err instanceof Error ? err.message : String(err)}`);
  });

  process.on('unhandledRejection', (reason) => {
    const classification = classifyRuntimeError(reason);
    apiOperationalErrorsTotal.inc({ kind: classification.kind });
    emitStructuredLog('error', 'unhandled_rejection', {
      classification: classification.kind,
      code: classification.code,
      error: reason instanceof Error ? reason.message : String(reason),
    });
    logger.error(`REJECTION: ${reason instanceof Error ? reason.message : String(reason)}`);
  });

  try {
    const app = await NestFactory.create(LaunchAppModule, {
      abortOnError: false,
      logger: ['error', 'warn', 'log'],
    });

    await runDeterministicStartupBarrier(app);

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
    const hardRssMb = Number.parseInt(process.env.HARD_MEMORY_RSS_MB || '1024', 10);
    const eventLoopLagWarnMs = Number.parseInt(process.env.EVENT_LOOP_LAG_WARN_MS || '200', 10);
    const eventLoopLagHardMs = Number.parseInt(process.env.EVENT_LOOP_LAG_HARD_MS || '1000', 10);
    const eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
    eventLoopMonitor.enable();

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
      if (rssMb >= hardRssMb) {
        emitStructuredLog('error', 'memory_hard_limit_exceeded', {
          rssMb,
          hardThresholdMb: hardRssMb,
        });
        process.exit(137);
      }

      const lagMs = Math.round(eventLoopMonitor.mean / 1_000_000);
      if (lagMs >= eventLoopLagWarnMs) {
        emitStructuredLog('warn', 'event_loop_lag_high', {
          lagMs,
          warnThresholdMs: eventLoopLagWarnMs,
        });
      }
      if (lagMs >= eventLoopLagHardMs) {
        emitStructuredLog('error', 'event_loop_lag_hard_limit', {
          lagMs,
          hardThresholdMs: eventLoopLagHardMs,
        });
      }
      eventLoopMonitor.reset();
    }, 30000).unref();

    await app.listen(port);
    logger.log(`SYSTEM ONLINE: LAUNCH CORE on http://localhost:${port}`);
  } catch (error) {
    const bootFailure = asBootFailure(error);
    emitStructuredLog('error', 'bootstrap_failed_closed', {
      error: bootFailure.reason,
      code: bootFailure.code,
      failedState: bootFailure.state,
    });
    logger.error(
      `CORE BOOT FAILURE: ${bootFailure.code} ${bootFailure.state} ${bootFailure.reason}`
    );
    process.exitCode = 1;
    throw error;
  }
}

bootstrap();

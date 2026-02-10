import 'reflect-metadata';
import * as http from 'http';
import { Controller, Get, Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PaymentService } from '../../../libs/payment/src/payment.service';
import { AppModule } from './app/app.module';

@Controller()
class StubController {
  @Get()
  health() {
    return { status: 'LAZARUS_STUB', mode: 'SURVIVAL' };
  }
}

@Module({ controllers: [StubController] })
class StubModule {}

async function bootstrap() {
  const logger = new Logger('LazarusKernel');

  process.on('uncaughtException', (err) => logger.error(`🔥 UNCAUGHT: ${err.message}`));
  process.on('unhandledRejection', (reason) => logger.error(`🔥 REJECTION: ${reason}`));

  try {
    logger.log('🚀 INITIATING REAL CORE...');

    const app = await NestFactory.create(AppModule, {
      abortOnError: false,
      logger: ['error', 'warn', 'log'],
    });

    // ⚔️ OPERATION PULSE: SELF-TEST SEQUENCE ⚔️
    const pulseLogger = new Logger('PulseCheck');
    pulseLogger.log('💓 INITIATING INTERNAL SELF-TEST...');
    try {
      const paymentService =
        (app as any).get?.(PaymentService) ?? (app as any).get?.('PaymentService');
      if (paymentService) {
        pulseLogger.log('✅ PaymentService resolved. Firing test shot...');
        const result = await paymentService.createPayment({
          orderId: 'SELFTEST-ORDER',
          amount: 1000,
          method: 'ZARINPAL',
          description: 'Internal pulse check',
        });
        pulseLogger.log(`🎯 TEST SHOT RESULT: ${JSON.stringify(result)}`);
      } else {
        pulseLogger.error('❌ PaymentService could NOT be resolved from AppModule context.');
      }
    } catch (probeError: any) {
      pulseLogger.warn(`⚠️ SELF-TEST PARTIAL FAIL: ${probeError?.message ?? probeError}`);
    }

    await app.listen(3000);
    logger.log('✅ SYSTEM ONLINE: REAL CORE ACTIVE');
  } catch (error: any) {
    logger.error(`💥 CORE DETONATION DETECTED: ${error.message}`);
    logger.warn('🛡️ ENGAGING STUB SYSTEM...');

    try {
      const app = await NestFactory.create(StubModule);
      await app.listen(3000);
      logger.log('✅ SYSTEM ONLINE: STUB MODE');
    } catch (stubError: any) {
      logger.error(`☠️ STUB FAILURE: ${stubError.message}`);
      http
        .createServer((req, res) => {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'RAW_NODE_LIFE_SUPPORT' }));
        })
        .listen(3000, () => console.log('🚑 SYSTEM ONLINE: RAW NODE'));
    }
  }
}
bootstrap();

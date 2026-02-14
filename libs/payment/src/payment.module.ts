// ═══════════════════════════════════════════════════════════════════════════
// Payment Module - Payment Gateway Integration Module
// ═══════════════════════════════════════════════════════════════════════════

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { createUniversalMock } from '../common/src/util/black-hole';
import { provideMock } from '../common/src/util/mock.factory';
import { PaymentService } from './payment.service';

// Services
import { ZarinpalService } from './zarinpal.service';

const ZARINPAL_TOKEN = 'ZARINPAL_CLIENT';
const PAYMENT_CONFIG_TOKEN = 'PAYMENT_CONFIG';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    // Real service
    PaymentService,
    // Mocks for external/native deps
    provideMock(ZARINPAL_TOKEN, 'ZarinpalMock'),
    {
      provide: PrismaClient,
      useFactory: () => createUniversalMock('PrismaClient'),
    },
    {
      provide: PAYMENT_CONFIG_TOKEN,
      useValue: {},
    },
    ZarinpalService,
  ],
  exports: [ZarinpalService],
})
export class PaymentModule {}

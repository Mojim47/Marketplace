// ═══════════════════════════════════════════════════════════════════════════
// Payment Module - Payment Gateway Integration Module
// ═══════════════════════════════════════════════════════════════════════════

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

// Services
import { ZarinpalService } from './zarinpal.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaClient, ZarinpalService],
  exports: [ZarinpalService],
})
export class PaymentModule {}

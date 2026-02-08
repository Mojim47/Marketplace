/**
 * Cart Module
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 */

import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

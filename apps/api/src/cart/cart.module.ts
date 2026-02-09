/**
 * Cart Module
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

/**
 * Search Module - AI-Enhanced Search with Semantic Caching
 * Enterprise Scalability Architecture
 * Requirements: 4.1, 4.2, 4.7
 */

import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AISearchController } from './ai-search.controller';
import { AISearchService } from './ai-search.service';

@Module({
  imports: [ProductsModule],
  controllers: [AISearchController],
  providers: [AISearchService],
  exports: [AISearchService],
})
export class SearchModule {}

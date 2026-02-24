import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SharedSearchModule } from '../shared/search/search.module';
import { StorageModule } from '../shared/storage';
import { ProductSearchService } from './product-search.service';
import { ProductsCqrsService } from './products-cqrs.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [DatabaseModule, StorageModule.forRoot(), SharedSearchModule.forRoot()],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductSearchService,
    ProductsCqrsService,
    // Provide ProductSearchService for injection into ProductsService
    {
      provide: 'PRODUCT_SEARCH_SERVICE',
      useExisting: ProductSearchService,
    },
  ],
  exports: [ProductsService, ProductSearchService, ProductsCqrsService],
})
export class ProductsModule {}

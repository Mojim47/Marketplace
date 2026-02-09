import { Module } from '@nestjs/common';
import { CatalogModule } from '@nextgen/catalog';
import { InventoryModule } from '@nextgen/inventory';
import { OrderModule } from '@nextgen/order';
import { PricingModule } from '@nextgen/pricing';
import { ProductModule } from '@nextgen/product';
import { ShippingModule } from '@nextgen/shipping';

import { CatalogController } from './catalog.controller';
import { InventoryController } from './inventory.controller';
import { OrderController } from './order.controller';
import { ProductController } from './product.controller';

@Module({
  imports: [
    ProductModule,
    OrderModule,
    CatalogModule,
    InventoryModule,
    ShippingModule,
    PricingModule,
  ],
  controllers: [ProductController, OrderController, CatalogController, InventoryController],
})
export class MarketplaceModule {}

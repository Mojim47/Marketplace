import { Module } from '@nestjs/common';
import { ProductModule } from '@nextgen/product';
import { OrderModule } from '@nextgen/order';
import { CatalogModule } from '@nextgen/catalog';
import { InventoryModule } from '@nextgen/inventory';
import { ShippingModule } from '@nextgen/shipping';
import { PricingModule } from '@nextgen/pricing';

import { ProductController } from './product.controller';
import { OrderController } from './order.controller';
import { CatalogController } from './catalog.controller';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    ProductModule,
    OrderModule,
    CatalogModule,
    InventoryModule,
    ShippingModule,
    PricingModule,
  ],
  controllers: [
    ProductController,
    OrderController,
    CatalogController,
    InventoryController,
  ],
})
export class MarketplaceModule {}

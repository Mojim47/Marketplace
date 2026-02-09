import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { B2BIntegrationService } from './b2b-integration.service';
import { ChequeController } from './cheque.controller';
import { ChequeService } from './cheque.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';
import { ProformaController } from './proforma.controller';
import { ProformaService } from './proforma.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrganizationController, ProformaController, ChequeController, PriceListController],
  providers: [
    OrganizationService,
    ProformaService,
    ChequeService,
    PriceListService,
    B2BIntegrationService,
  ],
  exports: [
    OrganizationService,
    ProformaService,
    ChequeService,
    PriceListService,
    B2BIntegrationService,
  ],
})
export class B2BModule {}

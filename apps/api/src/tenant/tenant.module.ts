import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { TenantController } from './tenant.controller'
import { TenantService } from './tenant.service'

@Module({
  imports: [DatabaseModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService]
})
export class TenantModule {}

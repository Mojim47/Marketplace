import { Controller, Get, Post, Body, Param } from '@nestjs/common'
import { FeatureFlagService } from './feature-flag.service'
import { EnableFeatureDto, DisableFeatureDto } from '../common/dto/index'

@Controller('v1/feature-flags')
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get(':tenantId')
  async findByTenant(@Param('tenantId') tenantId: string): Promise<unknown> {
    return this.featureFlagService.findByTenant(tenantId)
  }

  @Post(':tenantId/enable')
  async enable(@Param('tenantId') tenantId: string, @Body() dto: EnableFeatureDto): Promise<unknown> {
    return this.featureFlagService.enable(tenantId, dto.featureKey)
  }

  @Post(':tenantId/disable')
  async disable(@Param('tenantId') tenantId: string, @Body() dto: DisableFeatureDto): Promise<unknown> {
    return this.featureFlagService.disable(tenantId, dto.featureKey)
  }
}

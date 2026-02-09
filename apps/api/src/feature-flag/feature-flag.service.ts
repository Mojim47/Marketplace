import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';

@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<unknown[]> {
    return this.prisma.featureFlag.findMany({ where: { tenantId } });
  }

  async enable(tenantId: string, featureKey: string): Promise<unknown> {
    return this.prisma.featureFlag.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      update: { enabled: true },
      create: { tenantId, featureKey, enabled: true },
    });
  }

  async disable(tenantId: string, featureKey: string): Promise<unknown> {
    return this.prisma.featureFlag.update({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      data: { enabled: false },
    });
  }

  async isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    const feature = await this.prisma.featureFlag.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey } },
    });
    return feature?.enabled ?? false;
  }
}

import { Injectable } from '@nestjs/common';
import type { AuditLogFilterDto } from '../common/dto/index';
import type { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: AuditLogFilterDto): Promise<unknown> {
    const { skip = 0, take = 10, action, entity, adminId } = filters;

    return this.prisma.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(entity && { entity }),
        ...(adminId && { adminId }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }
}

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { AuditLogFilterDto } from '../common/dto/index'

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: AuditLogFilterDto): Promise<unknown> {
    const { skip = 0, take = 10, action, entity, adminId } = filters
    
    return this.prisma.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(entity && { entity }),
        ...(adminId && { adminId })
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    })
  }
}

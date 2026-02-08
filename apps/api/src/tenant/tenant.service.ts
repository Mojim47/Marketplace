import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { CreateTenantDto, UpdateTenantDto } from '../common/dto/index'

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<unknown> {
    return this.prisma.tenant.findUnique({ where: { id } })
  }

  async create(dto: CreateTenantDto): Promise<unknown> {
    return this.prisma.tenant.create({ data: dto })
  }

  async update(id: string, dto: UpdateTenantDto): Promise<unknown> {
    return this.prisma.tenant.update({ where: { id }, data: dto })
  }
}

import { Controller, Get, Query } from '@nestjs/common'
import { AuditService } from './audit.service'
import { AuditLogFilterDto } from '../common/dto/index'

@Controller('v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() filters: AuditLogFilterDto): Promise<unknown> {
    return this.auditService.findAll(filters)
  }
}

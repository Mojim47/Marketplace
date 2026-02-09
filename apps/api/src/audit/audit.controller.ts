import { Controller, Get, Query } from '@nestjs/common';
import type { AuditLogFilterDto } from '../common/dto/index';
import type { AuditService } from './audit.service';

@Controller('v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() filters: AuditLogFilterDto): Promise<unknown> {
    return this.auditService.findAll(filters);
  }
}

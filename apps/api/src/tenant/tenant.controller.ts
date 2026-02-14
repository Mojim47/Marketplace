import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { CreateTenantDto, UpdateTenantDto } from '../common/dto/index';
import type { TenantService } from './tenant.service';

@Controller('v1/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<unknown> {
    return this.tenantService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<unknown> {
    return this.tenantService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto): Promise<unknown> {
    return this.tenantService.update(id, dto);
  }
}

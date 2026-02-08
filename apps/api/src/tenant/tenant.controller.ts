import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common'
import { TenantService } from './tenant.service'
import { CreateTenantDto, UpdateTenantDto } from '../common/dto/index'

@Controller('v1/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<unknown> {
    return this.tenantService.findOne(id)
  }

  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<unknown> {
    return this.tenantService.create(dto)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto): Promise<unknown> {
    return this.tenantService.update(id, dto)
  }
}

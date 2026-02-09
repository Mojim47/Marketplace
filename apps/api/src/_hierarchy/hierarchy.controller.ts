/**
 * ???????????????????????????????????????????????????????????????????????????
 * Hierarchy Management Controller - Factory ? Agent ? Executor
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: ������ ���������� ������� ? ������� ? ����
 * Features:
 * - Factory creates Agents (Wholesalers)
 * - Agent creates Executors
 * - Tiered pricing assignment
 * ???????????????????????????????????????????????????????????????????????????
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { HierarchyService } from './hierarchy.service';

@ApiTags('Hierarchy')
@Controller('hierarchy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HierarchyController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  /**
   * GET /api/hierarchy/agents
   * ���� �����ϐ�� ��������� �������
   */
  @Get('agents')
  @ApiOperation({ summary: 'Get list of agents for factory' })
  async getAgents(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.hierarchyService.getAgentsByFactory(userId);
  }

  /**
   * POST /api/hierarchy/agents
   * ����� ������� ���� ���� �������
   */
  @Post('agents')
  @ApiOperation({ summary: 'Create new agent for factory' })
  async createAgent(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      mobile: string;
      email?: string;
      tierLevel: 'GOLD' | 'SILVER' | 'BRONZE';
      creditLimit?: number;
      discountPercentage?: number;
    }
  ) {
    const userId = req.user.sub || req.user.id;

    if (!body.name || !body.mobile || !body.tierLevel) {
      throw new BadRequestException('��� ������ � ��� ���� ������ ���');
    }

    return this.hierarchyService.createAgent(userId, {
      name: body.name,
      mobile: body.mobile,
      email: body.email,
      tierLevel: body.tierLevel,
      creditLimit: body.creditLimit || 0,
      discountPercentage: body.discountPercentage || 0,
    });
  }

  /**
   * GET /api/hierarchy/executors
   * ���� ������ ��������� �������
   */
  @Get('executors')
  @ApiOperation({ summary: 'Get list of executors for agent' })
  async getExecutors(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.hierarchyService.getExecutorsByAgent(userId);
  }

  /**
   * POST /api/hierarchy/executors
   * ����� ���� ���� ���� �������
   */
  @Post('executors')
  @ApiOperation({ summary: 'Create new executor for agent' })
  async createExecutor(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      mobile: string;
      email?: string;
      specialty?: string; // 'PLUMBER' | 'ELECTRICIAN' | 'CONTRACTOR'
    }
  ) {
    const userId = req.user.sub || req.user.id;

    if (!body.name || !body.mobile) {
      throw new BadRequestException('��� � ������ ������ ���');
    }

    return this.hierarchyService.createExecutor(userId, {
      name: body.name,
      mobile: body.mobile,
      email: body.email,
      specialty: body.specialty,
    });
  }
}

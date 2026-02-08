/**
 * ???????????????????????????????????????????????????????????????????????????
 * Hierarchy Management Controller - Factory ? Agent ? Executor
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: „œÌ—Ì  ”·”·Âù„—« » ò«—Œ«‰Â ? ‰„«Ì‰œÂ ? „Ã—Ì
 * Features:
 * - Factory creates Agents (Wholesalers)
 * - Agent creates Executors
 * - Tiered pricing assignment
 * ???????????????????????????????????????????????????????????????????????????
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { HierarchyService } from './hierarchy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Hierarchy')
@Controller('hierarchy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HierarchyController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  /**
   * GET /api/hierarchy/agents
   * ·Ì”  ‰„«Ì‰œê«‰ “Ì—„Ã„Ê⁄Â ò«—Œ«‰Â
   */
  @Get('agents')
  @ApiOperation({ summary: 'Get list of agents for factory' })
  async getAgents(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.hierarchyService.getAgentsByFactory(userId);
  }

  /**
   * POST /api/hierarchy/agents
   * «ÌÃ«œ ‰„«Ì‰œÂ ÃœÌœ  Ê”ÿ ò«—Œ«‰Â
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
      throw new BadRequestException(
        '‰«„° „Ê»«Ì· Ê ”ÿÕ ﬁÌ„  «·“«„Ì «” '
      );
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
   * ·Ì”  „Ã—Ì«‰ “Ì—„Ã„Ê⁄Â ‰„«Ì‰œÂ
   */
  @Get('executors')
  @ApiOperation({ summary: 'Get list of executors for agent' })
  async getExecutors(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.hierarchyService.getExecutorsByAgent(userId);
  }

  /**
   * POST /api/hierarchy/executors
   * «ÌÃ«œ „Ã—Ì ÃœÌœ  Ê”ÿ ‰„«Ì‰œÂ
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
      throw new BadRequestException('‰«„ Ê „Ê»«Ì· «·“«„Ì «” ');
    }

    return this.hierarchyService.createExecutor(userId, {
      name: body.name,
      mobile: body.mobile,
      email: body.email,
      specialty: body.specialty,
    });
  }
}

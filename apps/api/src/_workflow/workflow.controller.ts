import { Controller, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { WorkflowService } from '@libs/workflow';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private workflow: WorkflowService) {}

  @Post('submit')
  async submit(
    @Body() dto: { entityType: string; entityId: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    const workflowId = await this.workflow.submitForApproval(
      dto.entityType,
      dto.entityId,
      user.id
    );
    return { workflowId };
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.workflow.approve(id, user.id, dto.reason);
    return { success: true };
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.workflow.reject(id, user.id, dto.reason);
    return { success: true };
  }
}


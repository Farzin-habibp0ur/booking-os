import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleAgentsService } from './console-agents.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import {
  ConsolePauseAgentsDto,
  ConsoleUpdateTenantAgentDto,
  ConsolePlatformDefaultDto,
} from '../../common/dto';

@ApiTags('Console - Agents')
@Controller('admin/agents-console')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleAgentsController {
  constructor(
    private agentsService: ConsoleAgentsService,
    private auditService: PlatformAuditService,
  ) {}

  @Get('performance')
  async getPerformance(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.agentsService.getPerformanceDashboard();

    this.auditService.log(user.sub, user.email, 'AGENT_PERFORMANCE_VIEW');

    return result;
  }

  @Get('funnel')
  async getFunnel(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.agentsService.getActionCardFunnel();

    this.auditService.log(user.sub, user.email, 'AGENT_FUNNEL_VIEW');

    return result;
  }

  @Get('failures')
  async getFailures(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.agentsService.getTopFailures();

    this.auditService.log(user.sub, user.email, 'AGENT_FAILURES_VIEW');

    return result;
  }

  @Get('abnormal-tenants')
  async getAbnormalTenants(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.agentsService.getAbnormalTenants();

    this.auditService.log(user.sub, user.email, 'AGENT_ABNORMAL_TENANTS_VIEW');

    return result;
  }

  @Get('tenant/:businessId')
  async getTenantAgentStatus(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.agentsService.getTenantAgentStatus(businessId);

    this.auditService.log(user.sub, user.email, 'AGENT_TENANT_STATUS_VIEW', {
      targetType: 'BUSINESS',
      targetId: businessId,
    });

    return result;
  }

  @Post('tenant/:businessId/pause-all')
  async pauseAllAgents(
    @Param('businessId') businessId: string,
    @Body() body: ConsolePauseAgentsDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.agentsService.pauseAllAgents(businessId);

    this.auditService.log(user.sub, user.email, 'AGENT_PAUSE_ALL', {
      targetType: 'BUSINESS',
      targetId: businessId,
      reason: body.reason,
    });

    return result;
  }

  @Post('tenant/:businessId/resume-all')
  async resumeAllAgents(
    @Param('businessId') businessId: string,
    @Body() body: ConsolePauseAgentsDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.agentsService.resumeAllAgents(businessId);

    this.auditService.log(user.sub, user.email, 'AGENT_RESUME_ALL', {
      targetType: 'BUSINESS',
      targetId: businessId,
      reason: body.reason,
    });

    return result;
  }

  @Post('tenant/:businessId/agent/:agentType')
  async updateTenantAgent(
    @Param('businessId') businessId: string,
    @Param('agentType') agentType: string,
    @Body() body: ConsoleUpdateTenantAgentDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.agentsService.updateTenantAgent(businessId, agentType, {
      isEnabled: body.isEnabled,
      autonomyLevel: body.autonomyLevel,
    });

    this.auditService.log(user.sub, user.email, 'AGENT_TENANT_UPDATE', {
      targetType: 'AGENT_CONFIG',
      targetId: `${businessId}/${agentType}`,
      reason: body.reason,
      metadata: { isEnabled: body.isEnabled, autonomyLevel: body.autonomyLevel },
    });

    return result;
  }

  @Get('platform-defaults')
  async getPlatformDefaults(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.agentsService.getPlatformDefaults();

    this.auditService.log(user.sub, user.email, 'AGENT_PLATFORM_DEFAULTS_VIEW');

    return result;
  }

  @Put('platform-defaults/:agentType')
  async updatePlatformDefault(
    @Param('agentType') agentType: string,
    @Body() body: ConsolePlatformDefaultDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.agentsService.updatePlatformDefault(agentType, body, user.sub);

    this.auditService.log(user.sub, user.email, 'AGENT_PLATFORM_DEFAULT_UPDATE', {
      targetType: 'PLATFORM_AGENT_DEFAULT',
      targetId: agentType,
      metadata: {
        maxAutonomyLevel: body.maxAutonomyLevel,
        defaultEnabled: body.defaultEnabled,
        confidenceThreshold: body.confidenceThreshold,
        requiresReview: body.requiresReview,
      },
    });

    return result;
  }
}

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { AgentFrameworkService } from './agent-framework.service';

@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('agents')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AgentController {
  constructor(private agentFramework: AgentFrameworkService) {}

  @Get('config')
  getConfigs(@BusinessId() businessId: string) {
    return this.agentFramework.getConfigs(businessId);
  }

  @Get('config/:agentType')
  getConfig(@BusinessId() businessId: string, @Param('agentType') agentType: string) {
    return this.agentFramework.getConfig(businessId, agentType);
  }

  @Patch('config/:agentType')
  @UseGuards(RolesGuard)
  @AllowAnyRole()
  @Roles('ADMIN')
  upsertConfig(
    @BusinessId() businessId: string,
    @Param('agentType') agentType: string,
    @Body()
    body: { isEnabled?: boolean; autonomyLevel?: string; config?: any; roleVisibility?: string[] },
  ) {
    return this.agentFramework.upsertConfig(businessId, agentType, body);
  }

  @Post(':agentType/trigger')
  @UseGuards(RolesGuard)
  @AllowAnyRole()
  @Roles('ADMIN')
  triggerAgent(@BusinessId() businessId: string, @Param('agentType') agentType: string) {
    return this.agentFramework.triggerAgent(businessId, agentType);
  }

  @Get('runs')
  getRuns(
    @BusinessId() businessId: string,
    @Query() query: { agentType?: string; status?: string; page?: string; pageSize?: string },
  ) {
    return this.agentFramework.getRuns(businessId, {
      agentType: query.agentType,
      status: query.status,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @Post('feedback')
  submitFeedback(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { actionCardId: string; rating: string; comment?: string },
  ) {
    return this.agentFramework.submitFeedback(
      businessId,
      body.actionCardId,
      staffId,
      body.rating,
      body.comment,
    );
  }

  @Get('feedback/stats')
  getFeedbackStats(@BusinessId() businessId: string, @Query('agentType') agentType?: string) {
    return this.agentFramework.getFeedbackStats(businessId, agentType);
  }

  @Get('registered')
  getRegisteredAgents() {
    return { agents: this.agentFramework.getRegisteredAgents() };
  }
}

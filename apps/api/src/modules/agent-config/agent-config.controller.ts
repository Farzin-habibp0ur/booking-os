import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AgentConfigService } from './agent-config.service';
import { UpdateAgentConfigDto } from './dto';

@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('agent-config')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class AgentConfigController {
  constructor(private readonly service: AgentConfigService) {}

  /** Customer-facing: returns only core agents (excludes marketing) */
  @Get()
  findAll(@BusinessId() businessId: string) {
    return this.service.findAll(businessId);
  }

  /** Customer-facing: core agents performance only */
  @Get('performance')
  getPerformanceSummary(@BusinessId() businessId: string) {
    return this.service.getPerformanceSummary(businessId);
  }

  /** Admin: returns ALL agents including marketing */
  @Get('admin/all')
  @Roles('SUPER_ADMIN')
  findAllAdmin(@BusinessId() businessId: string) {
    return this.service.findAllUnfiltered(businessId);
  }

  /** Admin: all agents performance including marketing */
  @Get('admin/performance')
  @Roles('SUPER_ADMIN')
  getPerformanceSummaryAdmin(@BusinessId() businessId: string) {
    return this.service.getPerformanceSummaryUnfiltered(businessId);
  }

  /** Admin: update any agent including marketing */
  @Patch('admin/:agentType')
  @Roles('SUPER_ADMIN')
  updateAdmin(
    @BusinessId() businessId: string,
    @Param('agentType') agentType: string,
    @Body() body: UpdateAgentConfigDto,
  ) {
    return this.service.updateUnfiltered(businessId, agentType, body);
  }

  /** Admin: run any agent including marketing */
  @Post('admin/:agentType/run-now')
  @Roles('SUPER_ADMIN')
  runNowAdmin(@BusinessId() businessId: string, @Param('agentType') agentType: string) {
    return this.service.runNowUnfiltered(businessId, agentType);
  }

  @Get(':agentType')
  findOne(@BusinessId() businessId: string, @Param('agentType') agentType: string) {
    return this.service.findOne(businessId, agentType);
  }

  @Patch(':agentType')
  @Roles('OWNER', 'ADMIN')
  update(
    @BusinessId() businessId: string,
    @Param('agentType') agentType: string,
    @Body() body: UpdateAgentConfigDto,
  ) {
    return this.service.update(businessId, agentType, body);
  }

  @Post(':agentType/run-now')
  @Roles('OWNER', 'ADMIN')
  runNow(@BusinessId() businessId: string, @Param('agentType') agentType: string) {
    return this.service.runNow(businessId, agentType);
  }
}

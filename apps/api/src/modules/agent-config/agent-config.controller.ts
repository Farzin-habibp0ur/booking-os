import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AgentConfigService } from './agent-config.service';
import { UpdateAgentConfigDto } from './dto';

@Controller('agent-config')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class AgentConfigController {
  constructor(private readonly service: AgentConfigService) {}

  @Get()
  findAll(@BusinessId() businessId: string) {
    return this.service.findAll(businessId);
  }

  @Get('performance')
  getPerformanceSummary(@BusinessId() businessId: string) {
    return this.service.getPerformanceSummary(businessId);
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

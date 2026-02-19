import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AgentSkillsService } from './agent-skills.service';

@Controller('agent-skills')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AgentSkillsController {
  constructor(private agentSkillsService: AgentSkillsService) {}

  @Get()
  getSkills(@BusinessId() businessId: string) {
    return this.agentSkillsService.getBusinessSkills(businessId);
  }

  @Get('packs')
  getAllPackSkills() {
    return this.agentSkillsService.getAllPackSkills();
  }

  @Patch(':agentType/enable')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  enableSkill(@BusinessId() businessId: string, @Param('agentType') agentType: string) {
    return this.agentSkillsService.enableSkill(businessId, agentType);
  }

  @Patch(':agentType/disable')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  disableSkill(@BusinessId() businessId: string, @Param('agentType') agentType: string) {
    return this.agentSkillsService.disableSkill(businessId, agentType);
  }

  @Patch(':agentType/config')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateConfig(
    @BusinessId() businessId: string,
    @Param('agentType') agentType: string,
    @Body() body: { autonomyLevel?: string; config?: any },
  ) {
    return this.agentSkillsService.updateSkillConfig(businessId, agentType, body);
  }
}

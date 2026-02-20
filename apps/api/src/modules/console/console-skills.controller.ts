import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleSkillsService } from './console-skills.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import { ConsoleSkillOverrideDto } from '../../common/dto';

@ApiTags('Console - Skills')
@Controller('admin/skills')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleSkillsController {
  constructor(
    private skillsService: ConsoleSkillsService,
    private auditService: PlatformAuditService,
  ) {}

  @Get('catalog')
  async getCatalog(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.skillsService.getCatalog();

    this.auditService.log(user.sub, user.email, 'SKILLS_CATALOG_VIEW');

    return result;
  }

  @Get(':agentType/adoption')
  async getSkillAdoption(
    @Param('agentType') agentType: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.skillsService.getSkillAdoption(agentType);

    this.auditService.log(user.sub, user.email, 'SKILL_ADOPTION_VIEW', {
      targetType: 'SKILL',
      targetId: agentType,
    });

    return result;
  }

  @Post(':agentType/platform-override')
  async platformOverride(
    @Param('agentType') agentType: string,
    @Body() body: ConsoleSkillOverrideDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.skillsService.platformOverride(agentType, body.enabled, user.sub);

    this.auditService.log(user.sub, user.email, 'SKILL_PLATFORM_OVERRIDE', {
      targetType: 'SKILL',
      targetId: agentType,
      reason: body.reason,
      metadata: { enabled: body.enabled, affectedCount: result.affectedCount },
    });

    return result;
  }
}

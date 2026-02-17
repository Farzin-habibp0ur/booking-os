import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AutomationService } from './automation.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from '../../common/dto';

@Controller('automations')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class AutomationController {
  constructor(private automationService: AutomationService) {}

  @Get('playbooks')
  getPlaybooks(@BusinessId() businessId: string) {
    return this.automationService.getActivePlaybooks(businessId);
  }

  @Post('playbooks/:id/toggle')
  @Roles('ADMIN')
  togglePlaybook(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.automationService.togglePlaybook(businessId, id);
  }

  @Get('rules')
  getRules(@BusinessId() businessId: string) {
    return this.automationService.getRules(businessId);
  }

  @Post('rules')
  @Roles('ADMIN')
  createRule(@BusinessId() businessId: string, @Body() body: CreateAutomationRuleDto) {
    return this.automationService.createRule(businessId, body);
  }

  @Patch('rules/:id')
  @Roles('ADMIN')
  updateRule(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateAutomationRuleDto,
  ) {
    return this.automationService.updateRule(businessId, id, body);
  }

  @Delete('rules/:id')
  @Roles('ADMIN')
  deleteRule(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.automationService.deleteRule(businessId, id);
  }

  @Post('rules/:id/test')
  @Roles('ADMIN')
  testRule(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.automationService.testRule(businessId, id);
  }

  @Get('logs')
  getLogs(@BusinessId() businessId: string, @Query() query: any) {
    return this.automationService.getLogs(businessId, query);
  }
}

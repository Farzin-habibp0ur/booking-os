import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AutomationService } from './automation.service';
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  SetAutomationStepsDto,
} from '../../common/dto';

@Throttle({ default: { limit: 20, ttl: 60000 } })
@Controller('automations')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
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

  @Get('playbooks/:id/stats')
  getPlaybookStats(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.automationService.getPlaybookStats(businessId, id);
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

  // P-13: Step management endpoints
  @Get('rules/:id/steps')
  getSteps(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.automationService.getSteps(businessId, id);
  }

  @Put('rules/:id/steps')
  @Roles('ADMIN')
  setSteps(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: SetAutomationStepsDto,
  ) {
    return this.automationService.setSteps(businessId, id, body.steps);
  }

  @Get('rules/:id/executions')
  getExecutions(@BusinessId() businessId: string, @Param('id') id: string, @Query() query: any) {
    return this.automationService.getExecutions(businessId, id, query);
  }

  @Get('logs')
  getLogs(@BusinessId() businessId: string, @Query() query: any) {
    return this.automationService.getLogs(businessId, query);
  }

  @Get('activity/export')
  async exportActivityLog(
    @BusinessId() businessId: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const csv = await this.automationService.exportActivityLog(businessId, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=automation-activity.csv');
    res.send(csv);
  }

  @Post('check-conflicts')
  checkConflicts(
    @BusinessId() businessId: string,
    @Body() body: { trigger: string; filters: any; excludeRuleId?: string },
  ) {
    return this.automationService.checkConflicts(
      businessId,
      body.trigger,
      body.filters,
      body.excludeRuleId,
    );
  }

  @Get('analytics/overview')
  getAnalyticsOverview(@BusinessId() businessId: string) {
    return this.automationService.getAnalyticsOverview(businessId);
  }

  @Get('analytics/timeline')
  getAnalyticsTimeline(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.automationService.getAnalyticsTimeline(businessId, Number(days) || 30);
  }

  @Get('analytics/by-rule')
  getAnalyticsByRule(@BusinessId() businessId: string) {
    return this.automationService.getAnalyticsByRule(businessId);
  }
}

import { Controller, Get, Patch, Body, Query, UseGuards, Inject, forwardRef, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { AiService } from '../ai/ai.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { DismissNudgeDto } from '../../common/dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    @Inject(forwardRef(() => AiService)) private aiService: AiService,
  ) {}

  @Get()
  getDashboard(
    @BusinessId() businessId: string,
    @Req() req: any,
    @Query('mode') mode?: string,
  ) {
    return this.dashboardService.getDashboard(businessId, req.user.sub, req.user.role, mode);
  }

  @Patch('dismiss-nudge')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  dismissNudge(@BusinessId() businessId: string, @Body() dto: DismissNudgeDto) {
    return this.dashboardService.dismissNudge(businessId, dto.nudgeId);
  }

  @Get('ai-usage')
  getAiUsage(@BusinessId() businessId: string) {
    return this.aiService.getAiUsage(businessId);
  }
}

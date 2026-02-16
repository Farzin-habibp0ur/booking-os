import { Controller, Get, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { AiService } from '../ai/ai.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    @Inject(forwardRef(() => AiService)) private aiService: AiService,
  ) {}

  @Get()
  getDashboard(@BusinessId() businessId: string) {
    return this.dashboardService.getDashboard(businessId);
  }

  @Get('ai-usage')
  getAiUsage(@BusinessId() businessId: string) {
    return this.aiService.getAiUsage(businessId);
  }
}

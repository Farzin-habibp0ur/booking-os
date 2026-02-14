import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  getDashboard(@BusinessId() businessId: string) {
    return this.dashboardService.getDashboard(businessId);
  }
}

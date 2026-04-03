import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { DashboardBriefingService } from './dashboard-briefing.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class DashboardBriefingController {
  constructor(private readonly service: DashboardBriefingService) {}

  @Get('briefing')
  getBriefing(@BusinessId() businessId: string) {
    return this.service.getBriefingFeed(businessId);
  }

  @Get('briefing/count')
  getBriefingCount(@BusinessId() businessId: string) {
    return this.service.getBriefingCount(businessId);
  }

  @Post('briefing/:id/action')
  executeBriefingAction(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body('action') action: string,
    @CurrentUser() user: any,
  ) {
    return this.service.executeBriefingAction(businessId, id, action, user?.id);
  }

  @Get('monthly-review')
  getMonthlyReview(@BusinessId() businessId: string) {
    return this.service.getMonthlyReview(businessId);
  }

  @Post('monthly-review/generate')
  @Roles('OWNER', 'ADMIN')
  generateMonthlyReview(@BusinessId() businessId: string) {
    return this.service.generateMonthlyReview(businessId);
  }
}

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { RejectionAnalyticsService } from './rejection-analytics.service';
import { QueryRejectionLogsDto } from './dto';

@Controller('rejection-analytics')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class RejectionAnalyticsController {
  constructor(private readonly service: RejectionAnalyticsService) {}

  @Get('logs')
  getLogs(@BusinessId() businessId: string, @Query() query: QueryRejectionLogsDto) {
    return this.service.getLogs(businessId, query);
  }

  @Get('weekly-summary')
  getWeeklySummary(@BusinessId() businessId: string) {
    return this.service.getWeeklySummary(businessId);
  }

  @Get('stats')
  getStats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @Get('agent/:agentId')
  getAgentDetails(@BusinessId() businessId: string, @Param('agentId') agentId: string) {
    return this.service.getAgentRejectionDetails(businessId, agentId);
  }
}

import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';
import { BriefingService } from './briefing.service';

@Controller('briefing')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class BriefingController {
  constructor(private briefingService: BriefingService) {}

  @Get()
  getBriefing(@BusinessId() businessId: string, @Req() req: any) {
    return this.briefingService.getBriefing(businessId, req.user.sub, req.user.role);
  }

  @Get('opportunities')
  getOpportunities(@BusinessId() businessId: string) {
    return this.briefingService.getOpportunities(businessId);
  }
}

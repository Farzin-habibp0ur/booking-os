import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReferralService } from './referral.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  @Get('stats')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  getStats(@BusinessId() businessId: string) {
    return this.referralService.getReferralStats(businessId);
  }

  @Get('link')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  getLink(@BusinessId() businessId: string) {
    return this.referralService.getReferralLink(businessId).then((link) => ({ link }));
  }
}

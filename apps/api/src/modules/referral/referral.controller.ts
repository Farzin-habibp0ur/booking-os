import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';
import { UpdateReferralSettingsDto } from './dto/update-referral-settings.dto';

@Controller('referral')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('ADMIN')
export class ReferralController {
  constructor(
    private referralService: ReferralService,
    private creditService: CreditService,
  ) {}

  @Get('stats')
  async getStats(@BusinessId() businessId: string) {
    return this.referralService.getReferralStats(businessId);
  }

  @Get('settings')
  async getSettings(@BusinessId() businessId: string) {
    return this.referralService.getReferralSettings(businessId);
  }

  @Patch('settings')
  async updateSettings(@BusinessId() businessId: string, @Body() dto: UpdateReferralSettingsDto) {
    return this.referralService.updateReferralSettings(businessId, dto);
  }

  @Get('customers/:customerId')
  async getCustomerReferralInfo(
    @BusinessId() businessId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.referralService.getCustomerReferralInfo(customerId, businessId);
  }
}

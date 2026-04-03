import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';
import { UpdateReferralSettingsDto } from './dto/update-referral-settings.dto';

@Controller('referral')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
@Roles('ADMIN')
export class ReferralController {
  constructor(
    private prisma: PrismaService,
    private referralService: ReferralService,
    private creditService: CreditService,
  ) {}

  @Get('stats/summary')
  async getStatsSummary(@BusinessId() businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true, packConfig: true },
    });
    const allowed = ['AESTHETIC', 'WELLNESS'];
    if (!business || !allowed.includes(business.verticalPack.toUpperCase())) {
      return { supported: false };
    }
    const settings = this.referralService.parseSettings(business.packConfig);
    if (!settings.enabled) return { supported: true, enabled: false };

    const [total, completed, pending] = await Promise.all([
      this.prisma.customerReferral.count({ where: { businessId } }),
      this.prisma.customerReferral.count({ where: { businessId, status: 'COMPLETED' } }),
      this.prisma.customerReferral.count({ where: { businessId, status: 'PENDING' } }),
    ]);
    const credits = await this.prisma.customerCredit.aggregate({
      where: {
        businessId,
        source: { in: ['REFERRAL_GIVEN', 'REFERRAL_RECEIVED'] },
      },
      _sum: { amount: true },
    });
    return {
      supported: true,
      enabled: true,
      totalReferrals: total,
      completedReferrals: completed,
      pendingReferrals: pending,
      conversionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalCreditsIssued: credits._sum.amount || 0,
    };
  }

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

  @Get('top-referrers')
  async getTopReferrers(@BusinessId() businessId: string) {
    return this.referralService.getTopReferrers(businessId);
  }

  @Get('customers/:customerId')
  async getCustomerReferralInfo(
    @BusinessId() businessId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.referralService.getCustomerReferralInfo(customerId, businessId);
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  UseGuards,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { PlanTier, PLAN_TIERS } from '../../common/plan-config';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  createCheckout(
    @BusinessId() businessId: string,
    @Body() body: { plan: string; billing?: 'monthly' | 'annual' },
  ) {
    const plan = body.plan as PlanTier;
    if (!PLAN_TIERS.includes(plan)) {
      throw new BadRequestException(`Invalid plan. Must be one of: ${PLAN_TIERS.join(', ')}`);
    }
    return this.billingService.createCheckoutSession(businessId, plan, body.billing || 'monthly');
  }

  @Post('portal')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  createPortal(@BusinessId() businessId: string) {
    return this.billingService.createPortalSession(businessId);
  }

  @Get('subscription')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  getSubscription(@BusinessId() businessId: string) {
    return this.billingService.getSubscription(businessId);
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  getBillingStatus(@BusinessId() businessId: string) {
    return this.billingService.getBillingStatus(businessId);
  }

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Missing raw body');
    return this.billingService.handleWebhookEvent(req.rawBody, signature);
  }

  @Post('deposit')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  createDeposit(@BusinessId() businessId: string, @Body() body: { bookingId: string }) {
    return this.billingService.createDepositPaymentIntent(businessId, body.bookingId);
  }

  @Post('switch-annual')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  switchToAnnual(@BusinessId() businessId: string) {
    return this.billingService.switchToAnnual(businessId);
  }

  @Post('switch-monthly')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Roles('ADMIN')
  switchToMonthly(@BusinessId() businessId: string) {
    return this.billingService.switchToMonthly(businessId);
  }

  @Get('annual-savings')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  getAnnualSavings(@BusinessId() businessId: string) {
    return this.billingService
      .getBillingStatus(businessId)
      .then((status) => this.billingService.calculateAnnualSavings(status.plan));
  }

  @Get('billing-interval')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  getBillingInterval(@BusinessId() businessId: string) {
    return this.billingService.getCurrentBillingInterval(businessId).then((interval) => ({
      interval,
    }));
  }

  @Get('health')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN')
  getBillingHealth() {
    return this.billingService.checkBillingHealth();
  }
}

import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleBillingService } from './console-billing.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import {
  ConsoleBillingSubscriptionsQueryDto,
  ConsolePlanChangeDto,
  ConsoleCreditDto,
  ConsoleCancelDto,
} from '../../common/dto';

@ApiTags('Console - Billing')
@Controller('admin/billing')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleBillingController {
  constructor(
    private billingService: ConsoleBillingService,
    private auditService: PlatformAuditService,
  ) {}

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.billingService.getDashboard();

    this.auditService.log(user.sub, user.email, 'BILLING_DASHBOARD_VIEW');

    return result;
  }

  @Get('past-due')
  async getPastDue(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.billingService.getPastDue();

    this.auditService.log(user.sub, user.email, 'BILLING_PAST_DUE_VIEW');

    return result;
  }

  @Get('subscriptions')
  async getSubscriptions(
    @Query() query: ConsoleBillingSubscriptionsQueryDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.billingService.getSubscriptions(query);

    this.auditService.log(user.sub, user.email, 'BILLING_SUBSCRIPTIONS_VIEW', {
      metadata: { search: query.search, filters: { plan: query.plan, status: query.status } },
    });

    return result;
  }
}

@ApiTags('Console - Business Billing')
@Controller('admin/businesses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleBusinessBillingController {
  constructor(
    private billingService: ConsoleBillingService,
    private auditService: PlatformAuditService,
  ) {}

  @Get(':id/billing')
  async getBilling(@Param('id') id: string, @CurrentUser() user: { sub: string; email: string }) {
    const result = await this.billingService.getBillingForBusiness(id);

    this.auditService.log(user.sub, user.email, 'BUSINESS_BILLING_VIEW', {
      targetType: 'BUSINESS',
      targetId: id,
    });

    return result;
  }

  @Get(':id/billing/invoices')
  async getInvoices(@Param('id') id: string, @CurrentUser() user: { sub: string; email: string }) {
    const result = await this.billingService.getInvoicesForBusiness(id);

    this.auditService.log(user.sub, user.email, 'BUSINESS_INVOICES_VIEW', {
      targetType: 'BUSINESS',
      targetId: id,
    });

    return result;
  }

  @Post(':id/billing/change-plan')
  async changePlan(
    @Param('id') id: string,
    @Body() body: ConsolePlanChangeDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.billingService.changePlan(
      id,
      body.newPlan,
      body.reason,
      user.sub,
      user.email,
    );

    this.auditService.log(user.sub, user.email, 'BILLING_PLAN_CHANGE', {
      targetType: 'BUSINESS',
      targetId: id,
      reason: body.reason,
      metadata: { oldPlan: result.oldPlan, newPlan: result.newPlan },
    });

    return result.subscription;
  }

  @Post(':id/billing/credit')
  async issueCredit(
    @Param('id') id: string,
    @Body() body: ConsoleCreditDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.billingService.issueCredit(
      id,
      body.amount,
      body.reason,
      body.expiresAt,
      user.sub,
      user.email,
    );

    this.auditService.log(user.sub, user.email, 'BILLING_CREDIT_ISSUED', {
      targetType: 'BUSINESS',
      targetId: id,
      reason: body.reason,
      metadata: { amount: body.amount, expiresAt: body.expiresAt },
    });

    return result;
  }

  @Post(':id/billing/cancel')
  async cancelSubscription(
    @Param('id') id: string,
    @Body() body: ConsoleCancelDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.billingService.cancelSubscription(
      id,
      body.reason,
      body.immediate || false,
      user.sub,
      user.email,
    );

    this.auditService.log(user.sub, user.email, 'BILLING_CANCEL', {
      targetType: 'BUSINESS',
      targetId: id,
      reason: body.reason,
      metadata: { immediate: body.immediate || false },
    });

    return result;
  }

  @Post(':id/billing/reactivate')
  async reactivateSubscription(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.billingService.reactivateSubscription(id, user.sub, user.email);

    this.auditService.log(user.sub, user.email, 'BILLING_REACTIVATE', {
      targetType: 'BUSINESS',
      targetId: id,
    });

    return result;
  }

  @Get(':id/billing/credits')
  async getCredits(@Param('id') id: string, @CurrentUser() user: { sub: string; email: string }) {
    const result = await this.billingService.getCreditsForBusiness(id);

    this.auditService.log(user.sub, user.email, 'BUSINESS_CREDITS_VIEW', {
      targetType: 'BUSINESS',
      targetId: id,
    });

    return result;
  }
}

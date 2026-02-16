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

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  createCheckout(@BusinessId() businessId: string, @Body() body: { plan: 'basic' | 'pro' }) {
    return this.billingService.createCheckoutSession(businessId, body.plan);
  }

  @Post('portal')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  createPortal(@BusinessId() businessId: string) {
    return this.billingService.createPortalSession(businessId);
  }

  @Get('subscription')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  getSubscription(@BusinessId() businessId: string) {
    return this.billingService.getSubscription(businessId);
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
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  createDeposit(@BusinessId() businessId: string, @Body() body: { bookingId: string }) {
    return this.billingService.createDepositPaymentIntent(businessId, body.bookingId);
  }
}

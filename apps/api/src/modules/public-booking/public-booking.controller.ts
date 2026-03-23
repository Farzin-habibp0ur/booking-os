import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { CustomerService } from '../customer/customer.service';
import { BookingService } from '../booking/booking.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import Stripe from 'stripe';

@ApiTags('Public Booking')
@Controller('public')
export class PublicBookingController {
  private readonly logger = new Logger(PublicBookingController.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private customerService: CustomerService,
    private bookingService: BookingService,
    private waitlistService: WaitlistService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  private async resolveBusiness(slug: string) {
    // Exact match first
    const business = await this.prisma.business.findFirst({ where: { slug } });
    if (business) return business;

    // Fuzzy fallback: try startsWith match for slug variations
    const candidates = await this.prisma.business.findMany({
      where: { slug: { startsWith: slug } },
      take: 2,
    });
    if (candidates.length === 1) return candidates[0];

    // Try with common suffixes stripped (clinic, spa, studio, salon, group)
    const stripped = slug.replace(/-(clinic|spa|studio|salon|group|center|centre)$/i, '');
    if (stripped !== slug) {
      const strippedMatch = await this.prisma.business.findFirst({
        where: { slug: { startsWith: stripped } },
      });
      if (strippedMatch) return strippedMatch;
    }

    throw new NotFoundException('Business not found');
  }

  @Get(':slug')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async getBusiness(@Param('slug') slug: string) {
    const business = await this.resolveBusiness(slug);
    const policySettings =
      typeof business.policySettings === 'object' && business.policySettings
        ? (business.policySettings as any)
        : {};
    // Check if business has white-label booking (enterprise feature)
    const subscription = await this.prisma.subscription.findFirst({
      where: { businessId: business.id, status: { in: ['active', 'trialing'] } },
      select: { plan: true },
    });
    const isWhiteLabel =
      subscription?.plan === 'enterprise' &&
      typeof business.packConfig === 'object' &&
      (business.packConfig as any)?.whiteLabelBooking === true;

    return {
      name: business.name,
      slug: business.slug,
      timezone: business.timezone,
      cancellationPolicyText: policySettings.cancellationPolicyText || '',
      reschedulePolicyText: policySettings.reschedulePolicyText || '',
      whiteLabel: isWhiteLabel,
      paymentEnabled: !!this.stripe,
      logoUrl: business.logoUrl || null,
      brandPrimaryColor: business.brandPrimaryColor || '#71907C',
      brandTagline: business.brandTagline || '',
    };
  }

  @Get(':slug/services')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async getServices(@Param('slug') slug: string) {
    const business = await this.resolveBusiness(slug);
    const services = await this.prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        durationMins: true,
        price: true,
        category: true,
        depositRequired: true,
        depositAmount: true,
      },
      orderBy: { name: 'asc' },
    });
    return services;
  }

  @Get(':slug/availability')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async getAvailability(
    @Param('slug') slug: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId: string,
    @Query('staffId') staffId?: string,
  ) {
    if (!date || !serviceId) {
      throw new BadRequestException('date and serviceId are required');
    }
    const business = await this.resolveBusiness(slug);
    const slots = await this.availabilityService.getAvailableSlots(
      business.id,
      date,
      serviceId,
      staffId,
    );
    return slots.filter((s) => s.available);
  }

  @Post(':slug/create-payment-intent')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async createPaymentIntent(@Param('slug') slug: string, @Body() body: { serviceId: string }) {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }
    if (!body.serviceId) {
      throw new BadRequestException('serviceId is required');
    }

    const business = await this.resolveBusiness(slug);
    const service = await this.prisma.service.findFirst({
      where: { id: body.serviceId, businessId: business.id, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const amount =
      service.depositRequired && service.depositAmount ? service.depositAmount : service.price;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Service has no payable amount');
    }

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100),
        currency: 'usd',
        metadata: { businessId: business.id, serviceId: service.id, slug },
      },
      { idempotencyKey: `public-${business.id}-${service.id}-${Date.now()}` },
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
    };
  }

  @Post(':slug/book')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async createBooking(
    @Param('slug') slug: string,
    @Body()
    body: {
      serviceId: string;
      staffId?: string;
      startTime: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      ref?: string;
      paymentIntentId?: string;
    },
  ) {
    if (!body.serviceId || !body.startTime || !body.customerName || !body.customerPhone) {
      throw new BadRequestException(
        'serviceId, startTime, customerName, and customerPhone are required',
      );
    }

    const business = await this.resolveBusiness(slug);

    // Find or create customer
    const customer = await this.customerService.findOrCreateByPhone(
      business.id,
      body.customerPhone,
      body.customerName,
    );

    // Update email if provided and customer doesn't have one
    if (body.customerEmail && !customer.email) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { email: body.customerEmail },
      });
    }

    // Create booking with optional referral source
    const customFields: any = {};
    if (body.ref) customFields.referralSource = body.ref;

    const booking = await this.bookingService.create(business.id, {
      customerId: customer.id,
      serviceId: body.serviceId,
      staffId: body.staffId,
      startTime: body.startTime,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      source: body.ref ? 'REFERRAL' : 'PORTAL',
    });

    // Link payment to booking if paymentIntentId was provided
    if (body.paymentIntentId) {
      await this.prisma.payment.create({
        data: {
          businessId: business.id,
          bookingId: booking.id,
          customerId: customer.id,
          stripePaymentIntentId: body.paymentIntentId,
          amount: booking.service.depositAmount || booking.service.price,
          currency: 'usd',
          method: 'STRIPE',
          status: 'COMPLETED',
        },
      });

      // Mark booking as confirmed since payment is done
      if (booking.status === 'PENDING_DEPOSIT') {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED' },
        });
      }
    }

    return {
      id: booking.id,
      status: body.paymentIntentId ? 'CONFIRMED' : booking.status,
      serviceName: booking.service.name,
      startTime: booking.startTime,
      staffName: booking.staff?.name || null,
      businessName: business.name,
      depositRequired: !body.paymentIntentId && (booking.service.depositRequired || false),
      depositAmount: booking.service.depositAmount || null,
    };
  }

  @Post(':slug/waitlist')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async joinWaitlist(
    @Param('slug') slug: string,
    @Body()
    body: {
      serviceId: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      staffId?: string;
      timeWindowStart?: string;
      timeWindowEnd?: string;
      dateFrom?: string;
      dateTo?: string;
      notes?: string;
    },
  ) {
    if (!body.serviceId || !body.customerName || !body.customerPhone) {
      throw new BadRequestException('serviceId, customerName, and customerPhone are required');
    }

    const business = await this.resolveBusiness(slug);

    const customer = await this.customerService.findOrCreateByPhone(
      business.id,
      body.customerPhone,
      body.customerName,
    );

    if (body.customerEmail && !customer.email) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { email: body.customerEmail },
      });
    }

    const entry = await this.waitlistService.joinWaitlist({
      businessId: business.id,
      customerId: customer.id,
      serviceId: body.serviceId,
      staffId: body.staffId,
      timeWindowStart: body.timeWindowStart,
      timeWindowEnd: body.timeWindowEnd,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      notes: body.notes,
    });

    return {
      id: entry.id,
      status: entry.status,
      serviceName: entry.service.name,
      businessName: business.name,
    };
  }
}

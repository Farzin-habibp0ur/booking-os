import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../../common/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { CustomerService } from '../customer/customer.service';
import { BookingService } from '../booking/booking.service';
import { WaitlistService } from '../waitlist/waitlist.service';

@ApiTags('Public Booking')
@Controller('public')
export class PublicBookingController {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private customerService: CustomerService,
    private bookingService: BookingService,
    private waitlistService: WaitlistService,
  ) {}

  private async resolveBusiness(slug: string) {
    const business = await this.prisma.business.findFirst({ where: { slug } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  @Get(':slug')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async getBusiness(@Param('slug') slug: string) {
    const business = await this.resolveBusiness(slug);
    const policySettings =
      typeof business.policySettings === 'object' && business.policySettings
        ? (business.policySettings as any)
        : {};
    return {
      name: business.name,
      slug: business.slug,
      timezone: business.timezone,
      cancellationPolicyText: policySettings.cancellationPolicyText || '',
      reschedulePolicyText: policySettings.reschedulePolicyText || '',
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

    // Create booking
    const booking = await this.bookingService.create(business.id, {
      customerId: customer.id,
      serviceId: body.serviceId,
      staffId: body.staffId,
      startTime: body.startTime,
    });

    return {
      id: booking.id,
      status: booking.status,
      serviceName: booking.service.name,
      startTime: booking.startTime,
      staffName: booking.staff?.name || null,
      businessName: business.name,
      depositRequired: booking.service.depositRequired || false,
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

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { BookingService } from '../booking/booking.service';
import { UpdatePortalProfileDto } from './dto';

@Injectable()
export class PortalService {
  constructor(
    private prisma: PrismaService,
    private bookingService: BookingService,
  ) {}

  async getProfile(customerId: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const [totalBookings, totalSpent] = await Promise.all([
      this.prisma.booking.count({
        where: { customerId, businessId },
      }),
      this.prisma.booking.aggregate({
        where: { customerId, businessId, status: 'COMPLETED' },
        _sum: { amount: true },
      } as any),
    ]);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      preferences: (customer as any).customFields || {},
      memberSince: customer.createdAt,
      totalBookings,
      totalSpent: (totalSpent as any)._sum?.amount || 0,
    };
  }

  async updateProfile(customerId: string, businessId: string, dto: UpdatePortalProfileDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (
      dto.notifyWhatsApp !== undefined ||
      dto.notifyEmail !== undefined ||
      dto.customFields !== undefined
    ) {
      const prefs = ((customer as any).customFields as any) || {};
      if (dto.notifyWhatsApp !== undefined) prefs.notifyWhatsApp = dto.notifyWhatsApp;
      if (dto.notifyEmail !== undefined) prefs.notifyEmail = dto.notifyEmail;
      if (dto.customFields !== undefined) {
        Object.assign(prefs, dto.customFields);
      }
      data.customFields = prefs;
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data,
    });
  }

  async getBookings(
    customerId: string,
    businessId: string,
    query: { page?: number; status?: string },
  ) {
    const page = query.page || 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    const where: any = { customerId, businessId };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          service: { select: { name: true, durationMins: true, price: true } },
          staff: { select: { name: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getUpcoming(customerId: string, businessId: string) {
    return this.prisma.booking.findMany({
      where: {
        customerId,
        businessId,
        startTime: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        service: { select: { name: true, durationMins: true, price: true } },
        staff: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    });
  }

  async cancelBooking(customerId: string, businessId: string, bookingId: string, reason?: string) {
    // Verify booking belongs to this customer AND business (tenant isolation)
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId, businessId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Check cancellable status
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ConflictException(`Cannot cancel a booking with status ${booking.status}`);
    }

    // Check cancellation policy
    const policy = await this.bookingService.checkPolicyAllowed(businessId, bookingId, 'cancel');
    if (!policy.allowed) {
      throw new ForbiddenException(policy.reason || 'Cancellation not allowed');
    }

    return this.bookingService.updateStatus(businessId, bookingId, 'CANCELLED', {
      reason: reason || 'Cancelled by customer via portal',
    });
  }

  async rescheduleBooking(
    customerId: string,
    businessId: string,
    bookingId: string,
    newStartTime: string,
  ) {
    // Verify booking belongs to this customer AND business (tenant isolation)
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId, businessId },
      include: { service: { select: { durationMins: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Check reschedulable status
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ConflictException(`Cannot reschedule a booking with status ${booking.status}`);
    }

    // Check reschedule policy
    const policy = await this.bookingService.checkPolicyAllowed(
      businessId,
      bookingId,
      'reschedule',
    );
    if (!policy.allowed) {
      throw new ForbiddenException(policy.reason || 'Rescheduling not allowed');
    }

    const newStart = new Date(newStartTime);
    const durationMins = (booking as any).service?.durationMins || 30;
    const newEnd = new Date(newStart.getTime() + durationMins * 60000);

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        startTime: newStart,
        endTime: newEnd,
      },
      include: {
        service: { select: { name: true, durationMins: true, price: true } },
        staff: { select: { name: true } },
      },
    });
  }

  async getInvoices(customerId: string, businessId: string) {
    return this.prisma.invoice.findMany({
      where: { customerId, businessId, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      include: {
        lineItems: true,
      },
    });
  }
}

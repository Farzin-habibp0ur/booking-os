import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class WaitlistService {
  constructor(private prisma: PrismaService) {}

  async joinWaitlist(data: {
    businessId: string;
    customerId: string;
    serviceId: string;
    staffId?: string;
    timeWindowStart?: string;
    timeWindowEnd?: string;
    dateFrom?: string;
    dateTo?: string;
    notes?: string;
  }) {
    // Verify service exists
    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, businessId: data.businessId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    // Check for duplicate active entry
    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        businessId: data.businessId,
        customerId: data.customerId,
        serviceId: data.serviceId,
        status: 'ACTIVE',
      },
    });
    if (existing) throw new BadRequestException('Customer is already on the waitlist for this service');

    return this.prisma.waitlistEntry.create({
      data: {
        businessId: data.businessId,
        customerId: data.customerId,
        serviceId: data.serviceId,
        staffId: data.staffId || null,
        timeWindowStart: data.timeWindowStart || null,
        timeWindowEnd: data.timeWindowEnd || null,
        dateFrom: data.dateFrom ? new Date(data.dateFrom) : null,
        dateTo: data.dateTo ? new Date(data.dateTo) : null,
        notes: data.notes || null,
      },
      include: { customer: true, service: true, staff: true },
    });
  }

  async getEntries(
    businessId: string,
    filters?: { status?: string; serviceId?: string; staffId?: string },
  ) {
    const where: any = { businessId };
    if (filters?.status) where.status = filters.status;
    if (filters?.serviceId) where.serviceId = filters.serviceId;
    if (filters?.staffId) where.staffId = filters.staffId;

    return this.prisma.waitlistEntry.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateEntry(businessId: string, id: string, data: { status?: string; notes?: string; staffId?: string }) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id, businessId },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    return this.prisma.waitlistEntry.update({
      where: { id },
      data,
      include: { customer: true, service: true, staff: true },
    });
  }

  async cancelEntry(businessId: string, id: string) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id, businessId },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    if (entry.status === 'BOOKED') throw new BadRequestException('Cannot cancel a booked entry');

    return this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { customer: true, service: true, staff: true },
    });
  }

  async resolveEntry(businessId: string, id: string, bookingId: string) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id, businessId },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    return this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: 'BOOKED', bookingId, claimedAt: new Date() },
      include: { customer: true, service: true, staff: true },
    });
  }
}

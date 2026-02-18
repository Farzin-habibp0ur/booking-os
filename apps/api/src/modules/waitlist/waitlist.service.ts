import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

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
    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, businessId: data.businessId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        businessId: data.businessId,
        customerId: data.customerId,
        serviceId: data.serviceId,
        status: 'ACTIVE',
      },
    });
    if (existing)
      throw new BadRequestException('Customer is already on the waitlist for this service');

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

  async updateEntry(
    businessId: string,
    id: string,
    data: { status?: string; notes?: string; staffId?: string },
  ) {
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

  async offerOpenSlot(booking: {
    id: string;
    businessId: string;
    serviceId: string;
    staffId?: string | null;
    startTime: Date;
    service: { name: string };
    staff?: { name: string } | null;
  }) {
    const business = await this.prisma.business.findUnique({
      where: { id: booking.businessId },
      select: { packConfig: true },
    });
    const waitlistConfig = ((business?.packConfig as any) || {}).waitlist || {};
    const offerCount = waitlistConfig.offerCount || 3;
    const expiryMinutes = waitlistConfig.expiryMinutes || 15;

    // Check quiet hours
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const quietStart = waitlistConfig.quietStart || '21:00';
    const quietEnd = waitlistConfig.quietEnd || '09:00';
    if (this.isInQuietHours(currentTime, quietStart, quietEnd)) {
      this.logger.log('Skipping waitlist offer: quiet hours');
      return;
    }

    // Find matching active entries
    const where: any = {
      businessId: booking.businessId,
      serviceId: booking.serviceId,
      status: 'ACTIVE',
    };
    if (booking.staffId) {
      where.OR = [{ staffId: booking.staffId }, { staffId: null }];
    }

    const entries = await this.prisma.waitlistEntry.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: offerCount,
    });

    const offerExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const offeredSlot = {
      startTime: booking.startTime.toISOString(),
      serviceName: booking.service.name,
      staffName: booking.staff?.name || null,
    };

    for (const entry of entries) {
      try {
        await this.prisma.waitlistEntry.update({
          where: { id: entry.id },
          data: {
            status: 'OFFERED',
            offeredAt: now,
            offerExpiresAt,
            offeredSlot,
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed to offer slot to waitlist entry ${entry.id} for service ${booking.serviceId}`,
          { entryId: entry.id, error: err.message },
        );
      }
    }

    this.logger.log(
      `Offered open slot to ${entries.length} waitlist entries for service ${booking.serviceId}`,
    );
  }

  async getMetrics(businessId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalEntries, offeredCount, claimedCount, cancelledBookings] = await Promise.all([
      this.prisma.waitlistEntry.count({
        where: { businessId, createdAt: { gte: since } },
      }),
      this.prisma.waitlistEntry.count({
        where: { businessId, status: { in: ['OFFERED', 'BOOKED'] }, createdAt: { gte: since } },
      }),
      this.prisma.waitlistEntry.count({
        where: { businessId, status: 'BOOKED', createdAt: { gte: since } },
      }),
      this.prisma.booking.count({
        where: { businessId, status: 'CANCELLED', updatedAt: { gte: since } },
      }),
    ]);

    // Calculate average time to fill (from offer to claim)
    const claimedEntries = await this.prisma.waitlistEntry.findMany({
      where: {
        businessId,
        status: 'BOOKED',
        claimedAt: { not: null },
        offeredAt: { not: null },
        createdAt: { gte: since },
      },
      select: { offeredAt: true, claimedAt: true },
    });

    let avgTimeToFill = 0;
    if (claimedEntries.length > 0) {
      const totalMs = claimedEntries.reduce((sum, e) => {
        return sum + ((e.claimedAt as Date).getTime() - (e.offeredAt as Date).getTime());
      }, 0);
      avgTimeToFill = Math.round(totalMs / claimedEntries.length / 60000); // minutes
    }

    return {
      totalEntries,
      cancellations: cancelledBookings,
      offers: offeredCount,
      claimed: claimedCount,
      avgTimeToFill,
      fillRate: offeredCount > 0 ? Math.round((claimedCount / offeredCount) * 100) : 0,
    };
  }

  @Cron('* * * * *')
  async expireStaleOffers() {
    try {
      const now = new Date();
      const expired = await this.prisma.waitlistEntry.updateMany({
        where: {
          status: 'OFFERED',
          offerExpiresAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      if (expired.count > 0) {
        this.logger.log(`Expired ${expired.count} stale waitlist offers`);
      }
    } catch (err: any) {
      this.logger.error('Failed to expire stale waitlist offers', {
        error: err.message,
        stack: err.stack,
      });
    }
  }

  private isInQuietHours(current: string, start: string, end: string): boolean {
    if (start <= end) {
      return current >= start && current < end;
    }
    // Wraps midnight (e.g., 21:00 → 09:00)
    return current >= start || current < end;
  }
}

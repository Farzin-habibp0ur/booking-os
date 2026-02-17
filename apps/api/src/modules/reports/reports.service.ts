import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async bookingsOverTime(businessId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const bookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: { gte: since } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, number> = {};
    for (const b of bookings) {
      const date = b.createdAt.toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    }

    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }

  async noShowRate(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter.gte = since;
    }

    const [total, noShows] = await Promise.all([
      this.prisma.booking.count({
        where: {
          businessId,
          startTime: dateFilter,
          status: { in: ['COMPLETED', 'NO_SHOW'] },
        },
      }),
      this.prisma.booking.count({
        where: {
          businessId,
          startTime: dateFilter,
          status: 'NO_SHOW',
        },
      }),
    ]);

    return {
      total,
      noShows,
      rate: total > 0 ? Math.round((noShows / total) * 100) : 0,
    };
  }

  async responseTimes(businessId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { businessId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    const responseTimes: number[] = [];
    for (const conv of conversations) {
      let lastInbound: Date | null = null;
      for (const msg of conv.messages) {
        if (msg.direction === 'INBOUND') {
          lastInbound = msg.createdAt;
        } else if (msg.direction === 'OUTBOUND' && lastInbound) {
          const diff = msg.createdAt.getTime() - lastInbound.getTime();
          responseTimes.push(diff / 60000);
          lastInbound = null;
        }
      }
    }

    const avg =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

    return { avgMinutes: avg, sampleSize: responseTimes.length };
  }

  async serviceBreakdown(businessId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const bookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: { gte: since } },
      include: { service: { select: { id: true, name: true, price: true } } },
    });

    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const b of bookings) {
      const svc = b.service;
      if (!map[svc.id]) {
        map[svc.id] = { name: svc.name, count: 0, revenue: 0 };
      }
      map[svc.id].count++;
      map[svc.id].revenue += svc.price;
    }

    return Object.values(map).sort((a, b) => b.count - a.count);
  }

  async staffPerformance(businessId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const bookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: { gte: since }, staffId: { not: null } },
      include: {
        staff: { select: { id: true, name: true } },
        service: { select: { price: true } },
      },
    });

    const map: Record<
      string,
      { name: string; total: number; completed: number; noShows: number; revenue: number }
    > = {};
    for (const b of bookings) {
      const staff = b.staff;
      if (!staff) continue;
      if (!map[staff.id]) {
        map[staff.id] = { name: staff.name, total: 0, completed: 0, noShows: 0, revenue: 0 };
      }
      map[staff.id].total++;
      if (b.status === 'COMPLETED') {
        map[staff.id].completed++;
        map[staff.id].revenue += b.service.price;
      }
      if (b.status === 'NO_SHOW') map[staff.id].noShows++;
    }

    return Object.entries(map)
      .map(([id, data]) => ({
        staffId: id,
        ...data,
        noShowRate: data.total > 0 ? Math.round((data.noShows / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async revenueOverTime(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter.gte = since;
    }

    const bookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: dateFilter, status: 'COMPLETED' },
      include: { service: { select: { price: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, number> = {};
    for (const b of bookings) {
      const date = b.createdAt.toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + b.service.price;
    }

    return Object.entries(grouped).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
    }));
  }

  async statusBreakdown(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter.gte = since;
    }

    const bookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: dateFilter },
      select: { status: true },
    });

    const map: Record<string, number> = {};
    for (const b of bookings) {
      map[b.status] = (map[b.status] || 0) + 1;
    }

    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }

  async consultToTreatmentConversion(
    businessId: string,
    days: number = 30,
    startDate?: Date,
    endDate?: Date,
  ) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter.gte = since;
    }

    // Find customers with completed consult bookings in the period
    const consultBookings = await this.prisma.booking.findMany({
      where: {
        businessId,
        startTime: dateFilter,
        status: 'COMPLETED',
        service: { kind: 'CONSULT' },
      },
      select: { customerId: true },
    });

    const consultCustomerIds = [...new Set(consultBookings.map((b) => b.customerId))];
    if (consultCustomerIds.length === 0) {
      return { consultCustomers: 0, converted: 0, rate: 0 };
    }

    // Check which of those customers later booked a treatment
    const convertedCount = await this.prisma.booking.groupBy({
      by: ['customerId'],
      where: {
        businessId,
        customerId: { in: consultCustomerIds },
        status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
        service: { kind: 'TREATMENT' },
      },
    });

    const converted = convertedCount.length;
    const total = consultCustomerIds.length;

    return {
      consultCustomers: total,
      converted,
      rate: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  }

  async depositComplianceRate(businessId: string, startDate?: Date, endDate?: Date) {
    const dateFilter: any = startDate ? { gte: startDate } : {};
    if (endDate) dateFilter.lte = endDate;

    const whereBase: any = {
      businessId,
      service: { depositRequired: true },
      ...(Object.keys(dateFilter).length > 0 ? { startTime: dateFilter } : {}),
    };

    const [totalRequired, paid] = await Promise.all([
      this.prisma.booking.count({ where: whereBase }),
      this.prisma.booking.count({
        where: { ...whereBase, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      }),
    ]);

    return {
      totalRequired,
      paid,
      rate: totalRequired > 0 ? Math.round((paid / totalRequired) * 100) : 0,
    };
  }

  async peakHours(businessId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const bookings = await this.prisma.booking.findMany({
      where: { businessId, startTime: { gte: since } },
      select: { startTime: true },
    });

    const hourCounts: number[] = new Array(24).fill(0);
    const dayCounts: number[] = new Array(7).fill(0);
    for (const b of bookings) {
      hourCounts[b.startTime.getHours()]++;
      dayCounts[b.startTime.getDay()]++;
    }

    return {
      byHour: hourCounts.map((count, hour) => ({ hour, count })),
      byDay: dayCounts.map((count, day) => ({ day, count })),
    };
  }
}

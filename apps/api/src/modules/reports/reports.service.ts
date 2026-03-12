import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async bookingsOverTime(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
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

  async serviceBreakdown(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
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

  async staffPerformance(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
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
      where: { businessId, createdAt: dateFilter, staffId: { not: null } },
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

  async peakHours(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
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
      where: { businessId, startTime: dateFilter },
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

  async sourceBreakdown(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
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
      select: { source: true, status: true },
    });

    const map: Record<string, { source: string; count: number; completed: number }> = {};
    for (const b of bookings) {
      const src = b.source || 'MANUAL';
      if (!map[src]) {
        map[src] = { source: src, count: 0, completed: 0 };
      }
      map[src].count++;
      if (b.status === 'COMPLETED') map[src].completed++;
    }

    return Object.values(map).sort((a, b) => b.count - a.count);
  }

  async revenueSummary(
    businessId: string,
    days: number = 30,
    startDate?: Date,
    endDate?: Date,
    staffId?: string,
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

    const where: any = { businessId, createdAt: dateFilter, status: 'COMPLETED' };
    if (staffId) where.staffId = staffId;

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, price: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    let totalRevenue = 0;
    const byService: Record<string, { name: string; revenue: number; count: number }> = {};
    const byStaff: Record<string, { name: string; revenue: number; count: number }> = {};

    for (const b of bookings) {
      const price = b.service.price;
      totalRevenue += price;

      if (!byService[b.service.id]) {
        byService[b.service.id] = { name: b.service.name, revenue: 0, count: 0 };
      }
      byService[b.service.id].revenue += price;
      byService[b.service.id].count++;

      if (b.staff) {
        if (!byStaff[b.staff.id]) {
          byStaff[b.staff.id] = { name: b.staff.name, revenue: 0, count: 0 };
        }
        byStaff[b.staff.id].revenue += price;
        byStaff[b.staff.id].count++;
      }
    }

    // Previous period comparison
    const periodMs = (endDate || new Date()).getTime() - (startDate || dateFilter.gte).getTime();
    const prevEnd = new Date((startDate || dateFilter.gte).getTime());
    const prevStart = new Date(prevEnd.getTime() - periodMs);

    const prevBookings = await this.prisma.booking.count({
      where: {
        businessId,
        createdAt: { gte: prevStart, lte: prevEnd },
        status: 'COMPLETED',
        ...(staffId ? { staffId } : {}),
      },
    });

    const prevRevenueData = await this.prisma.booking.findMany({
      where: {
        businessId,
        createdAt: { gte: prevStart, lte: prevEnd },
        status: 'COMPLETED',
        ...(staffId ? { staffId } : {}),
      },
      include: { service: { select: { price: true } } },
    });

    const prevRevenue = prevRevenueData.reduce((sum, b) => sum + b.service.price, 0);
    const revenueChange =
      prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      bookingCount: bookings.length,
      avgPerBooking:
        bookings.length > 0 ? Math.round((totalRevenue / bookings.length) * 100) / 100 : 0,
      revenueChange,
      byService: Object.values(byService).sort((a, b) => b.revenue - a.revenue),
      byStaff: Object.values(byStaff).sort((a, b) => b.revenue - a.revenue),
    };
  }

  async staffUtilization(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter.gte = since;
    }

    const staff = await this.prisma.staff.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true },
    });

    const bookings = await this.prisma.booking.findMany({
      where: { businessId, startTime: dateFilter, staffId: { not: null } },
      select: { staffId: true, startTime: true, endTime: true, status: true },
    });

    const periodDays = Math.max(
      1,
      Math.ceil(
        ((endDate || new Date()).getTime() - (startDate || dateFilter.gte).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const availableHoursPerDay = 8;
    const totalAvailableHours = availableHoursPerDay * periodDays;

    return staff
      .map((s) => {
        const staffBookings = bookings.filter((b) => b.staffId === s.id);
        const bookedMinutes = staffBookings.reduce((sum, b) => {
          return sum + (b.endTime.getTime() - b.startTime.getTime()) / 60000;
        }, 0);
        const bookedHours = Math.round((bookedMinutes / 60) * 10) / 10;
        const completed = staffBookings.filter((b) => b.status === 'COMPLETED').length;
        const noShows = staffBookings.filter((b) => b.status === 'NO_SHOW').length;

        return {
          staffId: s.id,
          name: s.name,
          totalBookings: staffBookings.length,
          completed,
          noShows,
          bookedHours,
          availableHours: totalAvailableHours,
          utilization:
            totalAvailableHours > 0 ? Math.round((bookedHours / totalAvailableHours) * 100) : 0,
        };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }

  async clientMetrics(businessId: string, days: number = 30, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter.gte = since;
    }

    // New customers in period
    const newCustomers = await this.prisma.customer.count({
      where: { businessId, createdAt: dateFilter },
    });

    // Returning customers: had bookings before AND during the period
    const bookingsInPeriod = await this.prisma.booking.findMany({
      where: { businessId, startTime: dateFilter },
      select: { customerId: true },
    });

    const uniqueCustomerIds = [...new Set(bookingsInPeriod.map((b) => b.customerId))];

    let returningCount = 0;
    if (uniqueCustomerIds.length > 0) {
      const customersWithPriorBookings = await this.prisma.booking.groupBy({
        by: ['customerId'],
        where: {
          businessId,
          customerId: { in: uniqueCustomerIds },
          startTime: { lt: startDate || dateFilter.gte },
        },
      });
      returningCount = customersWithPriorBookings.length;
    }

    const newBookingCustomers = uniqueCustomerIds.length - returningCount;

    // Top customers by revenue
    const completedBookings = await this.prisma.booking.findMany({
      where: { businessId, startTime: dateFilter, status: 'COMPLETED' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        service: { select: { price: true } },
      },
    });

    const customerRevenue: Record<
      string,
      { name: string; email: string; revenue: number; visits: number }
    > = {};
    for (const b of completedBookings) {
      const c = b.customer;
      if (!customerRevenue[c.id]) {
        customerRevenue[c.id] = { name: c.name, email: c.email || '', revenue: 0, visits: 0 };
      }
      customerRevenue[c.id].revenue += b.service.price;
      customerRevenue[c.id].visits++;
    }

    const topClients = Object.values(customerRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Total customers
    const totalCustomers = await this.prisma.customer.count({ where: { businessId } });

    return {
      totalCustomers,
      newCustomers,
      returningCustomers: returningCount,
      newBookingCustomers,
      retentionRate:
        uniqueCustomerIds.length > 0
          ? Math.round((returningCount / uniqueCustomerIds.length) * 100)
          : 0,
      topClients,
    };
  }

  async communicationMetrics(
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

    const conversations = await this.prisma.conversation.findMany({
      where: { businessId, createdAt: dateFilter },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    let totalResponseTime = 0;
    let responseCount = 0;
    const dailyResponseTimes: Record<string, { total: number; count: number }> = {};
    let withinSla = 0; // under 15 min

    for (const conv of conversations) {
      let lastInbound: Date | null = null;
      for (const msg of conv.messages) {
        if (msg.direction === 'INBOUND') {
          lastInbound = msg.createdAt;
        } else if (msg.direction === 'OUTBOUND' && lastInbound) {
          const diffMin = (msg.createdAt.getTime() - lastInbound.getTime()) / 60000;
          totalResponseTime += diffMin;
          responseCount++;
          if (diffMin <= 15) withinSla++;

          const date = lastInbound.toISOString().split('T')[0];
          if (!dailyResponseTimes[date]) {
            dailyResponseTimes[date] = { total: 0, count: 0 };
          }
          dailyResponseTimes[date].total += diffMin;
          dailyResponseTimes[date].count++;

          lastInbound = null;
        }
      }
    }

    const avgResponseMinutes =
      responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
    const slaRate = responseCount > 0 ? Math.round((withinSla / responseCount) * 100) : 100;

    const responseTimeTrend = Object.entries(dailyResponseTimes)
      .map(([date, d]) => ({
        date,
        avgMinutes: Math.round(d.total / d.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const totalConversations = conversations.length;

    return {
      totalConversations,
      totalMessages,
      avgResponseMinutes,
      slaRate,
      responseTimeTrend,
    };
  }
}

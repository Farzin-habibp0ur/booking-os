import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';

export interface WeeklyDigestData {
  businessName: string;
  bookingsThisWeek: number;
  bookingsLastWeek: number;
  bookingsDelta: number;
  revenueThisWeek: number;
  revenueLastWeek: number;
  revenueDelta: number;
  topServices: { name: string; count: number; revenue: number }[];
  upcomingToday: { serviceName: string; customerName: string; time: string }[];
}

@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Send weekly digest every Monday at 9:00 AM (server time).
   * Cron: minute(0) hour(9) dayOfMonth(*) month(*) dayOfWeek(1)
   */
  @Cron('0 9 * * 1')
  async sendWeeklyDigests(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const businesses = await this.prisma.business.findMany({
        include: {
          staff: { where: { role: 'ADMIN', isActive: true }, take: 1 },
        },
      });

      let sent = 0;
      let skipped = 0;

      for (const business of businesses) {
        // Check opt-out via packConfig
        const packConfig = (business.packConfig as Record<string, unknown>) || {};
        if (packConfig.weeklyDigestOptOut === true) {
          skipped++;
          continue;
        }

        const owner = business.staff[0];
        if (!owner) {
          skipped++;
          continue;
        }

        try {
          const digestData = await this.gatherDigestData(business.id, business.name);
          const html = this.buildDigestHtml(digestData);

          await this.emailService.send({
            to: owner.email,
            subject: `Weekly Digest - ${business.name}`,
            html: this.emailService.buildBrandedHtml(html),
          });

          sent++;
        } catch (err) {
          this.logger.warn(
            `Failed to send digest for business ${business.id}: ${(err as Error).message}`,
          );
        }
      }

      this.logger.log(`Weekly digest: sent ${sent}, skipped ${skipped}`);
    } catch (err) {
      this.logger.error(`Weekly digest cron failed: ${(err as Error).message}`);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Gather all digest data for a single business.
   */
  async gatherDigestData(businessId: string, businessName: string): Promise<WeeklyDigestData> {
    const now = new Date();

    // This week: Monday 00:00 to now
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    thisWeekStart.setHours(0, 0, 0, 0);

    // Last week: previous Monday 00:00 to previous Sunday 23:59:59
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    // Today boundaries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      bookingsThisWeek,
      bookingsLastWeek,
      revenueThisWeekData,
      revenueLastWeekData,
      topServicesData,
      upcomingTodayData,
    ] = await Promise.all([
      // Bookings this week
      this.prisma.booking.count({
        where: {
          businessId,
          startTime: { gte: thisWeekStart, lte: now },
        },
      }),
      // Bookings last week
      this.prisma.booking.count({
        where: {
          businessId,
          startTime: { gte: lastWeekStart, lte: lastWeekEnd },
        },
      }),
      // Revenue this week (completed bookings)
      this.prisma.booking.findMany({
        where: {
          businessId,
          startTime: { gte: thisWeekStart, lte: now },
          status: 'COMPLETED',
        },
        include: { service: { select: { price: true } } },
      }),
      // Revenue last week (completed bookings)
      this.prisma.booking.findMany({
        where: {
          businessId,
          startTime: { gte: lastWeekStart, lte: lastWeekEnd },
          status: 'COMPLETED',
        },
        include: { service: { select: { price: true } } },
      }),
      // Top services this week
      this.prisma.booking.findMany({
        where: {
          businessId,
          startTime: { gte: thisWeekStart, lte: now },
        },
        include: { service: { select: { name: true, price: true } } },
      }),
      // Upcoming bookings today
      this.prisma.booking.findMany({
        where: {
          businessId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        include: {
          service: { select: { name: true } },
          customer: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 10,
      }),
    ]);

    const revenueThisWeek = revenueThisWeekData.reduce((sum, b) => sum + b.service.price, 0);
    const revenueLastWeek = revenueLastWeekData.reduce((sum, b) => sum + b.service.price, 0);

    // Aggregate top services
    const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const b of topServicesData) {
      const name = b.service.name;
      if (!serviceMap[name]) {
        serviceMap[name] = { name, count: 0, revenue: 0 };
      }
      serviceMap[name].count++;
      serviceMap[name].revenue += b.service.price;
    }
    const topServices = Object.values(serviceMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Format upcoming bookings
    const upcomingToday = upcomingTodayData.map((b) => ({
      serviceName: b.service.name,
      customerName: b.customer.name,
      time: b.startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    }));

    const bookingsDelta =
      bookingsLastWeek > 0
        ? Math.round(((bookingsThisWeek - bookingsLastWeek) / bookingsLastWeek) * 100)
        : bookingsThisWeek > 0
          ? 100
          : 0;

    const revenueDelta =
      revenueLastWeek > 0
        ? Math.round(((revenueThisWeek - revenueLastWeek) / revenueLastWeek) * 100)
        : revenueThisWeek > 0
          ? 100
          : 0;

    return {
      businessName,
      bookingsThisWeek,
      bookingsLastWeek,
      bookingsDelta,
      revenueThisWeek: Math.round(revenueThisWeek * 100) / 100,
      revenueLastWeek: Math.round(revenueLastWeek * 100) / 100,
      revenueDelta,
      topServices,
      upcomingToday,
    };
  }

  /**
   * Build the HTML body for the weekly digest email.
   */
  buildDigestHtml(data: WeeklyDigestData): string {
    const bookingArrow = data.bookingsDelta >= 0 ? '&#9650;' : '&#9660;';
    const bookingColor = data.bookingsDelta >= 0 ? '#71907C' : '#EF4444';
    const revenueArrow = data.revenueDelta >= 0 ? '&#9650;' : '&#9660;';
    const revenueColor = data.revenueDelta >= 0 ? '#71907C' : '#EF4444';

    const topServicesRows =
      data.topServices.length > 0
        ? data.topServices
            .map(
              (s) =>
                `<tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">${s.name}</td>
              <td style="padding:8px 0;font-size:14px;color:#64748B;text-align:center;border-bottom:1px solid #F1F5F9;">${s.count}</td>
              <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1E293B;text-align:right;border-bottom:1px solid #F1F5F9;">$${s.revenue.toFixed(2)}</td>
            </tr>`,
            )
            .join('')
        : `<tr><td colspan="3" style="padding:12px 0;font-size:14px;color:#94A3B8;text-align:center;">No bookings this week</td></tr>`;

    const upcomingRows =
      data.upcomingToday.length > 0
        ? data.upcomingToday
            .map(
              (b) =>
                `<tr>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">${b.time}</td>
              <td style="padding:8px 0;font-size:14px;color:#1E293B;border-bottom:1px solid #F1F5F9;">${b.serviceName}</td>
              <td style="padding:8px 0;font-size:14px;color:#64748B;text-align:right;border-bottom:1px solid #F1F5F9;">${b.customerName}</td>
            </tr>`,
            )
            .join('')
        : `<tr><td colspan="3" style="padding:12px 0;font-size:14px;color:#94A3B8;text-align:center;">No upcoming bookings today</td></tr>`;

    return `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Weekly Digest</h2>
<p style="margin:0 0 24px 0;color:#64748B;">Here's how ${data.businessName} performed this week.</p>

<!-- Stats cards -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td width="48%" style="background-color:#F4F7F5;border-radius:12px;padding:20px;vertical-align:top;">
<p style="margin:0 0 4px 0;font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Bookings</p>
<p style="margin:0 0 4px 0;font-size:28px;font-weight:700;color:#1E293B;">${data.bookingsThisWeek}</p>
<p style="margin:0;font-size:13px;color:${bookingColor};">${bookingArrow} ${Math.abs(data.bookingsDelta)}% vs last week (${data.bookingsLastWeek})</p>
</td>
<td width="4%"></td>
<td width="48%" style="background-color:#F5F3FA;border-radius:12px;padding:20px;vertical-align:top;">
<p style="margin:0 0 4px 0;font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Revenue</p>
<p style="margin:0 0 4px 0;font-size:28px;font-weight:700;color:#1E293B;">$${data.revenueThisWeek.toFixed(2)}</p>
<p style="margin:0;font-size:13px;color:${revenueColor};">${revenueArrow} ${Math.abs(data.revenueDelta)}% vs last week ($${data.revenueLastWeek.toFixed(2)})</p>
</td>
</tr>
</table>

<!-- Top services -->
<h3 style="margin:0 0 12px 0;font-size:16px;color:#1E293B;">Top Services</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td style="padding:8px 0;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E2E8F0;">Service</td>
<td style="padding:8px 0;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border-bottom:2px solid #E2E8F0;">Bookings</td>
<td style="padding:8px 0;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border-bottom:2px solid #E2E8F0;">Revenue</td>
</tr>
${topServicesRows}
</table>

<!-- Upcoming today -->
<h3 style="margin:0 0 12px 0;font-size:16px;color:#1E293B;">Upcoming Today</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td style="padding:8px 0;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E2E8F0;">Time</td>
<td style="padding:8px 0;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E2E8F0;">Service</td>
<td style="padding:8px 0;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border-bottom:2px solid #E2E8F0;">Customer</td>
</tr>
${upcomingRows}
</table>

<p style="margin:0;font-size:13px;color:#94A3B8;">You can opt out of these emails in your business settings.</p>`;
  }
}

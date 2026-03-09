import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BillingLifecycleService {
  private readonly logger = new Logger(BillingLifecycleService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  /** Daily check for annual renewals within 30 days */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkAnnualRenewals() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyOneDaysFromNow = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: {
          gte: thirtyDaysFromNow,
          lt: thirtyOneDaysFromNow,
        },
      },
      include: {
        business: {
          include: {
            staff: { where: { role: 'ADMIN' }, take: 1 },
            _count: { select: { bookings: true, customers: true } },
          },
        },
      },
    });

    const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');

    for (const sub of subscriptions) {
      const staff = sub.business?.staff?.[0];
      if (!staff?.email) continue;

      try {
        const renewDate = sub.currentPeriodEnd.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        await this.emailService.sendGeneric(staff.email, {
          subject: `Your annual subscription renews on ${renewDate}`,
          headline: 'Annual Renewal Reminder',
          body: `Your Booking OS subscription renews on ${renewDate}. Here's your year in review: ${sub.business?._count?.bookings || 0} bookings managed, ${sub.business?._count?.customers || 0} customers served. Thank you for being a valued customer!`,
          ctaLabel: 'View Billing',
          ctaUrl: `${webUrl}/settings/billing`,
        });
        this.logger.log(`Sent renewal reminder to business ${sub.businessId}`);
      } catch (err) {
        this.logger.warn(
          `Failed to send renewal reminder for business ${sub.businessId}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Daily check for account anniversaries */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async checkAccountAnniversaries() {
    const now = new Date();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    // Find businesses created on this day in a previous year
    const businesses = await this.prisma.business.findMany({
      where: {
        createdAt: { lt: new Date(now.getFullYear(), todayMonth, todayDay) },
      },
      include: {
        staff: { where: { role: 'ADMIN' }, take: 1 },
        _count: { select: { bookings: true, customers: true } },
      },
    });

    const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');

    for (const biz of businesses) {
      const createdDate = biz.createdAt;
      if (createdDate.getMonth() !== todayMonth || createdDate.getDate() !== todayDay) continue;

      const years = now.getFullYear() - createdDate.getFullYear();
      if (years < 1) continue;

      const staff = biz.staff?.[0];
      if (!staff?.email) continue;

      try {
        await this.emailService.sendGeneric(staff.email, {
          subject: `Happy ${years} year${years > 1 ? 's' : ''} with Booking OS!`,
          headline: `Happy Anniversary! 🎉`,
          body: `It's been ${years} year${years > 1 ? 's' : ''} since you joined Booking OS. Here's what you've achieved: ${biz._count?.bookings || 0} bookings managed, ${biz._count?.customers || 0} customers served. Thank you for being part of our journey!`,
          ctaLabel: 'View Dashboard',
          ctaUrl: `${webUrl}/dashboard`,
        });
        this.logger.log(`Sent anniversary email to business ${biz.id} (${years} years)`);
      } catch (err) {
        this.logger.warn(
          `Failed to send anniversary email for business ${biz.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}

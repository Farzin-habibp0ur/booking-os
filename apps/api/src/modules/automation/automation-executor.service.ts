import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);
  private processing = false;

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async executeRules() {
    if (this.processing) return;
    this.processing = true;
    try {
      const rules = await this.prisma.automationRule.findMany({
        where: { isActive: true },
      });

      for (const rule of rules) {
        try {
          await this.processRule(rule);
        } catch (err: any) {
          this.logger.error(`Automation rule ${rule.id} failed: ${err.message}`);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async processRule(rule: any) {
    // Check quiet hours
    if (this.isQuietHours(rule.quietStart, rule.quietEnd)) return;

    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const filters = rule.filters || {};
    const actions = (rule.actions || []) as any[];

    switch (rule.trigger) {
      case 'BOOKING_CREATED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            createdAt: { gte: twoMinutesAgo },
          },
          include: { customer: true, service: true },
        });
        for (const booking of bookings) {
          await this.executeActions(
            rule,
            actions,
            booking.businessId,
            booking.id,
            booking.customerId,
          );
        }
        break;
      }
      case 'BOOKING_UPCOMING': {
        const hoursBefore = filters.hoursBefore || 24;
        const windowStart = new Date(now.getTime() + (hoursBefore - 1) * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            startTime: { gte: windowStart, lt: windowEnd },
            status: { in: ['CONFIRMED', 'PENDING_DEPOSIT'] },
          },
        });
        for (const booking of bookings) {
          await this.executeActions(
            rule,
            actions,
            booking.businessId,
            booking.id,
            booking.customerId,
          );
        }
        break;
      }
      case 'STATUS_CHANGED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            updatedAt: { gte: twoMinutesAgo },
            ...(filters.newStatus && { status: filters.newStatus }),
          },
          include: { service: true },
        });
        for (const booking of bookings) {
          if (filters.serviceKind && booking.service?.kind !== filters.serviceKind) continue;
          await this.executeActions(
            rule,
            actions,
            booking.businessId,
            booking.id,
            booking.customerId,
          );
        }
        break;
      }
      case 'BOOKING_CANCELLED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            status: 'CANCELLED',
            updatedAt: { gte: twoMinutesAgo },
          },
        });
        for (const booking of bookings) {
          await this.executeActions(
            rule,
            actions,
            booking.businessId,
            booking.id,
            booking.customerId,
          );
        }
        break;
      }
      default:
        break;
    }
  }

  private async executeActions(
    rule: any,
    actions: any[],
    businessId: string,
    bookingId?: string,
    customerId?: string,
  ) {
    // Check frequency cap
    if (customerId && rule.maxPerCustomerPerDay > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = await this.prisma.automationLog.count({
        where: {
          automationRuleId: rule.id,
          customerId,
          createdAt: { gte: today },
        },
      });
      if (todayCount >= rule.maxPerCustomerPerDay) {
        await this.logAction(
          rule,
          businessId,
          bookingId,
          customerId,
          'FREQUENCY_CAP',
          'SKIPPED',
          'Daily limit reached',
        );
        return;
      }
    }

    for (const action of actions) {
      try {
        // For now, log the action; real implementation would call notification service
        await this.logAction(rule, businessId, bookingId, customerId, action.type, 'SENT');
      } catch (err: any) {
        await this.logAction(
          rule,
          businessId,
          bookingId,
          customerId,
          action.type,
          'FAILED',
          err.message,
        );
      }
    }
  }

  private async logAction(
    rule: any,
    businessId: string,
    bookingId?: string,
    customerId?: string,
    action?: string,
    outcome?: string,
    reason?: string,
  ) {
    await this.prisma.automationLog.create({
      data: {
        automationRuleId: rule.id,
        businessId,
        bookingId: bookingId || null,
        customerId: customerId || null,
        action: action || 'UNKNOWN',
        outcome: outcome || 'SENT',
        reason: reason || null,
      },
    });
  }

  isQuietHours(quietStart?: string | null, quietEnd?: string | null): boolean {
    if (!quietStart || !quietEnd) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    // Overnight quiet hours (e.g., 21:00 - 09:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

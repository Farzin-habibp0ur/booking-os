import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

const BUILT_IN_PLAYBOOKS = [
  {
    id: 'playbook-no-show-prevention',
    name: 'No-Show Prevention',
    description: 'Send deposit reminder 2h before and confirmation 24h before appointment',
    trigger: 'BOOKING_UPCOMING',
    filters: { hoursBefore: 24 },
    actions: [{ type: 'SEND_TEMPLATE', category: 'BOOKING_CONFIRMATION' }],
    playbook: 'no-show-prevention',
  },
  {
    id: 'playbook-consult-conversion',
    name: 'Consult Conversion',
    description: 'Follow up 3 days after consult, send testimonial after treatment',
    trigger: 'STATUS_CHANGED',
    filters: { newStatus: 'COMPLETED', serviceKind: 'CONSULT' },
    actions: [{ type: 'SEND_TEMPLATE', category: 'CONSULT_FOLLOW_UP', delayHours: 72 }],
    playbook: 'consult-conversion',
  },
  {
    id: 'playbook-re-engagement',
    name: 'Re-engagement',
    description: 'Message customers with no booking in 30 days',
    trigger: 'NO_RESPONSE',
    filters: { daysSinceLastBooking: 30 },
    actions: [{ type: 'SEND_TEMPLATE', category: 'RE_ENGAGEMENT' }],
    playbook: 're-engagement',
  },
];

@Injectable()
export class AutomationService {
  constructor(private prisma: PrismaService) {}

  getPlaybooks() {
    return BUILT_IN_PLAYBOOKS;
  }

  async getActivePlaybooks(businessId: string) {
    const rules = await this.prisma.automationRule.findMany({
      where: { businessId, playbook: { not: null } },
      select: { playbook: true, isActive: true },
    });

    return BUILT_IN_PLAYBOOKS.map((pb) => {
      const rule = rules.find((r) => r.playbook === pb.playbook);
      return { ...pb, isActive: rule?.isActive ?? false, installed: !!rule };
    });
  }

  async togglePlaybook(businessId: string, playbookId: string) {
    const playbook = BUILT_IN_PLAYBOOKS.find((p) => p.playbook === playbookId);
    if (!playbook) throw new NotFoundException('Playbook not found');

    const existing = await this.prisma.automationRule.findFirst({
      where: { businessId, playbook: playbookId },
    });

    if (existing) {
      return this.prisma.automationRule.update({
        where: { id: existing.id },
        data: { isActive: !existing.isActive },
      });
    }

    return this.prisma.automationRule.create({
      data: {
        businessId,
        name: playbook.name,
        trigger: playbook.trigger,
        filters: playbook.filters,
        actions: playbook.actions,
        playbook: playbookId,
        isActive: true,
      },
    });
  }

  async createRule(
    businessId: string,
    data: {
      name: string;
      trigger: string;
      filters?: any;
      actions?: any;
      quietStart?: string;
      quietEnd?: string;
      maxPerCustomerPerDay?: number;
    },
  ) {
    return this.prisma.automationRule.create({
      data: {
        businessId,
        name: data.name,
        trigger: data.trigger,
        filters: data.filters || {},
        actions: data.actions || [],
        quietStart: data.quietStart,
        quietEnd: data.quietEnd,
        maxPerCustomerPerDay: data.maxPerCustomerPerDay || 3,
      },
    });
  }

  async getRules(businessId: string) {
    return this.prisma.automationRule.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRule(businessId: string, id: string, data: any) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, businessId } });
    if (!rule) throw new NotFoundException('Rule not found');
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.filters !== undefined && { filters: data.filters }),
        ...(data.actions !== undefined && { actions: data.actions }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.quietStart !== undefined && { quietStart: data.quietStart }),
        ...(data.quietEnd !== undefined && { quietEnd: data.quietEnd }),
        ...(data.maxPerCustomerPerDay !== undefined && {
          maxPerCustomerPerDay: data.maxPerCustomerPerDay,
        }),
      },
    });
  }

  async deleteRule(businessId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, businessId } });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.prisma.automationRule.delete({ where: { id } });
    return { deleted: true };
  }

  async getLogs(
    businessId: string,
    query: {
      ruleId?: string;
      page?: number;
      pageSize?: number;
      search?: string;
      outcome?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId };
    if (query.ruleId) where.automationRuleId = query.ruleId;
    if (query.outcome) where.outcome = query.outcome;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { rule: { name: { contains: query.search, mode: 'insensitive' } } },
        { action: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.automationLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          rule: { select: { name: true } },
        },
      }),
      this.prisma.automationLog.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getPlaybookStats(businessId: string, playbookId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { businessId, playbook: playbookId },
      select: { id: true },
    });

    if (!rule) {
      return { sent: 0, skipped: 0, failed: 0, total: 0, lastRun: null };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await this.prisma.automationLog.groupBy({
      by: ['outcome'],
      where: {
        automationRuleId: rule.id,
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { outcome: true },
    });

    const lastLog = await this.prisma.automationLog.findFirst({
      where: { automationRuleId: rule.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const stats = { sent: 0, skipped: 0, failed: 0, total: 0, lastRun: lastLog?.createdAt || null };
    for (const group of logs) {
      const count = group._count.outcome;
      stats.total += count;
      if (group.outcome === 'SENT') stats.sent = count;
      else if (group.outcome === 'SKIPPED') stats.skipped = count;
      else if (group.outcome === 'FAILED') stats.failed = count;
    }

    return stats;
  }

  async testRule(businessId: string, ruleId: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) throw new NotFoundException('Rule not found');

    const filters = (rule.filters || {}) as any;
    const now = new Date();
    let matchedBookings: any[] = [];
    const skippedReasons: { bookingId: string; reason: string }[] = [];

    switch (rule.trigger) {
      case 'BOOKING_CREATED': {
        const recent = await this.prisma.booking.findMany({
          where: { businessId, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
          include: { customer: { select: { name: true } }, service: { select: { name: true } } },
          take: 20,
        });
        matchedBookings = recent;
        break;
      }
      case 'BOOKING_UPCOMING': {
        const hoursBefore = filters.hoursBefore || 24;
        const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId,
            startTime: { gte: now, lt: windowEnd },
            status: { in: ['CONFIRMED', 'PENDING_DEPOSIT'] },
          },
          include: { customer: { select: { name: true } }, service: { select: { name: true } } },
          take: 20,
        });
        matchedBookings = bookings;
        break;
      }
      case 'STATUS_CHANGED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId,
            updatedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            ...(filters.newStatus && { status: filters.newStatus }),
          },
          include: {
            customer: { select: { name: true } },
            service: { select: { name: true, kind: true } },
          },
          take: 20,
        });
        for (const b of bookings) {
          if (filters.serviceKind && (b.service as any)?.kind !== filters.serviceKind) {
            skippedReasons.push({
              bookingId: b.id,
              reason: `Service kind mismatch (expected ${filters.serviceKind})`,
            });
          } else {
            matchedBookings.push(b);
          }
        }
        break;
      }
      case 'BOOKING_CANCELLED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId,
            status: 'CANCELLED',
            updatedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
          include: { customer: { select: { name: true } }, service: { select: { name: true } } },
          take: 20,
        });
        matchedBookings = bookings;
        break;
      }
    }

    return {
      rule: { id: rule.id, name: rule.name, trigger: rule.trigger },
      dryRun: true,
      matchedCount: matchedBookings.length,
      matchedBookings: matchedBookings.map((b) => ({
        id: b.id,
        customerName: b.customer?.name || 'Unknown',
        serviceName: b.service?.name || 'Unknown',
        startTime: b.startTime,
        status: b.status,
      })),
      skipped: skippedReasons,
      message:
        matchedBookings.length > 0
          ? `Rule "${rule.name}" would match ${matchedBookings.length} booking(s) in the last 24 hours`
          : `Rule "${rule.name}" would not match any bookings right now`,
    };
  }
}

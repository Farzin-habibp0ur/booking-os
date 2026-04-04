import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
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
  {
    id: 'playbook-welcome-new-customer',
    name: 'Welcome New Customer',
    description: 'Send a welcome message when a new customer is created',
    trigger: 'CUSTOMER_CREATED',
    filters: {},
    actions: [
      {
        type: 'SEND_MESSAGE',
        body: "Welcome to {{business}}! We're excited to have you. Book your first appointment today.",
      },
    ],
    playbook: 'welcome-new-customer',
  },
  {
    id: 'playbook-post-treatment-testimonial',
    name: 'Post-Treatment Testimonial Request',
    description: 'Request a testimonial 3 days after treatment completion',
    trigger: 'STATUS_CHANGED',
    filters: { newStatus: 'COMPLETED', serviceKind: 'TREATMENT' },
    actions: [{ type: 'REQUEST_TESTIMONIAL', delayHours: 72 }],
    playbook: 'post-treatment-testimonial',
    vertical: 'AESTHETIC',
  },
  {
    id: 'playbook-birthday-greeting',
    name: 'Birthday / Anniversary',
    description: 'Send birthday greeting with a special offer',
    trigger: 'CUSTOMER_CREATED',
    filters: { isBirthday: true },
    actions: [
      {
        type: 'SEND_MESSAGE',
        body: 'Happy birthday {{name}}! Enjoy 15% off your next visit as our gift. Book now!',
      },
    ],
    playbook: 'birthday-greeting',
  },
];

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

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
    // Check for duplicate rule name within business
    const existing = await this.prisma.automationRule.findFirst({
      where: { businessId, name: data.name },
    });
    if (existing) {
      throw new BadRequestException(`An automation rule named "${data.name}" already exists`);
    }

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
          rule: {
            select: {
              name: true,
              steps: { select: { id: true, type: true, order: true }, orderBy: { order: 'asc' } },
            },
          },
        },
      }),
      this.prisma.automationLog.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // MED-13: Export activity log as CSV
  async exportActivityLog(
    businessId: string,
    query: { ruleId?: string; outcome?: string; dateFrom?: string; dateTo?: string },
  ): Promise<string> {
    const where: any = { businessId };
    if (query.ruleId) where.automationRuleId = query.ruleId;
    if (query.outcome) where.outcome = query.outcome;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const logs = await this.prisma.automationLog.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
      include: { rule: { select: { name: true } } },
    });

    const header = 'Date,Rule,Action,Outcome,Reason,Customer ID,Booking ID\n';
    const rows = logs.map((log) =>
      [
        log.createdAt.toISOString(),
        `"${(log.rule?.name || '').replace(/"/g, '""')}"`,
        log.action,
        log.outcome,
        `"${(log.reason || '').replace(/"/g, '""')}"`,
        log.customerId || '',
        log.bookingId || '',
      ].join(','),
    );

    return header + rows.join('\n');
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

  // ---- Step Management (P-13) ----

  async getSteps(businessId: string, ruleId: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) throw new NotFoundException('Rule not found');

    return this.prisma.automationStep.findMany({
      where: { automationRuleId: ruleId },
      orderBy: { order: 'asc' },
      include: { childSteps: { orderBy: { order: 'asc' } } },
    });
  }

  async setSteps(
    businessId: string,
    ruleId: string,
    steps: {
      order: number;
      type: string;
      config?: any;
      parentStepId?: string;
      branchLabel?: string;
    }[],
  ) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) throw new NotFoundException('Rule not found');

    return this.prisma.$transaction(async (tx) => {
      // Delete existing steps
      await tx.automationStep.deleteMany({ where: { automationRuleId: ruleId } });

      // Create new steps
      const created = [];
      for (const step of steps) {
        const s = await tx.automationStep.create({
          data: {
            automationRuleId: ruleId,
            order: step.order,
            type: step.type,
            config: step.config || {},
            parentStepId: step.parentStepId || null,
            branchLabel: step.branchLabel || null,
          },
        });
        created.push(s);
      }
      return created;
    });
  }

  async getExecutions(
    businessId: string,
    ruleId: string,
    query: { page?: number; pageSize?: number },
  ) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) throw new NotFoundException('Rule not found');

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const where = { automationRuleId: ruleId, businessId };
    const [data, total] = await Promise.all([
      this.prisma.automationExecution.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { step: true },
      }),
      this.prisma.automationExecution.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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

  // MED-12: Conflict detection
  async checkConflicts(businessId: string, trigger: string, filters: any, excludeRuleId?: string) {
    const existingRules = await this.prisma.automationRule.findMany({
      where: {
        businessId,
        trigger,
        isActive: true,
        ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
      },
      select: { id: true, name: true, trigger: true, filters: true },
    });

    const conflicts = existingRules.filter((rule) => {
      const ruleFilters = (rule.filters || {}) as Record<string, any>;
      const newFilters = filters || {};
      // Overlap: same trigger with no distinguishing filter values
      const ruleKeys = Object.keys(ruleFilters);
      const newKeys = Object.keys(newFilters);
      if (ruleKeys.length === 0 && newKeys.length === 0) return true;
      // If either has no filters, it catches everything
      if (ruleKeys.length === 0 || newKeys.length === 0) return true;
      // Check for matching filter values
      for (const key of newKeys) {
        if (ruleFilters[key] !== undefined && ruleFilters[key] === newFilters[key]) {
          return true;
        }
      }
      return false;
    });

    return conflicts.map((r) => ({
      id: r.id,
      name: r.name,
      trigger: r.trigger,
      overlap: 'Same trigger with overlapping filters',
    }));
  }

  // HIGH-07: Analytics overview
  async getAnalyticsOverview(businessId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalRulesActive, outcomes, topRule] = await Promise.all([
      this.prisma.automationRule.count({ where: { businessId, isActive: true } }),
      this.prisma.automationLog.groupBy({
        by: ['outcome'],
        where: { businessId, createdAt: { gte: sevenDaysAgo } },
        _count: true,
      }),
      this.prisma.automationLog.groupBy({
        by: ['automationRuleId'],
        where: { businessId, outcome: 'SENT', createdAt: { gte: sevenDaysAgo } },
        _count: true,
        orderBy: { _count: { automationRuleId: 'desc' } },
        take: 1,
      }),
    ]);

    const outcomeMap: Record<string, number> = {};
    for (const o of outcomes) {
      outcomeMap[o.outcome || 'UNKNOWN'] = o._count;
    }

    const sent = outcomeMap['SENT'] || 0;
    const skipped = outcomeMap['SKIPPED'] || 0;
    const failed = outcomeMap['FAILED'] || 0;

    let topPerformingRule = null;
    if (topRule.length > 0) {
      const rule = await this.prisma.automationRule.findUnique({
        where: { id: topRule[0].automationRuleId },
        select: { id: true, name: true },
      });
      topPerformingRule = { ...rule, sentCount: topRule[0]._count };
    }

    return {
      totalRulesActive,
      totalMessagesSent7d: sent,
      totalMessagesSkipped7d: skipped,
      totalMessagesFailed7d: failed,
      deliveryRate: sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 0,
      topPerformingRule,
    };
  }

  // HIGH-07: Analytics timeline
  async getAnalyticsTimeline(businessId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.prisma.automationLog.findMany({
      where: { businessId, createdAt: { gte: startDate } },
      select: { createdAt: true, outcome: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const daily: Record<string, { sent: number; skipped: number; failed: number }> = {};
    for (const log of logs) {
      const day = log.createdAt.toISOString().split('T')[0];
      if (!daily[day]) daily[day] = { sent: 0, skipped: 0, failed: 0 };
      const outcome = (log.outcome || '').toLowerCase();
      if (outcome === 'sent') daily[day].sent++;
      else if (outcome === 'skipped') daily[day].skipped++;
      else if (outcome === 'failed') daily[day].failed++;
    }

    return Object.entries(daily).map(([date, counts]) => ({ date, ...counts }));
  }

  // HIGH-07: Analytics by rule
  async getAnalyticsByRule(businessId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rules = await this.prisma.automationRule.findMany({
      where: { businessId },
      select: { id: true, name: true, trigger: true },
    });

    const logs = await this.prisma.automationLog.groupBy({
      by: ['automationRuleId', 'outcome'],
      where: { businessId, createdAt: { gte: sevenDaysAgo } },
      _count: true,
    });

    const ruleMap: Record<string, any> = {};
    for (const rule of rules) {
      ruleMap[rule.id] = {
        ruleId: rule.id,
        ruleName: rule.name,
        trigger: rule.trigger,
        sent: 0,
        skipped: 0,
        failed: 0,
      };
    }
    for (const log of logs) {
      const r = ruleMap[log.automationRuleId];
      if (!r) continue;
      const outcome = (log.outcome || '').toLowerCase();
      if (outcome === 'sent') r.sent += log._count;
      else if (outcome === 'skipped') r.skipped += log._count;
      else if (outcome === 'failed') r.failed += log._count;
    }

    return Object.values(ruleMap);
  }
}

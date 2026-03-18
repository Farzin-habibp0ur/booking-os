import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface CockpitContext {
  sections: ContextSection[];
  generatedAt: string;
}

export interface ContextSection {
  label: string;
  content: string;
}

@Injectable()
export class CockpitTasksContextService {
  private readonly logger = new Logger(CockpitTasksContextService.name);

  constructor(private prisma: PrismaService) {}

  async buildContext(businessId: string): Promise<CockpitContext> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const sections = await Promise.all([
      this.buildTodayBookings(businessId, todayStart, todayEnd),
      this.buildPendingActionCards(businessId),
      this.buildOverdueItems(businessId, now),
      this.buildWaitlistEntries(businessId),
      this.buildPendingQuotes(businessId),
      this.buildRecentEscalations(businessId, weekAgo),
      this.buildAgentActivity(businessId, weekAgo),
      this.buildStaffOverview(businessId),
      this.buildConversationBacklog(businessId),
      this.buildBookingTrends(businessId, todayStart, weekAgo),
    ]);

    return {
      sections: sections.filter((s) => s.content.length > 0),
      generatedAt: now.toISOString(),
    };
  }

  formatContextForPrompt(context: CockpitContext): string {
    return context.sections
      .map((s, i) => `## Section ${i + 1}: ${s.label}\n${s.content}`)
      .join('\n\n');
  }

  private async buildTodayBookings(
    businessId: string,
    todayStart: Date,
    todayEnd: Date,
  ): Promise<ContextSection> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        businessId,
        startTime: { gte: todayStart, lt: todayEnd },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMins: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 50,
    });

    if (bookings.length === 0) return { label: "Today's Bookings", content: '' };

    const lines = bookings.map((b) => {
      const time = b.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const staff = b.staff?.name || 'Unassigned';
      return `- [${b.status}] ${time} — ${b.service.name} for ${b.customer.name} (staff: ${staff}) [bookingId: ${b.id}]`;
    });

    return {
      label: "Today's Bookings",
      content: `${bookings.length} bookings today:\n${lines.join('\n')}`,
    };
  }

  private async buildPendingActionCards(businessId: string): Promise<ContextSection> {
    const cards = await this.prisma.actionCard.findMany({
      where: { businessId, status: 'PENDING' },
      include: {
        customer: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
        booking: { select: { id: true, startTime: true } },
      },
      orderBy: { priority: 'desc' },
      take: 30,
    });

    if (cards.length === 0) return { label: 'Pending Action Cards', content: '' };

    const lines = cards.map((c) => {
      const meta = c.metadata as Record<string, unknown>;
      const assignee = c.staff?.name || 'Unassigned';
      const customer = c.customer?.name || '';
      const sourceAgent = (meta?.sourceAgentId as string) || c.type;
      return `- [${c.category}|P${c.priority}] "${c.title}" — ${c.description} (assignee: ${assignee}, customer: ${customer}, source: ${sourceAgent}) [cardId: ${c.id}]`;
    });

    return {
      label: 'Pending Action Cards',
      content: `${cards.length} pending action cards:\n${lines.join('\n')}`,
    };
  }

  private async buildOverdueItems(businessId: string, now: Date): Promise<ContextSection> {
    const [overdueBookings, expiredCards] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          businessId,
          status: 'PENDING',
          startTime: { lt: now },
        },
        include: {
          customer: { select: { name: true } },
          service: { select: { name: true } },
          staff: { select: { name: true } },
        },
        take: 20,
      }),
      this.prisma.actionCard.findMany({
        where: {
          businessId,
          status: 'PENDING',
          expiresAt: { lt: now },
        },
        take: 20,
      }),
    ]);

    const lines: string[] = [];

    for (const b of overdueBookings) {
      const daysOverdue = Math.floor((now.getTime() - b.startTime.getTime()) / (24 * 60 * 60 * 1000));
      lines.push(
        `- OVERDUE BOOKING (${daysOverdue}d): ${b.service.name} for ${b.customer.name} — still PENDING (staff: ${b.staff?.name || 'Unassigned'}) [bookingId: ${b.id}]`,
      );
    }

    for (const c of expiredCards) {
      lines.push(`- EXPIRED ACTION CARD: "${c.title}" — should have been resolved by ${c.expiresAt?.toISOString()} [cardId: ${c.id}]`);
    }

    return {
      label: 'Overdue Items',
      content: lines.length > 0 ? `${lines.length} overdue items:\n${lines.join('\n')}` : '',
    };
  }

  private async buildWaitlistEntries(businessId: string): Promise<ContextSection> {
    const entries = await this.prisma.waitlistEntry.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        customer: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
      take: 20,
    });

    if (entries.length === 0) return { label: 'Active Waitlist', content: '' };

    const lines = entries.map((e) => {
      const dateRange =
        e.dateFrom && e.dateTo
          ? `${e.dateFrom.toISOString().split('T')[0]} to ${e.dateTo.toISOString().split('T')[0]}`
          : 'any date';
      return `- ${e.customer.name} waiting for ${e.service.name} (${dateRange}) [waitlistId: ${e.id}]`;
    });

    return {
      label: 'Active Waitlist',
      content: `${entries.length} waitlist entries:\n${lines.join('\n')}`,
    };
  }

  private async buildPendingQuotes(businessId: string): Promise<ContextSection> {
    const quotes = await this.prisma.quote.findMany({
      where: { businessId, status: 'PENDING' },
      include: {
        booking: {
          include: {
            customer: { select: { name: true } },
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    if (quotes.length === 0) return { label: 'Pending Quotes', content: '' };

    const now = new Date();
    const lines = quotes.map((q) => {
      const daysPending = Math.floor((now.getTime() - q.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      return `- $${q.totalAmount.toFixed(2)} for ${q.booking.customer.name} (${q.booking.service.name}) — pending ${daysPending}d [quoteId: ${q.id}]`;
    });

    return {
      label: 'Pending Quotes',
      content: `${quotes.length} quotes awaiting approval:\n${lines.join('\n')}`,
    };
  }

  private async buildRecentEscalations(businessId: string, since: Date): Promise<ContextSection> {
    const escalations = await this.prisma.escalationEvent.findMany({
      where: { businessId, createdAt: { gte: since }, isResolved: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (escalations.length === 0) return { label: 'Unresolved Escalations', content: '' };

    const lines = escalations.map((e) => {
      return `- [${e.severity}] ${e.title}: ${e.description || 'No details'} (trigger: ${e.triggerType}) [escalationId: ${e.id}]`;
    });

    return {
      label: 'Unresolved Escalations',
      content: `${escalations.length} unresolved escalations:\n${lines.join('\n')}`,
    };
  }

  private async buildAgentActivity(businessId: string, since: Date): Promise<ContextSection> {
    const runs = await this.prisma.agentRun.findMany({
      where: { businessId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    if (runs.length === 0) return { label: 'Agent Activity (7d)', content: '' };

    const failed = runs.filter((r) => r.status === 'FAILED');
    const completed = runs.filter((r) => r.status === 'COMPLETED');
    const totalCards = completed.reduce((sum, r) => sum + r.cardsCreated, 0);

    const lines: string[] = [
      `${completed.length} completed runs, ${failed.length} failed, ${totalCards} action cards created.`,
    ];

    if (failed.length > 0) {
      lines.push('Failed runs:');
      for (const f of failed.slice(0, 5)) {
        lines.push(`- ${f.agentType} at ${f.startedAt.toISOString()}: ${f.error || 'Unknown error'} [runId: ${f.id}]`);
      }
    }

    return {
      label: 'Agent Activity (7d)',
      content: lines.join('\n'),
    };
  }

  private async buildStaffOverview(businessId: string): Promise<ContextSection> {
    const staff = await this.prisma.staff.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, role: true },
    });

    if (staff.length === 0) return { label: 'Staff Overview', content: '' };

    const lines = staff.map((s) => `- ${s.name} (${s.role}) [staffId: ${s.id}]`);

    return {
      label: 'Staff Overview',
      content: `${staff.length} active staff:\n${lines.join('\n')}`,
    };
  }

  private async buildConversationBacklog(businessId: string): Promise<ContextSection> {
    const openConversations = await this.prisma.conversation.findMany({
      where: { businessId, status: { in: ['OPEN', 'WAITING'] } },
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { lastMessageAt: 'asc' },
      take: 20,
    });

    if (openConversations.length === 0) return { label: 'Conversation Backlog', content: '' };

    const now = new Date();
    const lines = openConversations.map((c) => {
      const lastMsg = c.lastMessageAt
        ? `${Math.floor((now.getTime() - c.lastMessageAt.getTime()) / (60 * 60 * 1000))}h ago`
        : 'no messages';
      const assignee = c.assignedTo?.name || 'Unassigned';
      return `- [${c.status}] ${c.customer.name} — last message ${lastMsg} (assigned: ${assignee}) [conversationId: ${c.id}]`;
    });

    return {
      label: 'Conversation Backlog',
      content: `${openConversations.length} open conversations:\n${lines.join('\n')}`,
    };
  }

  private async buildBookingTrends(
    businessId: string,
    todayStart: Date,
    weekAgo: Date,
  ): Promise<ContextSection> {
    const [thisWeekCount, cancelledCount, noShowCount] = await Promise.all([
      this.prisma.booking.count({
        where: {
          businessId,
          createdAt: { gte: weekAgo },
        },
      }),
      this.prisma.booking.count({
        where: {
          businessId,
          status: 'CANCELLED',
          updatedAt: { gte: weekAgo },
        },
      }),
      this.prisma.booking.count({
        where: {
          businessId,
          status: 'NO_SHOW',
          startTime: { gte: weekAgo },
        },
      }),
    ]);

    if (thisWeekCount === 0 && cancelledCount === 0 && noShowCount === 0) {
      return { label: 'Booking Trends (7d)', content: '' };
    }

    return {
      label: 'Booking Trends (7d)',
      content: `New bookings: ${thisWeekCount}, Cancellations: ${cancelledCount}, No-shows: ${noShowCount}`,
    };
  }
}

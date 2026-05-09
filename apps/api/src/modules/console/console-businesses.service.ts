import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

interface BusinessListQuery {
  search?: string;
  plan?: string;
  billingStatus?: string;
  vertical?: string;
  health?: string;
  page?: number;
  pageSize?: number;
}

interface UpdateBaselineInput {
  monthlyBookings?: number | null;
  monthlyRevenue?: number | string | null;
  capturedAt?: string | Date | null;
  notes?: string | null;
}

const PILOT_WINDOW_DAYS = 30;

@Injectable()
export class ConsoleBusinessesService {
  private readonly logger = new Logger(ConsoleBusinessesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(query: BusinessListQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        {
          staff: {
            some: {
              email: { contains: query.search, mode: 'insensitive' },
              role: 'ADMIN',
            },
          },
        },
      ];
    }

    if (query.vertical) {
      where.verticalPack = query.vertical;
    }

    if (query.plan || query.billingStatus) {
      where.subscription = {};
      if (query.plan) where.subscription.plan = query.plan;
      if (query.billingStatus) where.subscription.status = query.billingStatus;
    }

    const [businesses, total] = await Promise.all([
      this.prisma.business.findMany({
        where,
        include: {
          subscription: true,
          staff: {
            where: { role: 'ADMIN' },
            take: 1,
            select: { email: true, name: true },
          },
          _count: {
            select: { bookings: true, customers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.business.count({ where }),
    ]);

    // Compute health + last active for each
    const items = await Promise.all(
      businesses.map(async (biz) => {
        const lastBooking = await this.prisma.booking.findFirst({
          where: { businessId: biz.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const health = this.computeHealth(
          lastBooking?.createdAt || null,
          biz.subscription?.status || null,
        );

        return {
          id: biz.id,
          name: biz.name,
          slug: biz.slug,
          timezone: biz.timezone,
          verticalPack: biz.verticalPack,
          createdAt: biz.createdAt,
          owner: biz.staff[0] || null,
          plan: biz.subscription?.plan || 'trial',
          billingStatus: biz.subscription?.status || null,
          health,
          lastActive: lastBooking?.createdAt || null,
          counts: biz._count,
        };
      }),
    );

    // Filter by health if requested (post-query since it's computed)
    const filtered = query.health ? items.filter((item) => item.health === query.health) : items;

    return {
      items: filtered,
      total: query.health ? filtered.length : total,
      page,
      pageSize,
    };
  }

  async findById(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        subscription: true,
        staff: {
          where: { role: 'ADMIN' },
          take: 1,
          select: { email: true, name: true },
        },
        _count: {
          select: {
            bookings: true,
            customers: true,
            conversations: true,
            staff: true,
            services: true,
            campaigns: true,
            waitlistEntries: true,
          },
        },
      },
    });

    if (!business) throw new NotFoundException('Business not found');

    const lastBooking = await this.prisma.booking.findFirst({
      where: { businessId: id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const health = this.computeHealth(
      lastBooking?.createdAt || null,
      business.subscription?.status || null,
    );

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      timezone: business.timezone,
      verticalPack: business.verticalPack,
      packConfig: business.packConfig,
      defaultLocale: business.defaultLocale,
      createdAt: business.createdAt,
      owner: business.staff[0] || null,
      subscription: business.subscription
        ? {
            plan: business.subscription.plan,
            status: business.subscription.status,
            currentPeriodEnd: business.subscription.currentPeriodEnd,
          }
        : null,
      health,
      lastActive: lastBooking?.createdAt || null,
      counts: business._count,
    };
  }

  async getStaff(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const staff = await this.prisma.staff.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return staff;
  }

  async getUsageSnapshot(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [bookings7d, bookings30d, conversations, waitlistEntries, campaigns, agentRuns] =
      await Promise.all([
        this.prisma.booking.count({
          where: { businessId, createdAt: { gte: sevenDaysAgo } },
        }),
        this.prisma.booking.count({
          where: { businessId, createdAt: { gte: thirtyDaysAgo } },
        }),
        this.prisma.conversation.count({ where: { businessId } }),
        this.prisma.waitlistEntry.count({
          where: { businessId, status: 'ACTIVE' },
        }),
        this.prisma.campaign.count({
          where: { businessId, status: 'SENT' },
        }),
        this.prisma.agentRun.count({
          where: { businessId, startedAt: { gte: sevenDaysAgo } },
        }),
      ]);

    return {
      bookings7d,
      bookings30d,
      conversations,
      waitlistEntries,
      campaigns,
      agentRuns,
    };
  }

  computeHealth(lastActive: Date | null, billingStatus: string | null): string {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (billingStatus === 'canceled') return 'red';
    if (!lastActive || lastActive < thirtyDaysAgo) return 'red';
    if (billingStatus === 'past_due') return 'yellow';
    if (lastActive < sevenDaysAgo) return 'yellow';
    return 'green';
  }

  /**
   * Concierge-call baseline: pre-pilot monthly bookings + revenue captured by founder.
   */
  async getBaseline(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        baselineMonthlyBookings: true,
        baselineMonthlyRevenue: true,
        baselineCapturedAt: true,
        baselineSource: true,
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    return {
      monthlyBookings: business.baselineMonthlyBookings,
      monthlyRevenue:
        business.baselineMonthlyRevenue == null ? null : Number(business.baselineMonthlyRevenue),
      capturedAt: business.baselineCapturedAt,
      source: business.baselineSource,
    };
  }

  async updateBaseline(businessId: string, input: UpdateBaselineInput) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const data: Record<string, unknown> = {
      baselineSource: 'concierge_call',
    };

    if (input.monthlyBookings !== undefined) {
      data.baselineMonthlyBookings =
        input.monthlyBookings === null
          ? null
          : Math.max(0, Math.floor(Number(input.monthlyBookings))) || 0;
    }

    if (input.monthlyRevenue !== undefined) {
      if (input.monthlyRevenue === null || input.monthlyRevenue === '') {
        data.baselineMonthlyRevenue = null;
      } else {
        const value = Number(input.monthlyRevenue);
        if (!Number.isFinite(value) || value < 0) {
          throw new BadRequestException('monthlyRevenue must be a non-negative number');
        }
        data.baselineMonthlyRevenue = value;
      }
    }

    if (input.capturedAt !== undefined) {
      data.baselineCapturedAt =
        input.capturedAt === null || input.capturedAt === ''
          ? new Date()
          : new Date(input.capturedAt);
    } else {
      data.baselineCapturedAt = new Date();
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data,
      select: {
        baselineMonthlyBookings: true,
        baselineMonthlyRevenue: true,
        baselineCapturedAt: true,
        baselineSource: true,
      },
    });

    return {
      monthlyBookings: updated.baselineMonthlyBookings,
      monthlyRevenue:
        updated.baselineMonthlyRevenue == null ? null : Number(updated.baselineMonthlyRevenue),
      capturedAt: updated.baselineCapturedAt,
      source: updated.baselineSource,
    };
  }

  /**
   * Pilot health snapshot for a single business. Bypasses TenantGuard (SUPER_ADMIN only).
   * Pilot start = OWNER staff createdAt; window = next 30 days.
   */
  async getPilotHealth(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        baselineMonthlyBookings: true,
        baselineMonthlyRevenue: true,
        baselineCapturedAt: true,
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    const owner = await this.prisma.staff.findFirst({
      where: { businessId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });

    const pilotStart = owner?.createdAt || null;
    const now = new Date();
    const daysIntoPilot = pilotStart
      ? Math.max(0, Math.floor((now.getTime() - pilotStart.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;
    const windowStart = pilotStart || now;
    const windowEnd = pilotStart
      ? new Date(pilotStart.getTime() + PILOT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      : now;
    const windowEndCapped = windowEnd > now ? now : windowEnd;

    const [
      messagesHandled,
      draftsApproved,
      responseMessages,
      capturedAttributions,
      missedAttributions,
    ] = await Promise.all([
      this.prisma.message.count({
        where: {
          direction: 'INBOUND',
          createdAt: { gte: windowStart, lte: windowEndCapped },
          conversation: { businessId },
        },
      }),
      this.prisma.outboundDraft.count({
        where: {
          businessId,
          status: { in: ['APPROVED', 'SENT'] },
          createdAt: { gte: windowStart, lte: windowEndCapped },
        },
      }),
      this.prisma.message.findMany({
        where: {
          createdAt: { gte: windowStart, lte: windowEndCapped },
          conversation: { businessId },
        },
        orderBy: { createdAt: 'asc' },
        take: 3000,
        select: {
          conversationId: true,
          direction: true,
          createdAt: true,
        },
      }),
      this.prisma.frontDeskAttribution.findMany({
        where: {
          businessId,
          voidedAt: null,
          wouldHaveBeenMissed: false,
          createdAt: { gte: windowStart, lte: windowEndCapped },
        },
        select: { revenueAtBooking: true, estimatedValue: true },
      }),
      this.prisma.frontDeskAttribution.findMany({
        where: {
          businessId,
          voidedAt: null,
          wouldHaveBeenMissed: true,
          createdAt: { gte: windowStart, lte: windowEndCapped },
        },
        select: { revenueAtBooking: true, estimatedValue: true },
      }),
    ]);

    const captured = {
      count: capturedAttributions.length,
      revenue:
        Math.round(
          capturedAttributions.reduce(
            (sum, row) => sum + Number(row.revenueAtBooking ?? row.estimatedValue ?? 0),
            0,
          ) * 100,
        ) / 100,
    };
    const wouldHaveBeenMissed = {
      count: missedAttributions.length,
      revenue:
        Math.round(
          missedAttributions.reduce(
            (sum, row) => sum + Number(row.revenueAtBooking ?? row.estimatedValue ?? 0),
            0,
          ) * 100,
        ) / 100,
    };

    const baseline = {
      monthlyBookings: business.baselineMonthlyBookings,
      monthlyRevenue:
        business.baselineMonthlyRevenue == null ? null : Number(business.baselineMonthlyRevenue),
      capturedAt: business.baselineCapturedAt,
    };

    const totalBookings = captured.count + wouldHaveBeenMissed.count;
    const messagesTarget = 10;
    const baselineBookings = baseline.monthlyBookings;
    const bookingsTarget = Math.max(5, baselineBookings ? Math.round(baselineBookings / 12) : 0);

    return {
      daysIntoPilot,
      messagesHandled,
      draftsApproved,
      responseTimeMedianMinutes: this.medianFirstResponseMinutes(responseMessages),
      captured,
      wouldHaveBeenMissed,
      baseline,
      scorecard: {
        messagesHandled: {
          value: messagesHandled,
          target: messagesTarget,
          met: messagesHandled >= messagesTarget,
        },
        bookings: {
          value: totalBookings,
          target: bookingsTarget,
          met: totalBookings >= bookingsTarget,
        },
        continuationLogged: false,
      },
    };
  }

  private medianFirstResponseMinutes(
    messages: Array<{ conversationId: string; direction: string; createdAt: Date }>,
  ): number | null {
    const byConversation = new Map<string, { inbound?: Date; outbound?: Date }>();

    for (const message of messages) {
      const state = byConversation.get(message.conversationId) || {};
      if (message.direction === 'INBOUND' && !state.inbound) {
        state.inbound = message.createdAt;
      }
      if (
        message.direction === 'OUTBOUND' &&
        state.inbound &&
        message.createdAt > state.inbound &&
        !state.outbound
      ) {
        state.outbound = message.createdAt;
      }
      byConversation.set(message.conversationId, state);
    }

    const responseMinutes = Array.from(byConversation.values())
      .filter((state) => state.inbound && state.outbound)
      .map((state) => (state.outbound!.getTime() - state.inbound!.getTime()) / 60000)
      .sort((a, b) => a - b);

    if (responseMinutes.length === 0) return null;
    const mid = Math.floor(responseMinutes.length / 2);
    const median =
      responseMinutes.length % 2 === 0
        ? (responseMinutes[mid - 1] + responseMinutes[mid]) / 2
        : responseMinutes[mid];
    return Math.round(median * 10) / 10;
  }
}

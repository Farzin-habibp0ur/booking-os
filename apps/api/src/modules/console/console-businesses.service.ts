import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
}

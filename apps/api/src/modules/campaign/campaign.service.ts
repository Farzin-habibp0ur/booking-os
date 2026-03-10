import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CampaignDispatchService } from './campaign-dispatch.service';

@Injectable()
export class CampaignService {
  constructor(
    private prisma: PrismaService,
    private dispatchService: CampaignDispatchService,
  ) {}

  async create(
    businessId: string,
    data: {
      name: string;
      templateId?: string;
      filters?: any;
      scheduledAt?: string;
      recurrenceRule?: string;
      isABTest?: boolean;
      variants?: any[];
    },
  ) {
    // Validate A/B test variants
    if (data.isABTest) {
      this.validateVariants(data.variants);
    }

    const recurrenceRule = data.recurrenceRule || 'NONE';
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    return this.prisma.campaign.create({
      data: {
        businessId,
        name: data.name,
        templateId: data.templateId || null,
        filters: data.filters || {},
        scheduledAt,
        status: 'DRAFT',
        recurrenceRule,
        nextRunAt:
          recurrenceRule !== 'NONE' && scheduledAt
            ? this.computeNextRun(scheduledAt, recurrenceRule)
            : null,
        isABTest: data.isABTest || false,
        variants: data.isABTest && data.variants ? data.variants : [],
      },
    });
  }

  async findAll(businessId: string, query: { status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(businessId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, businessId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(
    businessId: string,
    id: string,
    data: {
      name?: string;
      templateId?: string;
      filters?: any;
      scheduledAt?: string;
      throttlePerMinute?: number;
      recurrenceRule?: string;
      isABTest?: boolean;
      variants?: any[];
    },
  ) {
    const campaign = await this.findById(businessId, id);
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Only draft campaigns can be edited');
    }
    // Validate A/B test variants if updating
    if (data.isABTest !== undefined || data.variants !== undefined) {
      const isAB = data.isABTest ?? (campaign as any).isABTest;
      if (isAB) {
        this.validateVariants(data.variants ?? (campaign as any).variants);
      }
    }

    const updateData: any = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.templateId !== undefined && { templateId: data.templateId }),
      ...(data.filters !== undefined && { filters: data.filters }),
      ...(data.scheduledAt !== undefined && { scheduledAt: new Date(data.scheduledAt) }),
      ...(data.throttlePerMinute !== undefined && { throttlePerMinute: data.throttlePerMinute }),
      ...(data.recurrenceRule !== undefined && { recurrenceRule: data.recurrenceRule }),
      ...(data.isABTest !== undefined && { isABTest: data.isABTest }),
      ...(data.variants !== undefined && { variants: data.variants }),
    };

    // Recompute nextRunAt if recurrence or schedule changed
    if (data.recurrenceRule !== undefined || data.scheduledAt !== undefined) {
      const rule = data.recurrenceRule ?? (campaign as any).recurrenceRule ?? 'NONE';
      const scheduled = data.scheduledAt
        ? new Date(data.scheduledAt)
        : (campaign as any).scheduledAt;
      updateData.nextRunAt =
        rule !== 'NONE' && scheduled ? this.computeNextRun(new Date(scheduled), rule) : null;
    }

    return this.prisma.campaign.update({ where: { id }, data: updateData });
  }

  async stopRecurrence(businessId: string, id: string) {
    const campaign = await this.findById(businessId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: { recurrenceRule: 'NONE', nextRunAt: null },
    });
  }

  async delete(businessId: string, id: string) {
    const campaign = await this.findById(businessId, id);
    if (!['DRAFT', 'CANCELLED'].includes(campaign.status)) {
      throw new BadRequestException('Only draft or cancelled campaigns can be deleted');
    }
    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  async previewAudience(businessId: string, filters: any) {
    const { where } = await this.queryAdvancedAudience(businessId, filters);
    const [count, samples] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { count, samples };
  }

  buildAudienceWhere(businessId: string, filters: any) {
    const where: any = { businessId };

    if (filters?.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters?.lastBookingBefore) {
      where.bookings = {
        every: {
          startTime: { lt: new Date(filters.lastBookingBefore) },
        },
      };
    }

    if (filters?.serviceKind) {
      where.bookings = {
        ...where.bookings,
        some: {
          service: { kind: filters.serviceKind },
        },
      };
    }

    if (filters?.noUpcomingBooking) {
      where.NOT = {
        bookings: {
          some: { startTime: { gte: new Date() } },
        },
      };
    }

    if (filters?.excludeDoNotMessage) {
      where.NOT = {
        ...where.NOT,
        tags: { has: 'do-not-message' },
      };
    }

    // P-16: createdAfter — customer created after date
    if (filters?.createdAfter) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(filters.createdAfter) };
    }

    // P-16: createdBefore — customer created before date
    if (filters?.createdBefore) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(filters.createdBefore) };
    }

    // P-16: lastVisitDaysAgo — customers whose last booking was N+ days ago
    if (filters?.lastVisitDaysAgo != null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(filters.lastVisitDaysAgo));
      where.bookings = {
        ...where.bookings,
        every: {
          ...(where.bookings?.every || {}),
          startTime: { lt: cutoff },
        },
      };
    }

    return where;
  }

  /**
   * P-16: Advanced audience query that supports bookingCount and spent filters.
   * These require subqueries since Prisma can't filter by relation counts in where clause directly.
   */
  async queryAdvancedAudience(businessId: string, filters: any) {
    const baseWhere = this.buildAudienceWhere(businessId, filters);

    // If no advanced filters, use simple query
    const hasBookingCount = filters?.bookingCountGte != null || filters?.bookingCountLte != null;
    const hasSpent = filters?.spentMoreThan != null || filters?.spentLessThan != null;

    if (!hasBookingCount && !hasSpent) {
      return { where: baseWhere, customerIds: null };
    }

    // Get candidate customers from base filters first
    let customerIds: string[] | null = null;

    if (hasBookingCount) {
      const customers = await this.prisma.customer.findMany({
        where: baseWhere,
        select: {
          id: true,
          _count: { select: { bookings: true } },
        },
      });

      customerIds = customers
        .filter((c) => {
          if (
            filters.bookingCountGte != null &&
            c._count.bookings < Number(filters.bookingCountGte)
          )
            return false;
          if (
            filters.bookingCountLte != null &&
            c._count.bookings > Number(filters.bookingCountLte)
          )
            return false;
          return true;
        })
        .map((c) => c.id);
    }

    if (hasSpent) {
      const spentWhere: any = { businessId };
      if (customerIds) {
        spentWhere.customerId = { in: customerIds };
      }
      const payments = await this.prisma.payment.groupBy({
        by: ['customerId'],
        where: spentWhere,
        _sum: { amount: true },
      });

      const paymentMap = new Map<string, number>();
      for (const p of payments) {
        if (p.customerId) {
          paymentMap.set(p.customerId, p._sum.amount || 0);
        }
      }

      // If we already have customerIds from booking filter, narrow down
      const candidates = customerIds
        ? customerIds
        : (
            await this.prisma.customer.findMany({
              where: baseWhere,
              select: { id: true },
            })
          ).map((c) => c.id);

      customerIds = candidates.filter((id) => {
        const spent = paymentMap.get(id) || 0;
        if (filters.spentMoreThan != null && spent <= Number(filters.spentMoreThan)) return false;
        if (filters.spentLessThan != null && spent >= Number(filters.spentLessThan)) return false;
        return true;
      });
    }

    return {
      where: { ...baseWhere, id: { in: customerIds! } },
      customerIds,
    };
  }

  async sendCampaign(businessId: string, id: string) {
    const campaign = await this.findById(businessId, id);
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Only draft campaigns can be sent');
    }

    if ((campaign as any).isABTest) {
      // A/B test: prepare sends with variant assignment
      const { total } = await this.dispatchService.prepareSendsWithVariants(
        id,
        businessId,
        campaign.filters as any,
        (campaign as any).variants as any[],
      );

      await this.prisma.campaign.update({
        where: { id },
        data: { status: 'SENDING', stats: { total, sent: 0, failed: 0, pending: total } },
      });

      return { status: 'SENDING', audienceSize: total };
    }

    // Prepare send rows from audience
    const { total } = await this.dispatchService.prepareSends(
      id,
      businessId,
      campaign.filters as any,
    );

    // Update campaign to SENDING
    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENDING', stats: { total, sent: 0, failed: 0, pending: total } },
    });

    return { status: 'SENDING', audienceSize: total };
  }

  validateVariants(variants: any[] | undefined) {
    if (!variants || !Array.isArray(variants) || variants.length < 2) {
      throw new BadRequestException('A/B test requires at least 2 variants');
    }
    for (const v of variants) {
      if (!v.id || !v.name || v.content === undefined || v.percentage === undefined) {
        throw new BadRequestException('Each variant must have id, name, content, and percentage');
      }
    }
    const totalPct = variants.reduce((sum: number, v: any) => sum + Number(v.percentage), 0);
    if (totalPct !== 100) {
      throw new BadRequestException('Variant percentages must sum to 100');
    }
  }

  async getVariantStats(businessId: string, id: string) {
    const campaign = await this.findById(businessId, id);
    if (!(campaign as any).isABTest) {
      throw new BadRequestException('Campaign is not an A/B test');
    }

    const variants = (campaign as any).variants as any[];
    const sends = await this.prisma.campaignSend.groupBy({
      by: ['variantId', 'status'],
      where: { campaignId: id },
      _count: true,
    });

    const bookingCounts = await this.prisma.campaignSend.groupBy({
      by: ['variantId'],
      where: { campaignId: id, bookingId: { not: null } },
      _count: true,
    });

    const bookingMap = new Map<string, number>();
    for (const b of bookingCounts) {
      bookingMap.set(b.variantId || '', b._count);
    }

    const statsMap = new Map<string, any>();
    for (const v of variants) {
      statsMap.set(v.id, {
        variantId: v.id,
        name: v.name,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        bookings: bookingMap.get(v.id) || 0,
      });
    }

    for (const s of sends) {
      const stat = statsMap.get(s.variantId || '');
      if (stat) {
        const key = s.status.toLowerCase();
        if (key in stat) {
          stat[key] = s._count;
        }
      }
    }

    return {
      variants: Array.from(statsMap.values()),
      winnerVariantId: (campaign as any).winnerVariantId,
      winnerSelectedAt: (campaign as any).winnerSelectedAt,
    };
  }

  async selectWinner(businessId: string, id: string, variantId: string) {
    const campaign = await this.findById(businessId, id);
    if (!(campaign as any).isABTest) {
      throw new BadRequestException('Campaign is not an A/B test');
    }

    const variants = (campaign as any).variants as any[];
    const variantExists = variants.some((v: any) => v.id === variantId);
    if (!variantExists) {
      throw new BadRequestException('Variant not found in campaign');
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        winnerVariantId: variantId,
        winnerSelectedAt: new Date(),
      },
    });
  }

  computeNextRun(fromDate: Date, rule: string): Date {
    const next = new Date(fromDate);
    switch (rule) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }
}

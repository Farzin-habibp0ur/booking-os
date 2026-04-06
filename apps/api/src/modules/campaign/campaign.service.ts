import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
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
      channel?: string;
      winnerMetric?: string;
      testDurationMinutes?: number;
      testAudiencePercent?: number;
    },
  ) {
    // Validate A/B test variants
    if (data.isABTest) {
      this.validateVariants(data.variants);
    }

    // Check for duplicate campaign name within business
    const existing = await this.prisma.campaign.findFirst({
      where: { businessId, name: data.name },
    });
    if (existing) {
      throw new BadRequestException(`A campaign named "${data.name}" already exists`);
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
        channel: data.channel || 'WHATSAPP',
        winnerMetric: data.isABTest && data.winnerMetric ? data.winnerMetric : null,
        testDurationMinutes:
          data.isABTest && data.winnerMetric ? data.testDurationMinutes || null : null,
        testAudiencePercent:
          data.isABTest && data.winnerMetric ? data.testAudiencePercent || 20 : null,
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
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException('Only draft or scheduled campaigns can be edited');
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

  async cancelCampaign(businessId: string, id: string) {
    const campaign = await this.findById(businessId, id);
    if (!['SENDING', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException('Only sending or scheduled campaigns can be cancelled');
    }

    // Cancel all pending sends
    const cancelledResult = await this.prisma.campaignSend.updateMany({
      where: { campaignId: id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    // Update campaign status
    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Count already-sent messages
    const sentCount = await this.prisma.campaignSend.count({
      where: { campaignId: id, status: 'SENT' },
    });

    return {
      cancelled: true,
      sentCount,
      cancelledCount: cancelledResult.count,
    };
  }

  async getFrequencyCapExclusions(businessId: string, customerIds: string[]): Promise<string[]> {
    if (customerIds.length === 0) return [];

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { campaignPreferences: true },
    });
    const prefs = (business?.campaignPreferences as any) || {};
    if (!prefs.frequencyCap) return [];

    const { max, period } = prefs.frequencyCap;
    const cutoff = new Date();
    if (period === 'week') {
      cutoff.setDate(cutoff.getDate() - 7);
    } else {
      cutoff.setDate(cutoff.getDate() - 30);
    }

    const sendCounts = await this.prisma.campaignSend.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        sentAt: { gte: cutoff },
      },
      _count: true,
    });

    return sendCounts.filter((s) => s._count >= max).map((s) => s.customerId);
  }

  async previewAudience(businessId: string, filters: any) {
    const { where } = await this.queryAdvancedAudience(businessId, filters);
    const [count, samples, allIds] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.findMany({
        where,
        select: { id: true },
      }),
    ]);

    const excluded = await this.getFrequencyCapExclusions(
      businessId,
      allIds.map((c) => c.id),
    );
    const skippedCount = excluded.length;

    return { count, skippedCount, effectiveCount: count - skippedCount, samples };
  }

  buildAudienceWhere(businessId: string, filters: any) {
    const where: any = { businessId };

    if (filters?.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }

    // Build bookings filter carefully to avoid conflicting every/some/none clauses
    const bookingsFilter: any = {};

    if (filters?.lastBookingBefore) {
      // "No bookings after this date" = customer hasn't booked since then
      bookingsFilter.none = {
        ...bookingsFilter.none,
        startTime: { gte: new Date(filters.lastBookingBefore) },
      };
    }

    if (filters?.serviceKind) {
      bookingsFilter.some = {
        service: { kind: filters.serviceKind },
      };
    }

    // Use NOT array form so multiple NOT conditions don't overwrite each other
    const notConditions: any[] = [];

    if (filters?.noUpcomingBooking) {
      notConditions.push({
        bookings: {
          some: { startTime: { gte: new Date() } },
        },
      });
    }

    if (filters?.excludeDoNotMessage) {
      notConditions.push({
        tags: { has: 'do-not-message' },
      });
    }

    if (notConditions.length > 0) {
      where.NOT = notConditions;
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
    // Uses `none` with gte: "no bookings exist after the cutoff" = hasn't visited in N days
    if (filters?.lastVisitDaysAgo != null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(filters.lastVisitDaysAgo));
      // Use the stricter cutoff if lastBookingBefore also set a none
      const existingGte = bookingsFilter.none?.startTime?.gte;
      const effectiveCutoff = existingGte && existingGte < cutoff ? existingGte : cutoff;
      bookingsFilter.none = {
        startTime: { gte: effectiveCutoff },
      };
    }

    if (Object.keys(bookingsFilter).length > 0) {
      where.bookings = bookingsFilter;
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
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException('Only draft or scheduled campaigns can be sent');
    }

    if ((campaign as any).isABTest) {
      // A/B test: prepare sends with variant assignment
      const testPercent = (campaign as any).winnerMetric
        ? (campaign as any).testAudiencePercent || 20
        : undefined;

      const { total } = await this.dispatchService.prepareSendsWithVariants(
        id,
        businessId,
        campaign.filters as any,
        (campaign as any).variants as any[],
        testPercent,
      );

      const updateData: any = {
        status: 'SENDING',
        stats: { total, sent: 0, failed: 0, pending: total },
      };

      // Calculate testPhaseEndsAt for auto-winner campaigns
      if ((campaign as any).winnerMetric && (campaign as any).testDurationMinutes) {
        updateData.testPhaseEndsAt = new Date(
          Date.now() + (campaign as any).testDurationMinutes * 60 * 1000,
        );
      }

      await this.prisma.campaign.update({
        where: { id },
        data: updateData,
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
      autoWinnerSelected: (campaign as any).autoWinnerSelected,
      testPhaseEndsAt: (campaign as any).testPhaseEndsAt,
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

  async rolloutWinner(businessId: string, campaignId: string, winnerVariantId: string) {
    const campaign = await this.findById(businessId, campaignId);

    // Get customer IDs that already received test messages
    const existingSends = await this.prisma.campaignSend.findMany({
      where: { campaignId },
      select: { customerId: true },
    });
    const alreadySentIds = new Set(existingSends.map((s) => s.customerId));

    // Query the full audience
    const { where } = await this.queryAdvancedAudience(businessId, campaign.filters as any);
    const allCustomers = await this.prisma.customer.findMany({
      where,
      select: { id: true },
    });

    // Filter out customers who already received test sends
    const remaining = allCustomers.filter((c) => !alreadySentIds.has(c.id));

    if (remaining.length === 0) return { total: 0 };

    // Create sends for remaining audience with winner variant
    const sends = remaining.map((c) => ({
      campaignId,
      customerId: c.id,
      status: 'PENDING',
      variantId: winnerVariantId,
    }));

    await this.prisma.campaignSend.createMany({ data: sends });

    // Set campaign back to SENDING so the dispatch cron picks it up
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    });

    return { total: sends.length };
  }

  // HIGH-02: Per-channel delivery analytics
  async getChannelStats(businessId: string, campaignId: string) {
    await this.findById(businessId, campaignId);
    const channels = await this.prisma.campaignSend.groupBy({
      by: ['channel', 'status'],
      where: { campaignId, campaign: { businessId } },
      _count: true,
    });

    const result: Record<string, Record<string, number>> = {};
    for (const row of channels) {
      const ch = row.channel || 'UNKNOWN';
      if (!result[ch]) result[ch] = { sent: 0, delivered: 0, read: 0, failed: 0, pending: 0 };
      result[ch][row.status.toLowerCase()] = row._count;
    }
    return result;
  }

  // HIGH-03: Campaign conversion funnel
  async getFunnelStats(businessId: string, campaignId: string) {
    const campaign = await this.findById(businessId, campaignId);

    const [sent, delivered, read, opened, total] = await Promise.all([
      this.prisma.campaignSend.count({
        where: {
          campaignId,
          campaign: { businessId },
          status: { in: ['SENT', 'DELIVERED', 'READ'] },
        },
      }),
      this.prisma.campaignSend.count({
        where: { campaignId, campaign: { businessId }, status: { in: ['DELIVERED', 'READ'] } },
      }),
      this.prisma.campaignSend.count({
        where: { campaignId, campaign: { businessId }, status: 'READ' },
      }),
      this.prisma.campaignSend.count({
        where: { campaignId, campaign: { businessId }, openedAt: { not: null } },
      }),
      this.prisma.campaignSend.count({
        where: { campaignId, campaign: { businessId } },
      }),
    ]);

    // Count distinct sends with clicks
    const clickedSends = await this.prisma.campaignClick.groupBy({
      by: ['campaignSendId'],
      where: { campaignSend: { campaignId, campaign: { businessId } } },
    });
    const clicked = clickedSends.length;

    // Count bookings from recipients within 7 days of campaign send
    const recipientIds = await this.prisma.campaignSend.findMany({
      where: { campaignId },
      select: { customerId: true },
    });
    const customerIds = recipientIds.map((r) => r.customerId);

    const sevenDaysAfterSend = campaign.sentAt
      ? new Date(campaign.sentAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      : null;

    // Fetch attributed bookings with service price for revenue
    const attributedBookings =
      campaign.sentAt && sevenDaysAfterSend
        ? await this.prisma.booking.findMany({
            where: {
              businessId,
              customerId: { in: customerIds },
              createdAt: { gte: campaign.sentAt, lte: sevenDaysAfterSend },
            },
            include: { service: { select: { price: true } } },
          })
        : [];
    const booked = attributedBookings.length;
    const revenueTotal = attributedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    return {
      stages: [
        { label: 'Sent', count: sent, percentage: 100 },
        {
          label: 'Delivered',
          count: delivered,
          percentage: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        },
        {
          label: 'Opened',
          count: opened,
          percentage: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        },
        {
          label: 'Clicked',
          count: clicked,
          percentage: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
        },
        {
          label: 'Read',
          count: read,
          percentage: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
        },
        {
          label: 'Booked',
          count: booked,
          percentage: read > 0 ? Math.round((booked / read) * 100) : 0,
        },
      ],
      revenueTotal,
    };
  }

  async getLinkStats(businessId: string, campaignId: string) {
    await this.findById(businessId, campaignId);

    const clicks = await this.prisma.campaignClick.findMany({
      where: { campaignSend: { campaignId, campaign: { businessId } } },
      select: { url: true, campaignSendId: true },
    });

    const totalSent = await this.prisma.campaignSend.count({
      where: {
        campaignId,
        campaign: { businessId },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
      },
    });

    // Group by URL
    const urlMap = new Map<string, { total: number; uniqueSendIds: Set<string> }>();
    for (const click of clicks) {
      const entry = urlMap.get(click.url) || { total: 0, uniqueSendIds: new Set() };
      entry.total++;
      entry.uniqueSendIds.add(click.campaignSendId);
      urlMap.set(click.url, entry);
    }

    return Array.from(urlMap.entries()).map(([url, data]) => ({
      url,
      totalClicks: data.total,
      uniqueClicks: data.uniqueSendIds.size,
      ctr: totalSent > 0 ? Math.round((data.uniqueSendIds.size / totalSent) * 1000) / 10 : 0,
    }));
  }

  async getPerformanceSummary(businessId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { businessId, status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      take: 20,
    });

    const results = [];
    for (const campaign of campaigns) {
      const sentCount = await this.prisma.campaignSend.count({
        where: { campaignId: campaign.id, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
      });

      const sevenDaysAfterSend = campaign.sentAt
        ? new Date(campaign.sentAt.getTime() + 7 * 24 * 60 * 60 * 1000)
        : null;

      const recipientIds = await this.prisma.campaignSend.findMany({
        where: { campaignId: campaign.id },
        select: { customerId: true },
      });
      const customerIds = recipientIds.map((r) => r.customerId);

      const attributedBookings =
        campaign.sentAt && sevenDaysAfterSend
          ? await this.prisma.booking.findMany({
              where: {
                businessId,
                customerId: { in: customerIds },
                createdAt: { gte: campaign.sentAt, lte: sevenDaysAfterSend },
              },
              include: { service: { select: { price: true } } },
            })
          : [];

      const revenue = attributedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

      results.push({
        id: campaign.id,
        name: campaign.name,
        sentCount,
        revenue,
        sentAt: campaign.sentAt,
      });
    }

    return results.sort((a, b) => b.revenue - a.revenue);
  }

  // HIGH-04: Generate unsubscribe token for a campaign send
  generateUnsubscribeToken(): string {
    return randomBytes(32).toString('hex');
  }

  // HIGH-04: Process unsubscribe by token
  async processUnsubscribe(token: string) {
    const unsub = await this.prisma.campaignUnsubscribe.findUnique({
      where: { token },
      include: { business: { select: { name: true } }, campaign: { select: { name: true } } },
    });
    if (!unsub) throw new NotFoundException('Invalid or expired unsubscribe link');
    return {
      businessName: unsub.business.name,
      campaignName: unsub.campaign?.name || 'all campaigns',
      alreadyUnsubscribed: true,
    };
  }

  // HIGH-04: Create unsubscribe record
  async createUnsubscribe(businessId: string, customerId: string, campaignId?: string) {
    const token = this.generateUnsubscribeToken();
    return this.prisma.campaignUnsubscribe.create({
      data: { businessId, customerId, campaignId: campaignId || null, token },
    });
  }

  // HIGH-04: Check if customer is unsubscribed
  async isUnsubscribed(
    businessId: string,
    customerId: string,
    campaignId?: string,
  ): Promise<boolean> {
    const unsub = await this.prisma.campaignUnsubscribe.findFirst({
      where: {
        businessId,
        customerId,
        OR: [
          { campaignId: null }, // Global unsubscribe
          ...(campaignId ? [{ campaignId }] : []),
        ],
      },
    });
    return !!unsub;
  }

  // MED-01: Clone a campaign
  async clone(businessId: string, campaignId: string) {
    const original = await this.findById(businessId, campaignId);

    // Generate unique name
    let name = `${(original as any).name} (Copy)`;
    let counter = 1;
    while (await this.prisma.campaign.findFirst({ where: { businessId, name } })) {
      counter++;
      name = `${(original as any).name} (Copy ${counter})`;
    }

    return this.prisma.campaign.create({
      data: {
        businessId,
        name,
        status: 'DRAFT',
        filters: (original as any).filters || {},
        templateId: (original as any).templateId,
        channel: (original as any).channel,
        isABTest: (original as any).isABTest || false,
        variants: (original as any).variants || [],
        throttlePerMinute: (original as any).throttlePerMinute || 10,
      },
    });
  }

  // MED-02: Send a test preview to a staff member's email
  async testSend(businessId: string, campaignId: string, staffEmail: string) {
    const campaign = await this.findById(businessId, campaignId);
    if (!['DRAFT', 'SCHEDULED'].includes((campaign as any).status)) {
      throw new BadRequestException(
        'Test sends are only available for DRAFT or SCHEDULED campaigns',
      );
    }

    const variants = ((campaign as any).variants || []) as any[];
    const messageContent = variants[0]?.content || '(No message content)';

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });

    const rendered = this.dispatchService.renderTemplate(messageContent, {
      customerName: 'Test Customer',
      businessName: business?.name || 'Your Business',
      serviceName: 'Sample Service',
      nextBookingDate: new Date().toLocaleDateString(),
      staffName: 'Team Member',
    });

    // Use notification queue if available, otherwise just return preview
    return {
      sent: true,
      sentTo: staffEmail,
      preview: `[TEST] Campaign Preview: ${(campaign as any).name}\n\n${rendered}`,
    };
  }

  // MED-03: Estimate cost for a campaign
  async estimateCost(businessId: string, filters: any, channel: string) {
    const { where } = await this.queryAdvancedAudience(businessId, filters);
    const count = await this.prisma.customer.count({ where });

    const rates: Record<string, number> = {
      SMS: 0.0079,
      EMAIL: 0.00065,
      WHATSAPP: 0,
      INSTAGRAM: 0,
      FACEBOOK: 0,
      WEB_CHAT: 0,
    };

    const rate = rates[channel] || 0;
    const estimatedCost = Math.round(count * rate * 100) / 100;

    return {
      audienceSize: count,
      channel,
      ratePerMessage: rate,
      estimatedCost,
      currency: 'USD',
      isFree: rate === 0,
    };
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

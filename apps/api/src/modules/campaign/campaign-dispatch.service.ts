import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CampaignService } from './campaign.service';

@Injectable()
export class CampaignDispatchService {
  private readonly logger = new Logger(CampaignDispatchService.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CampaignService))
    private campaignService: CampaignService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processSendingCampaigns() {
    if (this.processing) return;
    this.processing = true;
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: { status: 'SENDING' },
      });

      for (const campaign of campaigns) {
        await this.processCampaign(campaign);
      }
    } catch (err: any) {
      this.logger.error(`Campaign dispatch error: ${err.message}`);
    } finally {
      this.processing = false;
    }
  }

  private async processCampaign(campaign: any) {
    const pendingSends = await this.prisma.campaignSend.findMany({
      where: { campaignId: campaign.id, status: 'PENDING' },
      take: campaign.throttlePerMinute || 10,
      include: { campaign: true },
    });

    if (pendingSends.length === 0) {
      // All sends complete — mark campaign as SENT
      const stats = await this.computeStats(campaign.id);
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'SENT', sentAt: new Date(), stats },
      });

      // Schedule next occurrence if campaign has a recurrence rule
      await this.scheduleNextRecurrence(campaign);
      return;
    }

    for (const send of pendingSends) {
      try {
        // Mark as sent (actual delivery would be via notification service)
        await this.prisma.campaignSend.update({
          where: { id: send.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } catch (err: any) {
        await this.prisma.campaignSend.update({
          where: { id: send.id },
          data: { status: 'FAILED' },
        });
        this.logger.error(`Campaign send failed: ${err.message}`);
      }
    }

    // Update stats
    const stats = await this.computeStats(campaign.id);
    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { stats },
    });
  }

  async prepareSends(campaignId: string, businessId: string, filters: any) {
    // P-16: Use advanced audience query from CampaignService for full filter support
    const { where } = await this.campaignService.queryAdvancedAudience(businessId, filters);
    const customers = await this.prisma.customer.findMany({
      where,
      select: { id: true },
    });

    const sends = customers.map((c) => ({
      campaignId,
      customerId: c.id,
      status: 'PENDING',
    }));

    if (sends.length > 0) {
      await this.prisma.campaignSend.createMany({ data: sends });
    }

    return { total: sends.length };
  }

  async prepareSendsWithVariants(
    campaignId: string,
    businessId: string,
    filters: any,
    variants: any[],
  ) {
    const { where } = await this.campaignService.queryAdvancedAudience(businessId, filters);
    const customers = await this.prisma.customer.findMany({
      where,
      select: { id: true },
    });

    // Shuffle audience randomly (Fisher-Yates)
    const shuffled = [...customers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Split by variant percentages
    const sends: any[] = [];
    let offset = 0;
    for (const variant of variants) {
      const count = Math.round((Number(variant.percentage) / 100) * shuffled.length);
      const slice = shuffled.slice(offset, offset + count);
      for (const c of slice) {
        sends.push({
          campaignId,
          customerId: c.id,
          status: 'PENDING',
          variantId: variant.id,
        });
      }
      offset += count;
    }

    // Handle any rounding remainder — assign to last variant
    if (offset < shuffled.length) {
      const lastVariant = variants[variants.length - 1];
      for (let i = offset; i < shuffled.length; i++) {
        sends.push({
          campaignId,
          customerId: shuffled[i].id,
          status: 'PENDING',
          variantId: lastVariant.id,
        });
      }
    }

    if (sends.length > 0) {
      await this.prisma.campaignSend.createMany({ data: sends });
    }

    return { total: sends.length };
  }

  private async computeStats(campaignId: string) {
    const sends = await this.prisma.campaignSend.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const stats: any = { sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, bookings: 0 };
    for (const s of sends) {
      stats[s.status.toLowerCase()] = s._count;
    }

    const bookings = await this.prisma.campaignSend.count({
      where: { campaignId, bookingId: { not: null } },
    });
    stats.bookings = bookings;

    return stats;
  }

  async scheduleNextRecurrence(campaign: any) {
    if (!campaign.recurrenceRule || campaign.recurrenceRule === 'NONE') return;

    const baseDate = campaign.sentAt || campaign.scheduledAt || new Date();
    const nextRunAt = this.campaignService.computeNextRun(
      new Date(baseDate),
      campaign.recurrenceRule,
    );

    // Create a new child campaign scheduled for the next occurrence
    await this.prisma.campaign.create({
      data: {
        businessId: campaign.businessId,
        name: campaign.name,
        status: 'DRAFT',
        templateId: campaign.templateId,
        filters: campaign.filters || {},
        scheduledAt: nextRunAt,
        throttlePerMinute: campaign.throttlePerMinute || 10,
        recurrenceRule: campaign.recurrenceRule,
        nextRunAt: this.campaignService.computeNextRun(nextRunAt, campaign.recurrenceRule),
        parentCampaignId: campaign.parentCampaignId || campaign.id,
      },
    });

    this.logger.log(
      `Scheduled next ${campaign.recurrenceRule} occurrence of campaign "${campaign.name}" for ${nextRunAt.toISOString()}`,
    );
  }
}

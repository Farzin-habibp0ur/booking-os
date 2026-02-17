import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CampaignDispatchService {
  private readonly logger = new Logger(CampaignDispatchService.name);
  private processing = false;

  constructor(private prisma: PrismaService) {}

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
    // Build audience and create CampaignSend rows
    const where = this.buildAudienceWhere(businessId, filters);
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

  private buildAudienceWhere(businessId: string, filters: any) {
    const where: any = { businessId };
    if (filters?.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }
    if (filters?.noUpcomingBooking) {
      where.NOT = { bookings: { some: { startTime: { gte: new Date() } } } };
    }
    if (filters?.excludeDoNotMessage) {
      where.NOT = { ...where.NOT, tags: { has: 'do-not-message' } };
    }
    return where;
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
}

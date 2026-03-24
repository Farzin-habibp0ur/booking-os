import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { CampaignService } from './campaign.service';
import { UsageService } from '../usage/usage.service';
import { DeadLetterQueueService } from '../../common/queue/dead-letter.service';
import { AutomationExecutorService } from '../automation/automation-executor.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

@Injectable()
export class CampaignDispatchService {
  private readonly logger = new Logger(CampaignDispatchService.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CampaignService))
    private campaignService: CampaignService,
    private usageService: UsageService,
    private deadLetterQueueService: DeadLetterQueueService,
    @Optional() @Inject(forwardRef(() => AutomationExecutorService))
    private automationExecutor?: AutomationExecutorService,
    @Optional() @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationQueue?: Queue,
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

    // Fetch business info for message rendering
    const business = await this.prisma.business.findUnique({
      where: { id: campaign.businessId },
      select: { id: true, name: true },
    });
    const channel = campaign.channel || 'WHATSAPP';

    for (const send of pendingSends) {
      try {
        // Fetch customer for contact info and personalization
        const customer = await this.prisma.customer.findUnique({
          where: { id: send.customerId },
          select: { id: true, name: true, phone: true, email: true },
        });

        if (!customer) {
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: { status: 'FAILED', channel },
          });
          continue;
        }

        // Resolve recipient address for channel
        const address = this.resolveAddress(customer, channel);
        if (!address) {
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: { status: 'FAILED', channel },
          });
          this.logger.warn(`No ${channel} address for customer ${customer.id}`);
          continue;
        }

        // Resolve variant content and render merge variables
        const variants = (campaign.variants || []) as any[];
        const variant = send.variantId
          ? variants.find((v: any) => v.id === send.variantId)
          : variants[0];
        const rawContent = variant?.content || '';

        // Fetch customer's last booking for merge variable context
        const lastBooking = rawContent.includes('{{')
          ? await this.prisma.booking.findFirst({
              where: { customerId: customer.id },
              orderBy: { startTime: 'desc' },
              include: { service: true, staff: true },
            })
          : null;

        const messageContent = this.renderTemplate(rawContent, {
          customerName: customer.name || 'there',
          serviceName: lastBooking?.service?.name || 'your service',
          businessName: business?.name || 'us',
          nextBookingDate: lastBooking?.startTime
            ? lastBooking.startTime.toLocaleDateString()
            : '',
          staffName: lastBooking?.staff?.name || 'our team',
        });

        // Enqueue delivery via notification queue
        if (this.notificationQueue) {
          await this.notificationQueue.add('campaign-send', {
            to: address,
            channel,
            content: messageContent,
            businessId: campaign.businessId,
            businessName: business?.name || '',
            customerId: customer.id,
            customerName: customer.name,
            campaignId: campaign.id,
            campaignSendId: send.id,
          });
        }

        // Mark as sent
        await this.prisma.campaignSend.update({
          where: { id: send.id },
          data: { status: 'SENT', sentAt: new Date(), channel },
        });

        // Record usage for billing
        this.usageService
          .recordUsage(campaign.businessId, channel, 'OUTBOUND')
          .catch((err) => this.logger.error(`Usage recording failed: ${err.message}`));

        // Fire CAMPAIGN_SENT trigger for automation rules
        if (this.automationExecutor) {
          this.automationExecutor
            .evaluateTrigger('CAMPAIGN_SENT', {
              businessId: campaign.businessId,
              customerId: customer.id,
              campaignId: campaign.id,
              campaignName: campaign.name,
            })
            .catch((err) =>
              this.logger.warn(`Campaign trigger evaluation failed: ${err.message}`),
            );
        }
      } catch (err: any) {
        await this.prisma.campaignSend.update({
          where: { id: send.id },
          data: { status: 'FAILED', channel },
        });

        // Capture to DLQ for retry capability
        await this.deadLetterQueueService.capture(
          { campaignSendId: send.id, campaignId: campaign.id, customerId: send.customerId },
          err,
          'campaign',
        );

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

  renderTemplate(
    template: string,
    context: {
      customerName?: string;
      serviceName?: string;
      businessName?: string;
      nextBookingDate?: string;
      staffName?: string;
    },
  ): string {
    return template
      .replace(/\{\{name\}\}/gi, context.customerName || 'there')
      .replace(/\{\{service\}\}/gi, context.serviceName || 'your service')
      .replace(/\{\{business\}\}/gi, context.businessName || 'us')
      .replace(/\{\{date\}\}/gi, context.nextBookingDate || '')
      .replace(/\{\{staff\}\}/gi, context.staffName || 'our team');
  }

  private resolveAddress(
    customer: { phone: string | null; email: string | null },
    channel: string,
  ): string | null {
    switch (channel) {
      case 'EMAIL':
        return customer.email || null;
      case 'SMS':
      case 'WHATSAPP':
        return customer.phone || null;
      case 'MULTI':
        // Prefer phone (WhatsApp/SMS), fall back to email
        return customer.phone || customer.email || null;
      default:
        return customer.phone || null;
    }
  }
}

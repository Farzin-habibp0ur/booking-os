import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { CampaignService } from './campaign.service';
import { UsageService } from '../usage/usage.service';
import { DeadLetterQueueService } from '../../common/queue/dead-letter.service';
import { AutomationExecutorService } from '../automation/automation-executor.service';
import { TrackingService } from '../tracking/tracking.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

@Injectable()
export class CampaignDispatchService {
  private readonly logger = new Logger(CampaignDispatchService.name);
  private processing = false;
  private processingScheduled = false;
  private processingABTests = false;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CampaignService))
    private campaignService: CampaignService,
    private usageService: UsageService,
    private deadLetterQueueService: DeadLetterQueueService,
    @Optional()
    @Inject(forwardRef(() => AutomationExecutorService))
    private automationExecutor?: AutomationExecutorService,
    @Optional() @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationQueue?: Queue,
    @Optional() private trackingService?: TrackingService,
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

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledCampaigns() {
    if (this.processingScheduled) return;
    this.processingScheduled = true;
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
      });

      for (const campaign of campaigns) {
        try {
          await this.campaignService.sendCampaign(campaign.businessId, campaign.id);
          this.logger.log(`Scheduled campaign "${campaign.name}" (${campaign.id}) started sending`);
        } catch (err: any) {
          this.logger.error(`Failed to start scheduled campaign ${campaign.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Scheduled campaign processing error: ${err.message}`);
    } finally {
      this.processingScheduled = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processABTestResults() {
    if (this.processingABTests) return;
    this.processingABTests = true;
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: {
          status: 'SENT',
          isABTest: true,
          autoWinnerSelected: false,
          winnerVariantId: null,
          testPhaseEndsAt: { not: null, lte: new Date() },
        },
      });

      for (const campaign of campaigns) {
        try {
          await this.evaluateAndRolloutWinner(campaign);
        } catch (err: any) {
          this.logger.error(
            `AB test auto-winner failed for campaign ${campaign.id}: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`AB test result processing error: ${err.message}`);
    } finally {
      this.processingABTests = false;
    }
  }

  private async evaluateAndRolloutWinner(campaign: any) {
    const stats = await this.campaignService.getVariantStats(campaign.businessId, campaign.id);

    const metric = campaign.winnerMetric || 'READ_RATE';
    const variantRates = stats.variants.map((v: any) => {
      const total = v.sent || 1;
      const rate = metric === 'BOOKING_RATE' ? v.bookings / total : v.read / total;
      return { variantId: v.variantId, rate, read: v.read };
    });

    // Sort by rate descending
    variantRates.sort((a: any, b: any) => b.rate - a.rate);
    const best = variantRates[0];

    // If inconclusive (<5% difference), use highest absolute read count as tiebreaker
    if (variantRates.length >= 2 && best.rate - variantRates[1].rate < 0.05) {
      variantRates.sort((a: any, b: any) => b.read - a.read);
      this.logger.log(`Campaign ${campaign.id}: rates inconclusive, using read count tiebreaker`);
    }

    const winnerId = variantRates[0].variantId;

    // Mark as auto-selected before rollout to prevent re-entry
    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { autoWinnerSelected: true },
    });

    await this.campaignService.selectWinner(campaign.businessId, campaign.id, winnerId);
    await this.campaignService.rolloutWinner(campaign.businessId, campaign.id, winnerId);

    this.logger.log(
      `Campaign ${campaign.id}: auto-selected winner variant ${winnerId}, rolling out`,
    );
  }

  private async processCampaign(campaign: any) {
    // Race condition guard: re-check campaign hasn't been cancelled since query
    const freshCampaign = await this.prisma.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true },
    });
    if (freshCampaign?.status === 'CANCELLED') return;

    // Quiet hours check: skip dispatch if within quiet hours
    const bizPrefs = await this.prisma.business.findUnique({
      where: { id: campaign.businessId },
      select: { campaignPreferences: true, name: true },
    });
    const prefs = (bizPrefs?.campaignPreferences as any) || {};
    if (prefs.quietHours) {
      const { start, end, timezone } = prefs.quietHours;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone || 'UTC',
      });
      const currentTime = formatter.format(now);
      // Quiet hours: if start > end, it spans midnight (e.g., 21:00-08:00)
      const inQuietHours =
        start <= end
          ? currentTime >= start && currentTime < end
          : currentTime >= start || currentTime < end;
      if (inQuietHours) {
        this.logger.log(
          `Skipping campaign dispatch for ${bizPrefs?.name || campaign.businessId} during quiet hours`,
        );
        return;
      }
    }

    const pendingSends = await this.prisma.campaignSend.findMany({
      where: { campaignId: campaign.id, status: 'PENDING' },
      take: campaign.throttlePerMinute || 10,
      include: { campaign: true },
    });

    if (pendingSends.length === 0) {
      // Re-check campaign status before marking SENT (may have been cancelled mid-processing)
      const currentStatus = await this.prisma.campaign.findUnique({
        where: { id: campaign.id },
        select: { status: true },
      });
      if (currentStatus?.status === 'CANCELLED') return;

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
          nextBookingDate: lastBooking?.startTime ? lastBooking.startTime.toLocaleDateString() : '',
          staffName: lastBooking?.staff?.name || 'our team',
        });

        // Wrap URLs for click tracking and add open tracking pixel for email
        let finalContent = messageContent;
        if (this.trackingService) {
          const baseUrl = process.env.API_URL || 'https://api.businesscommandcentre.com';
          finalContent = this.trackingService.wrapUrlsInContent(messageContent, send.id, baseUrl);
          if (channel === 'EMAIL') {
            finalContent += this.trackingService.generateTrackingPixel(send.id, baseUrl);
          }
        }

        // Enqueue delivery via notification queue
        if (this.notificationQueue) {
          await this.notificationQueue.add('campaign-send', {
            to: address,
            channel,
            content: finalContent,
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
            .catch((err) => this.logger.warn(`Campaign trigger evaluation failed: ${err.message}`));
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
    const allCustomers = await this.prisma.customer.findMany({
      where,
      select: { id: true },
    });

    // Exclude frequency-capped customers
    const excluded = new Set(
      await this.campaignService.getFrequencyCapExclusions(
        businessId,
        allCustomers.map((c) => c.id),
      ),
    );
    const customers = allCustomers.filter((c) => !excluded.has(c.id));

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
    testPercent?: number,
  ) {
    const { where } = await this.campaignService.queryAdvancedAudience(businessId, filters);
    const allCustomers = await this.prisma.customer.findMany({
      where,
      select: { id: true },
    });

    // Exclude frequency-capped customers
    const excluded = new Set(
      await this.campaignService.getFrequencyCapExclusions(
        businessId,
        allCustomers.map((c) => c.id),
      ),
    );
    const customers = allCustomers.filter((c) => !excluded.has(c.id));

    // Shuffle audience randomly (Fisher-Yates)
    const shuffled = [...customers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Limit audience to testPercent if provided (auto-winner A/B test)
    const effectiveAudience = testPercent
      ? shuffled.slice(
          0,
          Math.max(variants.length, Math.round((shuffled.length * testPercent) / 100)),
        )
      : shuffled;

    // Split by variant percentages
    const sends: any[] = [];
    let offset = 0;
    for (const variant of variants) {
      const count = Math.round((Number(variant.percentage) / 100) * effectiveAudience.length);
      const slice = effectiveAudience.slice(offset, offset + count);
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
    if (offset < effectiveAudience.length) {
      const lastVariant = variants[variants.length - 1];
      for (let i = offset; i < effectiveAudience.length; i++) {
        sends.push({
          campaignId,
          customerId: effectiveAudience[i].id,
          status: 'PENDING',
          variantId: lastVariant.id,
        });
      }
    }

    if (sends.length > 0) {
      await this.prisma.campaignSend.createMany({ data: sends });
    }

    return { total: sends.length, totalAudience: shuffled.length };
  }

  private async computeStats(campaignId: string) {
    const sends = await this.prisma.campaignSend.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const stats: any = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0,
      cancelled: 0,
      bookings: 0,
    };
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

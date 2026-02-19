import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { ActionCardService } from '../action-card/action-card.service';

@Injectable()
export class OpportunityDetectorService {
  private readonly logger = new Logger(OpportunityDetectorService.name);
  private processing = false;

  private static readonly MAX_EXECUTION_MS = 30_000;

  constructor(
    private prisma: PrismaService,
    private actionCardService: ActionCardService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async detectOpportunities() {
    if (this.processing) return;
    this.processing = true;
    const startTime = Date.now();

    try {
      const businesses = await this.prisma.business.findMany({
        select: { id: true, packConfig: true },
      });

      for (const business of businesses) {
        if (Date.now() - startTime > OpportunityDetectorService.MAX_EXECUTION_MS) {
          this.logger.warn('Opportunity detection time limit reached, deferring');
          break;
        }

        try {
          await this.detectForBusiness(business.id);
        } catch (err: any) {
          this.logger.error(`Opportunity detection failed for business ${business.id}`, {
            error: err.message,
          });
        }
      }
    } finally {
      this.processing = false;
    }
  }

  async detectForBusiness(businessId: string) {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const [depositPending, overdueConversations, tomorrowBookings, activeWaitlist] =
      await Promise.all([
        // Bookings with pending deposits
        this.prisma.booking.findMany({
          where: {
            businessId,
            status: 'PENDING_DEPOSIT',
            startTime: { gte: now },
          },
          include: { customer: true, service: true, staff: true },
          take: 20,
          orderBy: { startTime: 'asc' },
        }),
        // Conversations with no reply for 30+ minutes
        this.prisma.conversation.findMany({
          where: {
            businessId,
            status: 'OPEN',
            lastMessageAt: { lt: thirtyMinAgo },
          },
          include: { customer: true, assignedTo: true },
          take: 20,
          orderBy: { lastMessageAt: 'asc' },
        }),
        // Tomorrow's bookings (to detect gaps)
        this.prisma.booking.findMany({
          where: {
            businessId,
            status: { in: ['PENDING', 'CONFIRMED', 'PENDING_DEPOSIT'] },
            startTime: { gte: tomorrowStart, lte: tomorrowEnd },
          },
          select: { id: true, startTime: true, staffId: true },
          orderBy: { startTime: 'asc' },
        }),
        // Active waitlist entries
        this.prisma.waitlistEntry.count({
          where: { businessId, status: 'ACTIVE' },
        }),
      ]);

    // Check for existing pending cards to avoid duplicates
    const existingCards = await this.prisma.actionCard.findMany({
      where: {
        businessId,
        status: 'PENDING',
        type: { in: ['DEPOSIT_PENDING', 'OVERDUE_REPLY', 'OPEN_SLOT'] },
      },
      select: { type: true, bookingId: true, conversationId: true },
    });

    const existingDepositBookingIds = new Set(
      existingCards
        .filter((c) => c.type === 'DEPOSIT_PENDING' && c.bookingId)
        .map((c) => c.bookingId),
    );
    const existingReplyConvIds = new Set(
      existingCards
        .filter((c) => c.type === 'OVERDUE_REPLY' && c.conversationId)
        .map((c) => c.conversationId),
    );
    const hasOpenSlotCard = existingCards.some((c) => c.type === 'OPEN_SLOT');

    let cardsCreated = 0;

    // 1. Deposit pending opportunities
    for (const booking of depositPending) {
      if (existingDepositBookingIds.has(booking.id)) continue;

      const daysUntil = Math.ceil(
        (new Date(booking.startTime).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      try {
        await this.actionCardService.create({
          businessId,
          type: 'DEPOSIT_PENDING',
          category: daysUntil <= 2 ? 'URGENT_TODAY' : 'NEEDS_APPROVAL',
          priority: daysUntil <= 1 ? 95 : daysUntil <= 3 ? 80 : 60,
          title: `Deposit pending for ${booking.customer?.name || 'customer'}`,
          description: `Because ${booking.service?.name || 'their appointment'} is in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} and deposit has not been collected.`,
          suggestedAction: 'Send deposit reminder via WhatsApp',
          ctaConfig: [
            { label: 'Send Reminder', action: 'send_deposit_reminder' },
            { label: 'Dismiss', action: 'dismiss' },
          ],
          autonomyLevel: 'ASSISTED',
          bookingId: booking.id,
          customerId: booking.customer?.id,
          staffId: booking.staffId || undefined,
          expiresAt: new Date(booking.startTime),
        });
        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(`Failed to create deposit card for booking ${booking.id}`, {
          error: err.message,
        });
      }
    }

    // 2. Overdue reply opportunities
    for (const conv of overdueConversations) {
      if (existingReplyConvIds.has(conv.id)) continue;

      const minutesOverdue = Math.round(
        (now.getTime() - new Date(conv.lastMessageAt!).getTime()) / (1000 * 60),
      );

      try {
        await this.actionCardService.create({
          businessId,
          type: 'OVERDUE_REPLY',
          category: minutesOverdue > 120 ? 'URGENT_TODAY' : 'NEEDS_APPROVAL',
          priority: minutesOverdue > 240 ? 90 : minutesOverdue > 120 ? 75 : 60,
          title: `Unread message from ${conv.customer?.name || 'customer'}`,
          description: `Because ${conv.customer?.name || 'a customer'} sent a message ${minutesOverdue > 60 ? Math.round(minutesOverdue / 60) + ' hours' : minutesOverdue + ' minutes'} ago. No staff has replied.`,
          suggestedAction: conv.assignedTo
            ? `Remind ${conv.assignedTo.name} to respond`
            : 'Assign and respond to conversation',
          ctaConfig: [
            { label: 'Open Chat', action: 'open_conversation' },
            { label: 'Dismiss', action: 'dismiss' },
          ],
          autonomyLevel: 'ASSISTED',
          conversationId: conv.id,
          customerId: conv.customer?.id,
          staffId: conv.assignedToId || undefined,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        });
        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(`Failed to create overdue reply card for conv ${conv.id}`, {
          error: err.message,
        });
      }
    }

    // 3. Open slot opportunity (tomorrow has gaps + waitlist has entries)
    if (!hasOpenSlotCard && activeWaitlist > 0 && tomorrowBookings.length < 8) {
      const gapCount = Math.max(0, 8 - tomorrowBookings.length);
      try {
        await this.actionCardService.create({
          businessId,
          type: 'OPEN_SLOT',
          category: 'OPPORTUNITY',
          priority: 55,
          title: `${gapCount} open slot${gapCount !== 1 ? 's' : ''} tomorrow`,
          description: `Because tomorrow has ${gapCount} unfilled slot${gapCount !== 1 ? 's' : ''} and ${activeWaitlist} waitlist customer${activeWaitlist !== 1 ? 's' : ''} are waiting.`,
          suggestedAction: 'Notify waitlist customers about availability',
          ctaConfig: [
            { label: 'Fill Slots', action: 'notify_waitlist' },
            { label: 'Dismiss', action: 'dismiss' },
          ],
          autonomyLevel: 'ASSISTED',
          expiresAt: tomorrowEnd,
        });
        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(`Failed to create open slot card for business ${businessId}`, {
          error: err.message,
        });
      }
    }

    if (cardsCreated > 0) {
      this.logger.log(`Created ${cardsCreated} opportunity card(s) for business ${businessId}`);
    }

    return cardsCreated;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

const ATTRIBUTION_WINDOW_DAYS = 14;

@Injectable()
export class FrontDeskService {
  constructor(private prisma: PrismaService) {}

  async getSummary(businessId: string, days = 30) {
    const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
    const since = new Date();
    since.setDate(since.getDate() - safeDays);

    const [
      leadsCaptured,
      aiDrafts,
      approvedReplies,
      explicitAttributions,
      consultFollowUpsFromCards,
      waitlistWinsFromCards,
      responseMessages,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: {
          businessId,
          createdAt: { gte: since },
          channel: { in: ['INSTAGRAM', 'WHATSAPP', 'WEB_CHAT', 'SMS', 'EMAIL', 'FACEBOOK'] },
        },
      }),
      this.prisma.outboundDraft.count({
        where: { businessId, source: 'AI', createdAt: { gte: since } },
      }),
      this.prisma.outboundDraft.count({
        where: {
          businessId,
          source: 'AI',
          createdAt: { gte: since },
          OR: [{ status: { in: ['APPROVED', 'SENT'] } }, { approvedById: { not: null } }],
        },
      }),
      this.prisma.frontDeskAttribution.findMany({
        where: {
          businessId,
          createdAt: { gte: since },
          status: { in: ['BOOKED', 'WON'] },
        },
        select: {
          bookingId: true,
          source: true,
          estimatedValue: true,
        },
      }),
      this.prisma.actionCard.count({
        where: {
          businessId,
          type: { in: ['QUOTE_FOLLOWUP', 'CONSULT_FOLLOWUP'] },
          createdAt: { gte: since },
        },
      }),
      this.prisma.actionCard.count({
        where: {
          businessId,
          type: 'WAITLIST_MATCH',
          status: { in: ['APPROVED', 'EXECUTED'] },
          createdAt: { gte: since },
        },
      }),
      this.prisma.message.findMany({
        where: {
          createdAt: { gte: since },
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
    ]);

    const inferredWins = await this.inferBookingsFromAiDrafts(businessId, since);
    const explicitBookingIds = new Set(
      explicitAttributions.map((a) => a.bookingId).filter((id): id is string => Boolean(id)),
    );
    const inferredOnly = inferredWins.filter((win) => !explicitBookingIds.has(win.bookingId));
    const explicitRevenue = explicitAttributions.reduce(
      (sum, a) => sum + (Number(a.estimatedValue) || 0),
      0,
    );
    const inferredRevenue = inferredOnly.reduce((sum, win) => sum + win.estimatedValue, 0);

    const cancellationSlotsFilled =
      waitlistWinsFromCards +
      explicitAttributions.filter((a) => a.source === 'WAITLIST_CANCELLATION_FILL').length;
    const consultFollowUps =
      consultFollowUpsFromCards +
      explicitAttributions.filter((a) => a.source === 'CONSULT_FOLLOWUP').length;
    const bookingsAttributed = explicitBookingIds.size + inferredOnly.length;

    return {
      days: safeDays,
      leadsCaptured,
      aiDrafts,
      approvedReplies,
      avgResponseMinutes: this.averageFirstResponseMinutes(responseMessages),
      cancellationSlotsFilled,
      consultFollowUps,
      bookingsAttributed,
      estimatedRecoveredRevenue: Math.round((explicitRevenue + inferredRevenue) * 100) / 100,
      confidenceNote:
        'Recovered revenue combines confirmed attribution records and conservative AI-draft-to-booking matches inside a 14-day window.',
    };
  }

  private averageFirstResponseMinutes(
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
      .map((state) => (state.outbound!.getTime() - state.inbound!.getTime()) / 60000);

    if (responseMinutes.length === 0) return null;
    const avg = responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length;
    return Math.round(avg * 10) / 10;
  }

  private async inferBookingsFromAiDrafts(businessId: string, since: Date) {
    const drafts = await this.prisma.outboundDraft.findMany({
      where: {
        businessId,
        source: 'AI',
        status: 'SENT',
        OR: [{ sentAt: { gte: since } }, { createdAt: { gte: since } }],
      },
      select: {
        customerId: true,
        sentAt: true,
        createdAt: true,
      },
      take: 1000,
    });

    const customerIds = Array.from(new Set(drafts.map((draft) => draft.customerId)));
    if (customerIds.length === 0) return [];

    const bookings = await this.prisma.booking.findMany({
      where: {
        businessId,
        customerId: { in: customerIds },
        createdAt: { gte: since },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      include: { service: { select: { price: true } } },
      take: 1000,
    });

    return bookings
      .filter((booking) =>
        drafts.some((draft) => {
          if (draft.customerId !== booking.customerId) return false;
          const sentAt = draft.sentAt || draft.createdAt;
          const windowEnd = new Date(sentAt);
          windowEnd.setDate(windowEnd.getDate() + ATTRIBUTION_WINDOW_DAYS);
          return booking.createdAt >= sentAt && booking.createdAt <= windowEnd;
        }),
      )
      .map((booking) => ({
        bookingId: booking.id,
        estimatedValue: Number(booking.service?.price) || 0,
      }));
  }
}

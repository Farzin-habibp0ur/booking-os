import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

/**
 * BCC v3 two-metric attribution. Persists one row per platform booking with
 * an attributionReason from the contract set:
 *   WAITLIST_MATCH | AI_BOOKING | QUOTE_FOLLOWUP | CONSULT_FOLLOWUP |
 *   AFTER_HOURS_AI | UNANSWERED_THRESHOLD | ORGANIC
 *
 * `wouldHaveBeenMissed = (attributionReason !== 'ORGANIC')`. Cancelled / no-show
 * bookings are voided (voidedAt set, wouldHaveBeenMissed reset to false) so the
 * dashboard does not credit BCC for bookings that did not happen.
 */
export type AttributionReason =
  | 'WAITLIST_MATCH'
  | 'AI_BOOKING'
  | 'QUOTE_FOLLOWUP'
  | 'CONSULT_FOLLOWUP'
  | 'AFTER_HOURS_AI'
  | 'UNANSWERED_THRESHOLD'
  | 'ORGANIC';

export const ATTRIBUTION_REASONS: AttributionReason[] = [
  'WAITLIST_MATCH',
  'AI_BOOKING',
  'QUOTE_FOLLOWUP',
  'CONSULT_FOLLOWUP',
  'AFTER_HOURS_AI',
  'UNANSWERED_THRESHOLD',
  'ORGANIC',
];

export const BOOKING_ATTRIBUTION_SOURCE = 'BOOKING_ATTRIBUTION_V3';

interface BusinessHours {
  monday?: { open: string; close: string };
  tuesday?: { open: string; close: string };
  wednesday?: { open: string; close: string };
  thursday?: { open: string; close: string };
  friday?: { open: string; close: string };
  saturday?: { open: string; close: string };
  sunday?: { open: string; close: string };
  closed?: string[];
}

const DAY_KEYS: Array<keyof BusinessHours> = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Returns true when `date` is outside the clinic's business hours JSON.
 * If `businessHours` is null/undefined, the clinic is treated as always open
 * (so the AFTER_HOURS_AI rule is effectively gated off).
 *
 * The JSON shape this helper expects:
 *   { monday: { open: "09:00", close: "18:00" }, ..., closed: ["sunday"] }
 */
export function isOutsideBusinessHours(
  date: Date,
  businessHours: BusinessHours | null | undefined,
  timezone?: string | null,
): boolean {
  if (!businessHours || typeof businessHours !== 'object') {
    // No hours configured -> treat as always-open. AFTER_HOURS_AI will not fire.
    return false;
  }

  // Get the day-of-week and hour-of-day in the business timezone if provided.
  let dayName: keyof BusinessHours;
  let hours: number;
  let minutes: number;
  try {
    if (timezone) {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(date);
      const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
      const map: Record<string, keyof BusinessHours> = {
        Sun: 'sunday',
        Mon: 'monday',
        Tue: 'tuesday',
        Wed: 'wednesday',
        Thu: 'thursday',
        Fri: 'friday',
        Sat: 'saturday',
      };
      dayName = map[weekday] || 'monday';
      hours = Number(parts.find((p) => p.type === 'hour')?.value || '0');
      minutes = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    } else {
      dayName = DAY_KEYS[date.getUTCDay()];
      hours = date.getUTCHours();
      minutes = date.getUTCMinutes();
    }
  } catch {
    dayName = DAY_KEYS[date.getUTCDay()];
    hours = date.getUTCHours();
    minutes = date.getUTCMinutes();
  }

  const closedList = Array.isArray(businessHours.closed) ? businessHours.closed : [];
  if (closedList.map((d) => d.toLowerCase()).includes(dayName)) {
    return true;
  }

  const todays = businessHours[dayName] as { open?: string; close?: string } | undefined;
  if (!todays || !todays.open || !todays.close) {
    // Day not configured -> treat as closed (after-hours)
    return true;
  }

  const [openH, openM] = todays.open.split(':').map(Number);
  const [closeH, closeM] = todays.close.split(':').map(Number);
  if (Number.isNaN(openH) || Number.isNaN(openM) || Number.isNaN(closeH) || Number.isNaN(closeM)) {
    return false;
  }
  const minutesNow = hours * 60 + minutes;
  const minutesOpen = openH * 60 + openM;
  const minutesClose = closeH * 60 + closeM;
  return minutesNow < minutesOpen || minutesNow >= minutesClose;
}

type TxClient = PrismaService | any;

@Injectable()
export class FrontDeskAttributionService {
  private readonly logger = new Logger(FrontDeskAttributionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Determine attribution reason and persist a FrontDeskAttribution row keyed
   * by booking.id. Idempotent via upsert on bookingId. Always called inside an
   * existing prisma transaction so the row is committed atomically with the
   * Booking insert.
   */
  async createForBooking(
    tx: TxClient,
    booking: {
      id: string;
      businessId: string;
      customerId: string;
      conversationId?: string | null;
      source?: string | null;
      startTime?: Date | null;
      customFields?: any;
      service?: { kind?: string; price?: number | null } | null;
      serviceId?: string | null;
      amount?: number | null;
      totalPaid?: number | null;
    },
    opts: { conversationId?: string | null } = {},
  ): Promise<void> {
    try {
      const conversationId = opts.conversationId ?? booking.conversationId ?? null;

      const reason = await this.determineReason(tx, booking, conversationId);
      const wouldHaveBeenMissed = reason !== 'ORGANIC';
      const revenueAtBooking = this.resolveRevenueAtBooking(booking);

      await tx.frontDeskAttribution.upsert({
        where: { bookingId: booking.id },
        create: {
          businessId: booking.businessId,
          customerId: booking.customerId,
          conversationId: conversationId || null,
          bookingId: booking.id,
          source: BOOKING_ATTRIBUTION_SOURCE,
          status: 'BOOKED',
          attributionReason: reason,
          wouldHaveBeenMissed,
          revenueAtBooking,
          metadata: {},
        },
        update: {},
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create FrontDeskAttribution for booking ${booking.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Marks the row tied to bookingId as voided so it no longer counts toward
   * the captured / would-have-been-missed metrics. Safe to call repeatedly and
   * a no-op when no row exists.
   */
  async voidForBooking(tx: TxClient, bookingId: string): Promise<void> {
    try {
      await tx.frontDeskAttribution.updateMany({
        where: { bookingId },
        data: {
          voidedAt: new Date(),
          wouldHaveBeenMissed: false,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to void FrontDeskAttribution for booking ${bookingId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Reverses voidForBooking when a booking comes back from CANCELLED.
   * `wouldHaveBeenMissed` is recomputed from the stored `attributionReason`.
   */
  async unvoidForBooking(tx: TxClient, bookingId: string): Promise<void> {
    try {
      const existing = await tx.frontDeskAttribution.findUnique({ where: { bookingId } });
      if (!existing) return;
      await tx.frontDeskAttribution.update({
        where: { bookingId },
        data: {
          voidedAt: null,
          wouldHaveBeenMissed: existing.attributionReason
            ? existing.attributionReason !== 'ORGANIC'
            : false,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to unvoid FrontDeskAttribution for booking ${bookingId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * v3 dashboard summary. Reads only rows with bookingId set (excludes legacy
   * AI-draft attribution rows from outbound.service) and within `days` window.
   */
  async getSummary(businessId: string, days = 30) {
    const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
    const since = new Date();
    since.setDate(since.getDate() - safeDays);

    const [rows, business, responseMessages] = await Promise.all([
      this.prisma.frontDeskAttribution.findMany({
        where: {
          businessId,
          bookingId: { not: null },
          voidedAt: null,
          createdAt: { gte: since },
        },
        select: {
          attributionReason: true,
          wouldHaveBeenMissed: true,
          revenueAtBooking: true,
        },
      }),
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: {
          baselineMonthlyBookings: true,
          baselineMonthlyRevenue: true,
          baselineSource: true,
          baselineCapturedAt: true,
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

    const captured = { count: rows.length, revenue: 0 };
    const missed = { count: 0, revenue: 0 };
    const byReason: Record<string, { count: number; revenue: number }> = {};
    for (const r of ATTRIBUTION_REASONS) byReason[r] = { count: 0, revenue: 0 };

    for (const row of rows) {
      const rev = Number(row.revenueAtBooking) || 0;
      captured.revenue += rev;
      const reason = (row.attributionReason as AttributionReason) || 'ORGANIC';
      if (byReason[reason]) {
        byReason[reason].count += 1;
        byReason[reason].revenue += rev;
      }
      if (row.wouldHaveBeenMissed && reason !== 'ORGANIC') {
        missed.count += 1;
        missed.revenue += rev;
      }
    }

    return {
      days: safeDays,
      captured: {
        count: captured.count,
        revenue: Math.round(captured.revenue * 100) / 100,
      },
      wouldHaveBeenMissed: {
        count: missed.count,
        revenue: Math.round(missed.revenue * 100) / 100,
        byReason: Object.fromEntries(
          Object.entries(byReason).map(([k, v]) => [
            k,
            { count: v.count, revenue: Math.round(v.revenue * 100) / 100 },
          ]),
        ) as Record<AttributionReason, { count: number; revenue: number }>,
      },
      responseTimeMedianMinutes: this.medianFirstResponseMinutes(responseMessages),
      baseline: {
        monthlyBookings: business?.baselineMonthlyBookings ?? null,
        monthlyRevenue:
          business?.baselineMonthlyRevenue != null ? Number(business.baselineMonthlyRevenue) : null,
        source: business?.baselineSource || 'concierge_call',
        capturedAt: business?.baselineCapturedAt || null,
      },
    };
  }

  // --- internals ---

  private resolveRevenueAtBooking(booking: {
    amount?: number | null;
    totalPaid?: number | null;
    service?: { price?: number | null } | null;
  }): number {
    const candidate =
      (booking as any).totalPaid ?? (booking as any).amount ?? booking.service?.price ?? 0;
    const num = Number(candidate);
    return Number.isFinite(num) ? num : 0;
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

    const samples = Array.from(byConversation.values())
      .filter((s) => s.inbound && s.outbound)
      .map((s) => (s.outbound!.getTime() - s.inbound!.getTime()) / 60000)
      .sort((a, b) => a - b);

    if (samples.length === 0) return null;
    const mid = Math.floor(samples.length / 2);
    const median = samples.length % 2 === 0 ? (samples[mid - 1] + samples[mid]) / 2 : samples[mid];
    return Math.round(median * 10) / 10;
  }

  private async determineReason(
    tx: TxClient,
    booking: {
      id: string;
      businessId: string;
      customerId: string;
      source?: string | null;
      startTime?: Date | null;
      customFields?: any;
      service?: { kind?: string } | null;
    },
    conversationId: string | null,
  ): Promise<AttributionReason> {
    // 1. Waitlist match — explicit link from a WaitlistEntry row.
    const waitlist = await tx.waitlistEntry
      .findFirst({
        where: { bookingId: booking.id },
        select: { id: true },
      })
      .catch(() => null);
    if (waitlist) return 'WAITLIST_MATCH';

    // 2. AI booking — booking.source set to AI by the booking assistant.
    if ((booking.source || '').toUpperCase() === 'AI') return 'AI_BOOKING';

    // 3. Quote followup — Booking.customFields.actionCardId points to a
    //    QUOTE_FOLLOWUP action card. Booking has no first-class actionCardId
    //    column today, so we read from customFields.
    const actionCardId =
      (booking.customFields && (booking.customFields as any).actionCardId) || null;
    if (actionCardId) {
      const card = await tx.actionCard
        .findFirst({
          where: {
            id: actionCardId,
            businessId: booking.businessId,
            type: 'QUOTE_FOLLOWUP',
          },
          select: { id: true },
        })
        .catch(() => null);
      if (card) return 'QUOTE_FOLLOWUP';
    }

    // 4. Consult followup — TREATMENT booking within 14 days after a CONSULT
    //    for the same customer that had no prior treatment scheduled.
    if (booking.service?.kind === 'TREATMENT' && booking.startTime) {
      const start = new Date(booking.startTime);
      const fourteenDaysAgo = new Date(start.getTime() - 14 * 24 * 60 * 60 * 1000);
      const consult = await tx.booking
        .findFirst({
          where: {
            businessId: booking.businessId,
            customerId: booking.customerId,
            id: { not: booking.id },
            service: { kind: 'CONSULT' },
            startTime: { gte: fourteenDaysAgo, lte: start },
          },
          select: { id: true, customerId: true, startTime: true },
          orderBy: { startTime: 'desc' },
        })
        .catch(() => null);
      if (consult) {
        // Check that this consult had no prior scheduled treatment between the
        // consult and this booking — i.e. this is the first follow-up.
        const earlierTreatment = await tx.booking
          .findFirst({
            where: {
              businessId: booking.businessId,
              customerId: booking.customerId,
              id: { notIn: [booking.id] },
              service: { kind: 'TREATMENT' },
              startTime: { gt: consult.startTime, lt: start },
            },
            select: { id: true },
          })
          .catch(() => null);
        if (!earlierTreatment) return 'CONSULT_FOLLOWUP';
      }
    }

    // 5/6. Conversation-driven reasons — only if a conversation exists.
    if (conversationId) {
      const messages = await tx.message
        .findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
          take: 50,
          select: { direction: true, createdAt: true, senderStaffId: true },
        })
        .catch(() => [] as any[]);

      const firstInbound = messages.find((m: any) => m.direction === 'INBOUND') || null;
      const firstStaffReply =
        messages.find(
          (m: any) =>
            m.direction === 'OUTBOUND' &&
            m.senderStaffId &&
            firstInbound &&
            new Date(m.createdAt) > new Date(firstInbound.createdAt),
        ) || null;

      const aiDraft = await tx.outboundDraft
        .findFirst({
          where: {
            businessId: booking.businessId,
            conversationId,
            source: 'AI',
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, createdAt: true },
        })
        .catch(() => null);

      if (firstInbound) {
        // 5. AFTER_HOURS_AI
        const business = await tx.business
          .findUnique({
            where: { id: booking.businessId },
            select: { businessHours: true, timezone: true },
          })
          .catch(() => null);
        if (
          aiDraft &&
          isOutsideBusinessHours(
            new Date(firstInbound.createdAt),
            (business?.businessHours as BusinessHours | null) || null,
            business?.timezone || null,
          )
        ) {
          return 'AFTER_HOURS_AI';
        }

        // 6. UNANSWERED_THRESHOLD: > 15 min between first inbound and first
        //    staff reply, AND AI drafted before staff replied.
        if (firstStaffReply && aiDraft) {
          const gapMinutes =
            (new Date(firstStaffReply.createdAt).getTime() -
              new Date(firstInbound.createdAt).getTime()) /
            60000;
          if (
            gapMinutes > 15 &&
            new Date(aiDraft.createdAt) < new Date(firstStaffReply.createdAt)
          ) {
            return 'UNANSWERED_THRESHOLD';
          }
        }
      }
    }

    return 'ORGANIC';
  }
}

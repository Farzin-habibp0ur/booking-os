import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface UsageReport {
  businessId: string;
  startDate: string;
  endDate: string;
  channels: ChannelBreakdown[];
  totals: { inbound: number; outbound: number; total: number };
}

export interface ChannelBreakdown {
  channel: string;
  inbound: number;
  outbound: number;
  total: number;
}

export type ChannelRates = Record<string, { inbound: number; outbound: number }>;

@Injectable()
export class UsageService {
  constructor(private prisma: PrismaService) {}

  /**
   * Atomic upsert — increments today's count for the given channel/direction.
   */
  async recordUsage(businessId: string, channel: string, direction: string): Promise<void> {
    const date = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    await this.prisma.messageUsage.upsert({
      where: {
        businessId_channel_direction_date: {
          businessId,
          channel,
          direction,
          date,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        businessId,
        channel,
        direction,
        date,
        count: 1,
      },
    });
  }

  /**
   * Returns aggregated usage grouped by channel and direction.
   */
  async getUsage(businessId: string, startDate?: string, endDate?: string): Promise<UsageReport> {
    const start = startDate || '2000-01-01';
    const end = endDate || '2099-12-31';

    const records = await this.prisma.messageUsage.findMany({
      where: {
        businessId,
        date: { gte: start, lte: end },
      },
    });

    const channelMap = new Map<string, { inbound: number; outbound: number }>();

    for (const record of records) {
      if (!channelMap.has(record.channel)) {
        channelMap.set(record.channel, { inbound: 0, outbound: 0 });
      }
      const entry = channelMap.get(record.channel)!;
      if (record.direction === 'INBOUND') {
        entry.inbound += record.count;
      } else {
        entry.outbound += record.count;
      }
    }

    const channels: ChannelBreakdown[] = [];
    let totalInbound = 0;
    let totalOutbound = 0;

    for (const [channel, counts] of channelMap) {
      channels.push({
        channel,
        inbound: counts.inbound,
        outbound: counts.outbound,
        total: counts.inbound + counts.outbound,
      });
      totalInbound += counts.inbound;
      totalOutbound += counts.outbound;
    }

    return {
      businessId,
      startDate: start,
      endDate: end,
      channels,
      totals: {
        inbound: totalInbound,
        outbound: totalOutbound,
        total: totalInbound + totalOutbound,
      },
    };
  }

  /**
   * Per-channel breakdown for a given month (e.g. "2026-03").
   */
  async getUsageByChannel(businessId: string, month: string): Promise<ChannelBreakdown[]> {
    const records = await this.prisma.messageUsage.findMany({
      where: {
        businessId,
        date: { startsWith: month },
      },
    });

    const channelMap = new Map<string, { inbound: number; outbound: number }>();

    for (const record of records) {
      if (!channelMap.has(record.channel)) {
        channelMap.set(record.channel, { inbound: 0, outbound: 0 });
      }
      const entry = channelMap.get(record.channel)!;
      if (record.direction === 'INBOUND') {
        entry.inbound += record.count;
      } else {
        entry.outbound += record.count;
      }
    }

    const channels: ChannelBreakdown[] = [];
    for (const [channel, counts] of channelMap) {
      channels.push({
        channel,
        inbound: counts.inbound,
        outbound: counts.outbound,
        total: counts.inbound + counts.outbound,
      });
    }

    return channels;
  }

  /**
   * Per-channel rate table for billing.
   */
  getRates(): ChannelRates {
    return {
      SMS: { inbound: 0.0075, outbound: 0.0079 },
      MMS: { inbound: 0.02, outbound: 0.02 },
      EMAIL: { inbound: 0.00065, outbound: 0.00065 },
      WHATSAPP: { inbound: 0, outbound: 0 },
      INSTAGRAM: { inbound: 0, outbound: 0 },
      FACEBOOK: { inbound: 0, outbound: 0 },
      WEB_CHAT: { inbound: 0, outbound: 0 },
    };
  }

  async reportToStripe(
    businessId: string,
    month: string,
  ): Promise<{ totalCost: number; reported: boolean }> {
    const channels = await this.getUsageByChannel(businessId, month);
    const rates = this.getRates();
    let totalCost = 0;

    for (const ch of channels) {
      const rate = rates[ch.channel];
      if (rate) {
        totalCost += ch.inbound * rate.inbound + ch.outbound * rate.outbound;
      }
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return { totalCost, reported: false };
    }

    // In production, call Stripe metered billing API here
    // For now, log the computed cost
    return { totalCost, reported: false };
  }

  async getAllBusinessUsage(startDate?: string, endDate?: string): Promise<UsageReport[]> {
    const start = startDate || '2000-01-01';
    const end = endDate || '2099-12-31';

    const records = await this.prisma.messageUsage.findMany({
      where: { date: { gte: start, lte: end } },
    });

    const businessMap = new Map<string, Map<string, { inbound: number; outbound: number }>>();

    for (const record of records) {
      if (!businessMap.has(record.businessId)) {
        businessMap.set(record.businessId, new Map());
      }
      const channelMap = businessMap.get(record.businessId)!;
      if (!channelMap.has(record.channel)) {
        channelMap.set(record.channel, { inbound: 0, outbound: 0 });
      }
      const entry = channelMap.get(record.channel)!;
      if (record.direction === 'INBOUND') {
        entry.inbound += record.count;
      } else {
        entry.outbound += record.count;
      }
    }

    const reports: UsageReport[] = [];
    for (const [businessId, channelMap] of businessMap) {
      const channels: ChannelBreakdown[] = [];
      let totalInbound = 0;
      let totalOutbound = 0;

      for (const [channel, counts] of channelMap) {
        channels.push({
          channel,
          inbound: counts.inbound,
          outbound: counts.outbound,
          total: counts.inbound + counts.outbound,
        });
        totalInbound += counts.inbound;
        totalOutbound += counts.outbound;
      }

      reports.push({
        businessId,
        startDate: start,
        endDate: end,
        channels,
        totals: {
          inbound: totalInbound,
          outbound: totalOutbound,
          total: totalInbound + totalOutbound,
        },
      });
    }

    return reports;
  }
}

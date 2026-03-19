import { Test, TestingModule } from '@nestjs/testing';
import { UsageService } from './usage.service';
import { PrismaService } from '../../common/prisma.service';

describe('UsageService', () => {
  let service: UsageService;
  let prisma: {
    messageUsage: {
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      messageUsage: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsageService>(UsageService);
  });

  describe('recordUsage', () => {
    it('upserts a message usage record for today', async () => {
      await service.recordUsage('biz-1', 'WHATSAPP', 'INBOUND');

      expect(prisma.messageUsage.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.messageUsage.upsert.mock.calls[0][0];
      expect(call.where.businessId_channel_direction_date).toEqual({
        businessId: 'biz-1',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
      expect(call.update).toEqual({ count: { increment: 1 } });
      expect(call.create).toMatchObject({
        businessId: 'biz-1',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        count: 1,
      });
    });

    it('handles SMS outbound', async () => {
      await service.recordUsage('biz-2', 'SMS', 'OUTBOUND');

      const call = prisma.messageUsage.upsert.mock.calls[0][0];
      expect(call.where.businessId_channel_direction_date.channel).toBe('SMS');
      expect(call.where.businessId_channel_direction_date.direction).toBe('OUTBOUND');
    });

    it('handles EMAIL channel', async () => {
      await service.recordUsage('biz-1', 'EMAIL', 'OUTBOUND');

      const call = prisma.messageUsage.upsert.mock.calls[0][0];
      expect(call.where.businessId_channel_direction_date.channel).toBe('EMAIL');
    });
  });

  describe('getUsage', () => {
    it('returns empty report when no records', async () => {
      const result = await service.getUsage('biz-1');

      expect(result.businessId).toBe('biz-1');
      expect(result.channels).toEqual([]);
      expect(result.totals).toEqual({ inbound: 0, outbound: 0, total: 0 });
    });

    it('aggregates by channel and direction', async () => {
      prisma.messageUsage.findMany.mockResolvedValue([
        { channel: 'WHATSAPP', direction: 'INBOUND', count: 10 },
        { channel: 'WHATSAPP', direction: 'OUTBOUND', count: 5 },
        { channel: 'SMS', direction: 'OUTBOUND', count: 3 },
      ]);

      const result = await service.getUsage('biz-1', '2026-03-01', '2026-03-31');

      expect(result.channels).toHaveLength(2);
      const whatsapp = result.channels.find((c) => c.channel === 'WHATSAPP');
      expect(whatsapp).toEqual({
        channel: 'WHATSAPP',
        inbound: 10,
        outbound: 5,
        total: 15,
      });
      const sms = result.channels.find((c) => c.channel === 'SMS');
      expect(sms).toEqual({
        channel: 'SMS',
        inbound: 0,
        outbound: 3,
        total: 3,
      });
      expect(result.totals).toEqual({ inbound: 10, outbound: 8, total: 18 });
    });

    it('filters by startDate and endDate', async () => {
      await service.getUsage('biz-1', '2026-03-01', '2026-03-31');

      expect(prisma.messageUsage.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-1',
          date: { gte: '2026-03-01', lte: '2026-03-31' },
        },
      });
    });

    it('uses wide date range when no dates provided', async () => {
      await service.getUsage('biz-1');

      expect(prisma.messageUsage.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-1',
          date: { gte: '2000-01-01', lte: '2099-12-31' },
        },
      });
    });

    it('handles multiple records for the same channel', async () => {
      prisma.messageUsage.findMany.mockResolvedValue([
        { channel: 'EMAIL', direction: 'INBOUND', count: 5 },
        { channel: 'EMAIL', direction: 'INBOUND', count: 3 },
        { channel: 'EMAIL', direction: 'OUTBOUND', count: 7 },
      ]);

      const result = await service.getUsage('biz-1');
      const email = result.channels.find((c) => c.channel === 'EMAIL');
      expect(email!.inbound).toBe(8);
      expect(email!.outbound).toBe(7);
    });
  });

  describe('getUsageByChannel', () => {
    it('returns empty array when no records', async () => {
      const result = await service.getUsageByChannel('biz-1', '2026-03');
      expect(result).toEqual([]);
    });

    it('queries with startsWith for month filter', async () => {
      await service.getUsageByChannel('biz-1', '2026-03');

      expect(prisma.messageUsage.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-1',
          date: { startsWith: '2026-03' },
        },
      });
    });

    it('groups results by channel', async () => {
      prisma.messageUsage.findMany.mockResolvedValue([
        { channel: 'SMS', direction: 'INBOUND', count: 20 },
        { channel: 'SMS', direction: 'OUTBOUND', count: 15 },
        { channel: 'WHATSAPP', direction: 'INBOUND', count: 100 },
      ]);

      const result = await service.getUsageByChannel('biz-1', '2026-03');
      expect(result).toHaveLength(2);

      const sms = result.find((c) => c.channel === 'SMS');
      expect(sms).toEqual({
        channel: 'SMS',
        inbound: 20,
        outbound: 15,
        total: 35,
      });
    });
  });

  describe('getRates', () => {
    it('returns rate table for all channels', () => {
      const rates = service.getRates();

      expect(rates.SMS).toEqual({ inbound: 0.0075, outbound: 0.0079 });
      expect(rates.EMAIL).toEqual({ inbound: 0.00065, outbound: 0.00065 });
    });

    it('returns zero rates for free channels', () => {
      const rates = service.getRates();

      expect(rates.WHATSAPP).toEqual({ inbound: 0, outbound: 0 });
      expect(rates.INSTAGRAM).toEqual({ inbound: 0, outbound: 0 });
      expect(rates.FACEBOOK).toEqual({ inbound: 0, outbound: 0 });
      expect(rates.WEB_CHAT).toEqual({ inbound: 0, outbound: 0 });
    });

    it('includes all 6 channels', () => {
      const rates = service.getRates();
      const channels = Object.keys(rates);

      expect(channels).toHaveLength(6);
      expect(channels).toContain('SMS');
      expect(channels).toContain('EMAIL');
      expect(channels).toContain('WHATSAPP');
      expect(channels).toContain('INSTAGRAM');
      expect(channels).toContain('FACEBOOK');
      expect(channels).toContain('WEB_CHAT');
    });
  });
});

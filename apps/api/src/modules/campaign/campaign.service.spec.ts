import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignDispatchService } from './campaign-dispatch.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

function createMockDispatchService() {
  return {
    prepareSends: jest.fn().mockResolvedValue({ total: 10 }),
    prepareSendsWithVariants: jest.fn().mockResolvedValue({ total: 20 }),
    processSendingCampaigns: jest.fn().mockResolvedValue(undefined),
  };
}

describe('CampaignService', () => {
  let campaignService: CampaignService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dispatchService: ReturnType<typeof createMockDispatchService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    dispatchService = createMockDispatchService();

    const module = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: PrismaService, useValue: prisma },
        { provide: CampaignDispatchService, useValue: dispatchService },
      ],
    }).compile();

    campaignService = module.get(CampaignService);
  });

  describe('create', () => {
    it('creates a draft campaign', async () => {
      const campaign = { id: 'camp1', name: 'Re-engagement', status: 'DRAFT' };
      prisma.campaign.findFirst.mockResolvedValue(null); // No duplicate
      prisma.campaign.create.mockResolvedValue(campaign as any);

      const result = await campaignService.create('biz1', { name: 'Re-engagement' });

      expect(result).toEqual(campaign);
      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          name: 'Re-engagement',
          status: 'DRAFT',
        }),
      });
    });

    it('rejects duplicate campaign name within same business', async () => {
      prisma.campaign.findFirst.mockResolvedValue({ id: 'existing', name: 'Promo' } as any);

      await expect(campaignService.create('biz1', { name: 'Promo' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.campaign.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      prisma.campaign.findMany.mockResolvedValue([{ id: 'camp1' }] as any);
      prisma.campaign.count.mockResolvedValue(1);

      const result = await campaignService.findAll('biz1', {});

      expect(result).toEqual({
        data: [{ id: 'camp1' }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('filters by status', async () => {
      prisma.campaign.findMany.mockResolvedValue([]);
      prisma.campaign.count.mockResolvedValue(0);

      await campaignService.findAll('biz1', { status: 'SENT' });

      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', status: 'SENT' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns campaign scoped to business', async () => {
      const campaign = { id: 'camp1', businessId: 'biz1', status: 'DRAFT' };
      prisma.campaign.findFirst.mockResolvedValue(campaign as any);

      const result = await campaignService.findById('biz1', 'camp1');

      expect(result).toEqual(campaign);
    });

    it('throws if not found', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null);

      await expect(campaignService.findById('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates draft campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue({ id: 'camp1', status: 'DRAFT' } as any);
      prisma.campaign.update.mockResolvedValue({ id: 'camp1', name: 'Updated' } as any);

      const result = await campaignService.update('biz1', 'camp1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('rejects edit of non-draft campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue({ id: 'camp1', status: 'SENT' } as any);

      await expect(campaignService.update('biz1', 'camp1', { name: 'Nope' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('deletes draft campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue({ id: 'camp1', status: 'DRAFT' } as any);
      prisma.campaign.delete.mockResolvedValue({} as any);

      const result = await campaignService.delete('biz1', 'camp1');

      expect(result).toEqual({ deleted: true });
    });

    it('rejects delete of active campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue({ id: 'camp1', status: 'SENDING' } as any);

      await expect(campaignService.delete('biz1', 'camp1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('previewAudience', () => {
    it('returns count and sample customers', async () => {
      prisma.customer.count.mockResolvedValue(15);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Alice', phone: '+1' },
        { id: 'c2', name: 'Bob', phone: '+2' },
      ] as any);

      const result = await campaignService.previewAudience('biz1', { tags: ['vip'] });

      expect(result.count).toBe(15);
      expect(result.samples).toHaveLength(2);
    });

    it('applies tag filter', async () => {
      prisma.customer.count.mockResolvedValue(0);
      prisma.customer.findMany.mockResolvedValue([]);

      await campaignService.previewAudience('biz1', { tags: ['vip'] });

      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          businessId: 'biz1',
          tags: { hasSome: ['vip'] },
        }),
      });
    });

    it('applies noUpcomingBooking filter', async () => {
      prisma.customer.count.mockResolvedValue(0);
      prisma.customer.findMany.mockResolvedValue([]);

      await campaignService.previewAudience('biz1', { noUpcomingBooking: true });

      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          businessId: 'biz1',
          NOT: expect.arrayContaining([
            expect.objectContaining({
              bookings: { some: { startTime: { gte: expect.any(Date) } } },
            }),
          ]),
        }),
      });
    });
  });

  describe('sendCampaign', () => {
    it('prepares sends and sets status to SENDING', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp1',
        status: 'DRAFT',
        filters: { tags: ['vip'] },
      } as any);
      prisma.campaign.update.mockResolvedValue({} as any);

      const result = await campaignService.sendCampaign('biz1', 'camp1');

      expect(result.status).toBe('SENDING');
      expect(result.audienceSize).toBe(10);
      expect(dispatchService.prepareSends).toHaveBeenCalledWith('camp1', 'biz1', { tags: ['vip'] });
    });

    it('rejects sending non-draft campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue({ id: 'camp1', status: 'SENT' } as any);

      await expect(campaignService.sendCampaign('biz1', 'camp1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('create with recurrence', () => {
    it('creates campaign with recurrence rule', async () => {
      const campaign = {
        id: 'camp1',
        name: 'Weekly Promo',
        status: 'DRAFT',
        recurrenceRule: 'WEEKLY',
      };
      prisma.campaign.create.mockResolvedValue(campaign as any);

      const result = await campaignService.create('biz1', {
        name: 'Weekly Promo',
        recurrenceRule: 'WEEKLY',
        scheduledAt: '2026-03-15T10:00:00Z',
      });

      expect(result).toEqual(campaign);
      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recurrenceRule: 'WEEKLY',
          nextRunAt: expect.any(Date),
        }),
      });
    });

    it('defaults recurrence to NONE', async () => {
      prisma.campaign.create.mockResolvedValue({ id: 'camp1' } as any);

      await campaignService.create('biz1', { name: 'One-off' });

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recurrenceRule: 'NONE',
          nextRunAt: null,
        }),
      });
    });
  });

  describe('update with recurrence', () => {
    it('updates recurrence rule on draft campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp1',
        status: 'DRAFT',
        recurrenceRule: 'NONE',
        scheduledAt: new Date('2026-03-15T10:00:00Z'),
      } as any);
      prisma.campaign.update.mockResolvedValue({ id: 'camp1', recurrenceRule: 'MONTHLY' } as any);

      const result = await campaignService.update('biz1', 'camp1', { recurrenceRule: 'MONTHLY' });

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp1' },
        data: expect.objectContaining({
          recurrenceRule: 'MONTHLY',
          nextRunAt: expect.any(Date),
        }),
      });
    });
  });

  describe('stopRecurrence', () => {
    it('sets recurrence to NONE and clears nextRunAt', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp1',
        businessId: 'biz1',
        recurrenceRule: 'WEEKLY',
      } as any);
      prisma.campaign.update.mockResolvedValue({ id: 'camp1', recurrenceRule: 'NONE' } as any);

      await campaignService.stopRecurrence('biz1', 'camp1');

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp1' },
        data: { recurrenceRule: 'NONE', nextRunAt: null },
      });
    });
  });

  // P-16: Expanded filter tests
  describe('buildAudienceWhere — expanded filters', () => {
    it('applies createdAfter filter', () => {
      const where = campaignService.buildAudienceWhere('biz1', {
        createdAfter: '2026-01-01',
      });

      expect(where.createdAt).toEqual(expect.objectContaining({ gte: expect.any(Date) }));
    });

    it('applies createdBefore filter', () => {
      const where = campaignService.buildAudienceWhere('biz1', {
        createdBefore: '2026-06-01',
      });

      expect(where.createdAt).toEqual(expect.objectContaining({ lte: expect.any(Date) }));
    });

    it('applies createdAfter and createdBefore together', () => {
      const where = campaignService.buildAudienceWhere('biz1', {
        createdAfter: '2026-01-01',
        createdBefore: '2026-06-01',
      });

      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });

    it('applies lastVisitDaysAgo filter using none + gte', () => {
      const where = campaignService.buildAudienceWhere('biz1', {
        lastVisitDaysAgo: 30,
      });

      // Should use none: { startTime: { gte: cutoff } } — "no bookings after cutoff"
      expect(where.bookings?.none?.startTime?.gte).toBeInstanceOf(Date);
      // Verify cutoff is approximately 30 days ago
      const cutoff = where.bookings.none.startTime.gte as Date;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 30);
      expect(Math.abs(cutoff.getTime() - expectedCutoff.getTime())).toBeLessThan(5000);
    });

    it('lastVisitDaysAgo: includes customer with only old bookings', () => {
      // Customer visited 90 days ago, filter is 30 days → should be included
      const where = campaignService.buildAudienceWhere('biz1', {
        lastVisitDaysAgo: 30,
      });
      // The none predicate means: no bookings with startTime >= cutoff (30 days ago)
      // A booking 90 days ago has startTime < cutoff, so it does NOT satisfy gte,
      // meaning none: true → customer IS included. Correct.
      expect(where.bookings?.none).toBeDefined();
      expect(where.bookings?.every).toBeUndefined();
    });

    it('lastVisitDaysAgo: does not use every (the bug case)', () => {
      // The old buggy logic used `every` which broke for customers with
      // mixed old+recent bookings. Verify `every` is not used.
      const where = campaignService.buildAudienceWhere('biz1', {
        lastVisitDaysAgo: 30,
      });
      expect(where.bookings?.every).toBeUndefined();
      expect(where.bookings?.none).toBeDefined();
    });

    it('lastVisitDaysAgo: includes customers with no bookings', () => {
      // Customers with zero bookings satisfy none: { ... } vacuously → included
      const where = campaignService.buildAudienceWhere('biz1', {
        lastVisitDaysAgo: 30,
      });
      // none: { startTime: { gte: cutoff } } is true when there are zero bookings
      expect(where.bookings?.none).toBeDefined();
    });
  });

  describe('queryAdvancedAudience', () => {
    it('returns base where when no advanced filters', async () => {
      const result = await campaignService.queryAdvancedAudience('biz1', { tags: ['vip'] });

      expect(result.where).toEqual(expect.objectContaining({ businessId: 'biz1' }));
      expect(result.customerIds).toBeNull();
    });

    it('filters by bookingCountGte', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', _count: { bookings: 5 } },
        { id: 'c2', _count: { bookings: 2 } },
        { id: 'c3', _count: { bookings: 10 } },
      ] as any);

      const result = await campaignService.queryAdvancedAudience('biz1', {
        bookingCountGte: 5,
      });

      expect(result.customerIds).toEqual(['c1', 'c3']);
      expect(result.where.id).toEqual({ in: ['c1', 'c3'] });
    });

    it('filters by bookingCountLte', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', _count: { bookings: 5 } },
        { id: 'c2', _count: { bookings: 2 } },
      ] as any);

      const result = await campaignService.queryAdvancedAudience('biz1', {
        bookingCountLte: 3,
      });

      expect(result.customerIds).toEqual(['c2']);
    });

    it('filters by spentMoreThan', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }] as any);
      prisma.payment.groupBy.mockResolvedValue([
        { customerId: 'c1', _sum: { amount: 500 } },
        { customerId: 'c2', _sum: { amount: 100 } },
      ] as any);

      const result = await campaignService.queryAdvancedAudience('biz1', {
        spentMoreThan: 200,
      });

      expect(result.customerIds).toEqual(['c1']);
    });

    it('filters by spentLessThan', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }] as any);
      prisma.payment.groupBy.mockResolvedValue([
        { customerId: 'c1', _sum: { amount: 500 } },
        { customerId: 'c2', _sum: { amount: 100 } },
      ] as any);

      const result = await campaignService.queryAdvancedAudience('biz1', {
        spentLessThan: 200,
      });

      expect(result.customerIds).toEqual(['c2']);
    });

    it('combines bookingCount and spent filters', async () => {
      // First call: bookingCount filter
      prisma.customer.findMany.mockResolvedValueOnce([
        { id: 'c1', _count: { bookings: 5 } },
        { id: 'c2', _count: { bookings: 10 } },
      ] as any);
      // Payment groupBy
      prisma.payment.groupBy.mockResolvedValue([
        { customerId: 'c1', _sum: { amount: 500 } },
        { customerId: 'c2', _sum: { amount: 100 } },
      ] as any);

      const result = await campaignService.queryAdvancedAudience('biz1', {
        bookingCountGte: 3,
        spentMoreThan: 200,
      });

      expect(result.customerIds).toEqual(['c1']);
    });
  });

  describe('computeNextRun', () => {
    it('adds 1 day for DAILY', () => {
      const base = new Date('2026-03-08T10:00:00Z');
      const next = campaignService.computeNextRun(base, 'DAILY');
      expect(next.toISOString()).toBe('2026-03-09T10:00:00.000Z');
    });

    it('adds 7 days for WEEKLY', () => {
      const base = new Date('2026-03-08T10:00:00Z');
      const next = campaignService.computeNextRun(base, 'WEEKLY');
      expect(next.toISOString()).toBe('2026-03-15T10:00:00.000Z');
    });

    it('adds 14 days for BIWEEKLY', () => {
      const base = new Date('2026-03-08T10:00:00Z');
      const next = campaignService.computeNextRun(base, 'BIWEEKLY');
      expect(next.toISOString()).toBe('2026-03-22T10:00:00.000Z');
    });

    it('adds 1 month for MONTHLY', () => {
      const base = new Date('2026-03-08T10:00:00Z');
      const next = campaignService.computeNextRun(base, 'MONTHLY');
      expect(next.toISOString()).toBe('2026-04-08T10:00:00.000Z');
    });
  });

  // ── P-15: A/B Testing ──────────────────────────────────────────

  describe('validateVariants', () => {
    it('throws if less than 2 variants', () => {
      expect(() =>
        campaignService.validateVariants([{ id: 'a', name: 'A', content: 'hi', percentage: 100 }]),
      ).toThrow(BadRequestException);
    });

    it('throws if variants is undefined', () => {
      expect(() => campaignService.validateVariants(undefined)).toThrow(BadRequestException);
    });

    it('throws if variant missing required fields', () => {
      expect(() =>
        campaignService.validateVariants([
          { id: 'a', name: 'A', content: 'hi', percentage: 50 },
          { id: 'b', name: 'B' },
        ]),
      ).toThrow(BadRequestException);
    });

    it('throws if percentages do not sum to 100', () => {
      expect(() =>
        campaignService.validateVariants([
          { id: 'a', name: 'A', content: 'hi', percentage: 40 },
          { id: 'b', name: 'B', content: 'hey', percentage: 40 },
        ]),
      ).toThrow('Variant percentages must sum to 100');
    });

    it('does not throw for valid variants', () => {
      expect(() =>
        campaignService.validateVariants([
          { id: 'a', name: 'A', content: 'hi', percentage: 50 },
          { id: 'b', name: 'B', content: 'hey', percentage: 50 },
        ]),
      ).not.toThrow();
    });
  });

  describe('create A/B campaign', () => {
    it('creates an A/B test campaign with variants', async () => {
      const variants = [
        { id: 'a', name: 'A', content: 'hi', percentage: 50 },
        { id: 'b', name: 'B', content: 'hey', percentage: 50 },
      ];
      prisma.campaign.create.mockResolvedValue({
        id: 'camp-ab',
        isABTest: true,
        variants,
      } as any);

      const result = await campaignService.create('biz1', {
        name: 'AB Test',
        isABTest: true,
        variants,
      });

      expect(result.isABTest).toBe(true);
      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isABTest: true,
          variants,
        }),
      });
    });

    it('rejects A/B campaign with invalid variants', async () => {
      await expect(
        campaignService.create('biz1', {
          name: 'Bad AB',
          isABTest: true,
          variants: [{ id: 'a', name: 'A', content: 'hi', percentage: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendCampaign A/B', () => {
    it('uses prepareSendsWithVariants for A/B campaign', async () => {
      const variants = [
        { id: 'a', name: 'A', content: 'hi', percentage: 50 },
        { id: 'b', name: 'B', content: 'hey', percentage: 50 },
      ];
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp-ab',
        status: 'DRAFT',
        filters: {},
        isABTest: true,
        variants,
      } as any);
      prisma.campaign.update.mockResolvedValue({} as any);
      dispatchService.prepareSendsWithVariants = jest.fn().mockResolvedValue({ total: 20 });

      const result = await campaignService.sendCampaign('biz1', 'camp-ab');

      expect(result.status).toBe('SENDING');
      expect(result.audienceSize).toBe(20);
      expect(dispatchService.prepareSendsWithVariants).toHaveBeenCalledWith(
        'camp-ab',
        'biz1',
        {},
        variants,
      );
    });
  });

  describe('getVariantStats', () => {
    it('returns grouped stats per variant', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp-ab',
        businessId: 'biz1',
        isABTest: true,
        variants: [
          { id: 'a', name: 'Variant A' },
          { id: 'b', name: 'Variant B' },
        ],
        winnerVariantId: null,
        winnerSelectedAt: null,
      } as any);

      prisma.campaignSend.groupBy.mockResolvedValueOnce([
        { variantId: 'a', status: 'SENT', _count: 10 },
        { variantId: 'a', status: 'DELIVERED', _count: 8 },
        { variantId: 'b', status: 'SENT', _count: 10 },
        { variantId: 'b', status: 'READ', _count: 5 },
      ] as any);

      prisma.campaignSend.groupBy.mockResolvedValueOnce([
        { variantId: 'a', _count: 3 },
        { variantId: 'b', _count: 1 },
      ] as any);

      const result = await campaignService.getVariantStats('biz1', 'camp-ab');

      expect(result.variants).toHaveLength(2);
      const varA = result.variants.find((v: any) => v.variantId === 'a');
      expect(varA.sent).toBe(10);
      expect(varA.delivered).toBe(8);
      expect(varA.bookings).toBe(3);
      const varB = result.variants.find((v: any) => v.variantId === 'b');
      expect(varB.read).toBe(5);
      expect(varB.bookings).toBe(1);
    });

    it('throws if campaign is not A/B test', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp1',
        businessId: 'biz1',
        isABTest: false,
      } as any);

      await expect(campaignService.getVariantStats('biz1', 'camp1')).rejects.toThrow(
        'Campaign is not an A/B test',
      );
    });
  });

  describe('selectWinner', () => {
    it('sets winnerVariantId on campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp-ab',
        businessId: 'biz1',
        isABTest: true,
        variants: [{ id: 'a' }, { id: 'b' }],
      } as any);
      prisma.campaign.update.mockResolvedValue({
        id: 'camp-ab',
        winnerVariantId: 'a',
      } as any);

      const result = await campaignService.selectWinner('biz1', 'camp-ab', 'a');

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-ab' },
        data: {
          winnerVariantId: 'a',
          winnerSelectedAt: expect.any(Date),
        },
      });
    });

    it('throws if campaign is not A/B test', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp1',
        businessId: 'biz1',
        isABTest: false,
      } as any);

      await expect(campaignService.selectWinner('biz1', 'camp1', 'a')).rejects.toThrow(
        'Campaign is not an A/B test',
      );
    });

    it('throws if variant does not exist', async () => {
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'camp-ab',
        businessId: 'biz1',
        isABTest: true,
        variants: [{ id: 'a' }, { id: 'b' }],
      } as any);

      await expect(campaignService.selectWinner('biz1', 'camp-ab', 'nonexistent')).rejects.toThrow(
        'Variant not found in campaign',
      );
    });
  });
});

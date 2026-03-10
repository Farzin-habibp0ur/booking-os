import { Test } from '@nestjs/testing';
import { CampaignDispatchService } from './campaign-dispatch.service';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

function createMockCampaignService() {
  return {
    computeNextRun: jest.fn((date: Date, rule: string) => {
      const next = new Date(date);
      switch (rule) {
        case 'DAILY':
          next.setDate(next.getDate() + 1);
          break;
        case 'WEEKLY':
          next.setDate(next.getDate() + 7);
          break;
        case 'BIWEEKLY':
          next.setDate(next.getDate() + 14);
          break;
        case 'MONTHLY':
          next.setMonth(next.getMonth() + 1);
          break;
      }
      return next;
    }),
    queryAdvancedAudience: jest.fn().mockResolvedValue({
      where: { businessId: 'biz1' },
      customerIds: null,
    }),
  };
}

describe('CampaignDispatchService', () => {
  let dispatchService: CampaignDispatchService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let campaignService: ReturnType<typeof createMockCampaignService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    campaignService = createMockCampaignService();

    const module = await Test.createTestingModule({
      providers: [
        CampaignDispatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: CampaignService, useValue: campaignService },
      ],
    }).compile();

    dispatchService = module.get(CampaignDispatchService);
  });

  describe('prepareSends', () => {
    it('creates send rows for matching customers', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] as any);
      prisma.campaignSend.createMany.mockResolvedValue({ count: 3 } as any);

      const result = await dispatchService.prepareSends('camp1', 'biz1', { tags: ['vip'] });

      expect(result.total).toBe(3);
      expect(prisma.campaignSend.createMany).toHaveBeenCalledWith({
        data: [
          { campaignId: 'camp1', customerId: 'c1', status: 'PENDING' },
          { campaignId: 'camp1', customerId: 'c2', status: 'PENDING' },
          { campaignId: 'camp1', customerId: 'c3', status: 'PENDING' },
        ],
      });
    });

    it('returns zero when no matching customers', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const result = await dispatchService.prepareSends('camp1', 'biz1', {});

      expect(result.total).toBe(0);
      expect(prisma.campaignSend.createMany).not.toHaveBeenCalled();
    });
  });

  describe('processSendingCampaigns', () => {
    it('marks campaign as SENT when all sends complete', async () => {
      prisma.campaign.findMany.mockResolvedValue([{ id: 'camp1', throttlePerMinute: 10 }] as any);
      // No pending sends left
      prisma.campaignSend.findMany.mockResolvedValue([]);
      prisma.campaignSend.groupBy.mockResolvedValue([{ status: 'SENT', _count: 5 }] as any);
      prisma.campaignSend.count.mockResolvedValue(2);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'camp1' },
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('processes pending sends with throttle', async () => {
      prisma.campaign.findMany.mockResolvedValue([{ id: 'camp1', throttlePerMinute: 2 }] as any);
      const pendingSends = [
        { id: 's1', campaign: {} },
        { id: 's2', campaign: {} },
      ];
      prisma.campaignSend.findMany.mockResolvedValue(pendingSends as any);
      prisma.campaignSend.update.mockResolvedValue({} as any);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(prisma.campaignSend.update).toHaveBeenCalledTimes(2);
      expect(prisma.campaignSend.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
    });

    it('schedules next recurrence when campaign with WEEKLY rule completes', async () => {
      const campaign = {
        id: 'camp1',
        businessId: 'biz1',
        name: 'Weekly Promo',
        throttlePerMinute: 10,
        recurrenceRule: 'WEEKLY',
        templateId: 'tmpl1',
        filters: { tags: ['vip'] },
        scheduledAt: new Date('2026-03-08T10:00:00Z'),
        sentAt: null,
        parentCampaignId: null,
      };
      prisma.campaign.findMany.mockResolvedValue([campaign] as any);
      prisma.campaignSend.findMany.mockResolvedValue([]); // No pending sends
      prisma.campaignSend.groupBy.mockResolvedValue([{ status: 'SENT', _count: 5 }] as any);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);
      prisma.campaign.create.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      // Should mark as SENT
      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'camp1' },
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );

      // Should create next occurrence
      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          name: 'Weekly Promo',
          status: 'DRAFT',
          templateId: 'tmpl1',
          recurrenceRule: 'WEEKLY',
          parentCampaignId: 'camp1',
          scheduledAt: expect.any(Date),
          nextRunAt: expect.any(Date),
        }),
      });
    });

    it('does not schedule next recurrence for NONE rule', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'camp1',
          throttlePerMinute: 10,
          recurrenceRule: 'NONE',
        },
      ] as any);
      prisma.campaignSend.findMany.mockResolvedValue([]);
      prisma.campaignSend.groupBy.mockResolvedValue([{ status: 'SENT', _count: 5 }] as any);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      // Should NOT create a new campaign
      expect(prisma.campaign.create).not.toHaveBeenCalled();
    });
  });

  describe('scheduleNextRecurrence', () => {
    it('creates child campaign with correct parent reference', async () => {
      prisma.campaign.create.mockResolvedValue({} as any);

      await dispatchService.scheduleNextRecurrence({
        id: 'camp1',
        businessId: 'biz1',
        name: 'Monthly Newsletter',
        recurrenceRule: 'MONTHLY',
        templateId: 'tmpl1',
        filters: { tags: ['all'] },
        throttlePerMinute: 20,
        scheduledAt: new Date('2026-03-15T10:00:00Z'),
        sentAt: new Date('2026-03-15T10:05:00Z'),
        parentCampaignId: null,
      });

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentCampaignId: 'camp1',
          recurrenceRule: 'MONTHLY',
          scheduledAt: expect.any(Date),
        }),
      });
    });

    it('preserves original parent for chain of recurring campaigns', async () => {
      prisma.campaign.create.mockResolvedValue({} as any);

      await dispatchService.scheduleNextRecurrence({
        id: 'camp3',
        businessId: 'biz1',
        name: 'Daily Reminder',
        recurrenceRule: 'DAILY',
        templateId: null,
        filters: {},
        throttlePerMinute: 10,
        scheduledAt: new Date('2026-03-10T08:00:00Z'),
        sentAt: new Date('2026-03-10T08:01:00Z'),
        parentCampaignId: 'camp1', // original parent
      });

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentCampaignId: 'camp1', // should keep original parent, not camp3
        }),
      });
    });

    it('skips scheduling for NONE recurrence', async () => {
      await dispatchService.scheduleNextRecurrence({
        id: 'camp1',
        recurrenceRule: 'NONE',
      });

      expect(prisma.campaign.create).not.toHaveBeenCalled();
    });

    it('skips scheduling when no recurrence rule', async () => {
      await dispatchService.scheduleNextRecurrence({
        id: 'camp1',
      });

      expect(prisma.campaign.create).not.toHaveBeenCalled();
    });
  });
});

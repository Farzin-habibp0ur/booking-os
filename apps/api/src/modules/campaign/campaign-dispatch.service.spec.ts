import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { CampaignDispatchService } from './campaign-dispatch.service';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../../common/prisma.service';
import { UsageService } from '../usage/usage.service';
import { DeadLetterQueueService } from '../../common/queue/dead-letter.service';
import { AutomationExecutorService } from '../automation/automation-executor.service';
import { TrackingService } from '../tracking/tracking.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
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
    sendCampaign: jest.fn().mockResolvedValue({ status: 'SENDING', audienceSize: 5 }),
    getVariantStats: jest.fn().mockResolvedValue({
      variants: [
        { variantId: 'a', name: 'A', sent: 10, read: 8, bookings: 3 },
        { variantId: 'b', name: 'B', sent: 10, read: 4, bookings: 1 },
      ],
    }),
    selectWinner: jest.fn().mockResolvedValue({}),
    rolloutWinner: jest.fn().mockResolvedValue({ total: 30 }),
    getFrequencyCapExclusions: jest.fn().mockResolvedValue([]),
  };
}

describe('CampaignDispatchService', () => {
  let dispatchService: CampaignDispatchService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let campaignService: ReturnType<typeof createMockCampaignService>;
  let notificationQueue: { add: jest.Mock };
  let usageService: { recordUsage: jest.Mock };
  let dlqService: { capture: jest.Mock };
  let automationExecutor: { evaluateTrigger: jest.Mock };
  let trackingService: { wrapUrlsInContent: jest.Mock; generateTrackingPixel: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    campaignService = createMockCampaignService();
    notificationQueue = { add: jest.fn().mockResolvedValue({}) };
    usageService = { recordUsage: jest.fn().mockResolvedValue(undefined) };
    dlqService = { capture: jest.fn().mockResolvedValue('dlq-1') };
    automationExecutor = { evaluateTrigger: jest.fn().mockResolvedValue(undefined) };
    trackingService = {
      wrapUrlsInContent: jest.fn((content: string) => `[tracked]${content}`),
      generateTrackingPixel: jest.fn(() => '<img tracking-pixel />'),
    };

    const module = await Test.createTestingModule({
      providers: [
        CampaignDispatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: CampaignService, useValue: campaignService },
        { provide: UsageService, useValue: usageService },
        { provide: DeadLetterQueueService, useValue: dlqService },
        { provide: AutomationExecutorService, useValue: automationExecutor },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: notificationQueue },
        { provide: TrackingService, useValue: trackingService },
      ],
    }).compile();

    dispatchService = module.get(CampaignDispatchService);

    // Default mock for business fetch
    prisma.business.findUnique.mockResolvedValue({ id: 'biz1', name: 'Test Biz' } as any);
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

    it('processes pending sends and enqueues to notification queue', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'camp1',
          businessId: 'biz1',
          throttlePerMinute: 2,
          channel: 'WHATSAPP',
          variants: [{ id: 'v1', content: 'Hello!' }],
        },
      ] as any);
      const pendingSends = [
        { id: 's1', customerId: 'c1', campaign: {} },
        { id: 's2', customerId: 'c2', campaign: {} },
      ];
      prisma.campaignSend.findMany.mockResolvedValue(pendingSends as any);
      prisma.customer.findUnique
        .mockResolvedValueOnce({
          id: 'c1',
          name: 'Alice',
          phone: '+1234567890',
          email: null,
        } as any)
        .mockResolvedValueOnce({ id: 'c2', name: 'Bob', phone: '+0987654321', email: null } as any);
      prisma.campaignSend.update.mockResolvedValue({} as any);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(prisma.campaignSend.update).toHaveBeenCalledTimes(2);
      expect(prisma.campaignSend.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'SENT', sentAt: expect.any(Date), channel: 'WHATSAPP' },
      });
      expect(notificationQueue.add).toHaveBeenCalledTimes(2);
      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'WHATSAPP', 'OUTBOUND');
    });

    it('wraps URLs in content for click tracking', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'camp1',
          businessId: 'biz1',
          throttlePerMinute: 10,
          channel: 'WHATSAPP',
          variants: [{ id: 'v1', content: 'Visit https://example.com' }],
        },
      ] as any);
      prisma.campaign.findUnique.mockResolvedValue({ status: 'SENDING' } as any);
      prisma.campaignSend.findMany.mockResolvedValue([
        { id: 's1', customerId: 'c1', campaign: {} },
      ] as any);
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Alice',
        phone: '+123',
        email: null,
      } as any);
      prisma.campaignSend.update.mockResolvedValue({} as any);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(trackingService.wrapUrlsInContent).toHaveBeenCalled();
    });

    it('adds tracking pixel only for EMAIL channel', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'camp1',
          businessId: 'biz1',
          throttlePerMinute: 10,
          channel: 'EMAIL',
          variants: [{ id: 'v1', content: 'Hello!' }],
        },
      ] as any);
      prisma.campaign.findUnique.mockResolvedValue({ status: 'SENDING' } as any);
      prisma.campaignSend.findMany.mockResolvedValue([
        { id: 's1', customerId: 'c1', campaign: {} },
      ] as any);
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Alice',
        phone: null,
        email: 'alice@test.com',
      } as any);
      prisma.campaignSend.update.mockResolvedValue({} as any);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(trackingService.generateTrackingPixel).toHaveBeenCalledWith('s1', expect.any(String));
    });

    it('does not add tracking pixel for non-EMAIL channels', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'camp1',
          businessId: 'biz1',
          throttlePerMinute: 10,
          channel: 'SMS',
          variants: [{ id: 'v1', content: 'Hello!' }],
        },
      ] as any);
      prisma.campaign.findUnique.mockResolvedValue({ status: 'SENDING' } as any);
      prisma.campaignSend.findMany.mockResolvedValue([
        { id: 's1', customerId: 'c1', campaign: {} },
      ] as any);
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Alice',
        phone: '+123',
        email: null,
      } as any);
      prisma.campaignSend.update.mockResolvedValue({} as any);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(trackingService.generateTrackingPixel).not.toHaveBeenCalled();
    });

    it('skips processing if campaign is cancelled before send loop', async () => {
      prisma.campaign.findMany.mockResolvedValue([{ id: 'camp1', throttlePerMinute: 10 }] as any);
      // Re-fetch returns CANCELLED
      prisma.campaign.findUnique.mockResolvedValue({ status: 'CANCELLED' } as any);

      await dispatchService.processSendingCampaigns();

      // Should not query for pending sends
      expect(prisma.campaignSend.findMany).not.toHaveBeenCalled();
    });

    it('does not mark campaign SENT if cancelled during processing', async () => {
      prisma.campaign.findMany.mockResolvedValue([{ id: 'camp1', throttlePerMinute: 10 }] as any);
      // First findUnique: campaign still SENDING (race condition guard at top)
      // Second findUnique: campaign now CANCELLED (race condition guard before SENT)
      prisma.campaign.findUnique
        .mockResolvedValueOnce({ status: 'SENDING' } as any)
        .mockResolvedValueOnce({ status: 'CANCELLED' } as any);
      prisma.campaignSend.findMany.mockResolvedValue([]); // No pending sends

      await dispatchService.processSendingCampaigns();

      // Should NOT update to SENT
      expect(prisma.campaign.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('marks send as FAILED when customer has no contact info for channel', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'camp1',
          businessId: 'biz1',
          throttlePerMinute: 10,
          channel: 'WHATSAPP',
          variants: [],
        },
      ] as any);
      prisma.campaignSend.findMany.mockResolvedValue([
        { id: 's1', customerId: 'c1', campaign: {} },
      ] as any);
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'NoPhone',
        phone: null,
        email: null,
      } as any);
      prisma.campaignSend.update.mockResolvedValue({} as any);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(prisma.campaignSend.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'FAILED', channel: 'WHATSAPP' },
      });
      expect(notificationQueue.add).not.toHaveBeenCalled();
    });

    it('captures failed sends to DLQ', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'camp1',
          businessId: 'biz1',
          throttlePerMinute: 10,
          channel: 'SMS',
          variants: [{ id: 'v1', content: 'Hi' }],
        },
      ] as any);
      prisma.campaignSend.findMany.mockResolvedValue([
        { id: 's1', customerId: 'c1', campaign: {} },
      ] as any);
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Alice',
        phone: '+123',
        email: null,
      } as any);
      notificationQueue.add.mockRejectedValue(new Error('Queue error'));
      prisma.campaignSend.update.mockResolvedValue({} as any);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      expect(prisma.campaignSend.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'FAILED', channel: 'SMS' },
      });
      expect(dlqService.capture).toHaveBeenCalled();
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

  describe('processScheduledCampaigns', () => {
    it('finds past-scheduled campaigns and calls sendCampaign', async () => {
      const pastDate = new Date(Date.now() - 60000);
      prisma.campaign.findMany.mockResolvedValue([
        { id: 'camp1', businessId: 'biz1', name: 'Scheduled Promo', scheduledAt: pastDate },
      ] as any);

      await dispatchService.processScheduledCampaigns();

      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: expect.any(Date) },
        },
      });
      expect(campaignService.sendCampaign).toHaveBeenCalledWith('biz1', 'camp1');
    });

    it('does not process future-scheduled campaigns', async () => {
      prisma.campaign.findMany.mockResolvedValue([]);

      await dispatchService.processScheduledCampaigns();

      expect(campaignService.sendCampaign).not.toHaveBeenCalled();
    });

    it('continues processing when one campaign fails', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        { id: 'camp1', businessId: 'biz1', name: 'Fail' },
        { id: 'camp2', businessId: 'biz1', name: 'Success' },
      ] as any);
      campaignService.sendCampaign
        .mockRejectedValueOnce(new Error('Send failed'))
        .mockResolvedValueOnce({ status: 'SENDING' });

      await dispatchService.processScheduledCampaigns();

      expect(campaignService.sendCampaign).toHaveBeenCalledTimes(2);
      expect(campaignService.sendCampaign).toHaveBeenCalledWith('biz1', 'camp2');
    });
  });

  describe('prepareSendsWithVariants with testPercent', () => {
    it('limits audience when testPercent is provided', async () => {
      prisma.customer.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({ id: `c${i}` })) as any,
      );
      prisma.campaignSend.createMany.mockResolvedValue({ count: 20 } as any);

      const result = await dispatchService.prepareSendsWithVariants(
        'camp1',
        'biz1',
        {},
        [
          { id: 'a', percentage: 50 },
          { id: 'b', percentage: 50 },
        ],
        20,
      );

      // 20% of 100 = 20 customers
      expect(result.total).toBe(20);
      expect(result.totalAudience).toBe(100);
    });

    it('uses full audience when testPercent is not provided', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1' },
        { id: 'c2' },
        { id: 'c3' },
        { id: 'c4' },
      ] as any);
      prisma.campaignSend.createMany.mockResolvedValue({ count: 4 } as any);

      const result = await dispatchService.prepareSendsWithVariants('camp1', 'biz1', {}, [
        { id: 'a', percentage: 50 },
        { id: 'b', percentage: 50 },
      ]);

      expect(result.total).toBe(4);
      expect(result.totalAudience).toBe(4);
    });
  });

  describe('processABTestResults', () => {
    it('finds eligible campaigns and selects winner by READ_RATE', async () => {
      const campaign = {
        id: 'camp-ab',
        businessId: 'biz1',
        isABTest: true,
        winnerMetric: 'READ_RATE',
        variants: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
      };
      prisma.campaign.findMany.mockResolvedValue([campaign] as any);
      prisma.campaign.update.mockResolvedValue({} as any);
      // getVariantStats returns variant 'a' with higher read rate
      campaignService.getVariantStats.mockResolvedValue({
        variants: [
          { variantId: 'a', sent: 10, read: 8, bookings: 2 },
          { variantId: 'b', sent: 10, read: 3, bookings: 1 },
        ],
      });

      await dispatchService.processABTestResults();

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-ab' },
        data: { autoWinnerSelected: true },
      });
      expect(campaignService.selectWinner).toHaveBeenCalledWith('biz1', 'camp-ab', 'a');
      expect(campaignService.rolloutWinner).toHaveBeenCalledWith('biz1', 'camp-ab', 'a');
    });

    it('selects winner by BOOKING_RATE', async () => {
      const campaign = {
        id: 'camp-ab',
        businessId: 'biz1',
        isABTest: true,
        winnerMetric: 'BOOKING_RATE',
        variants: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
      };
      prisma.campaign.findMany.mockResolvedValue([campaign] as any);
      prisma.campaign.update.mockResolvedValue({} as any);
      // Variant 'b' has higher booking rate
      campaignService.getVariantStats.mockResolvedValue({
        variants: [
          { variantId: 'a', sent: 10, read: 8, bookings: 1 },
          { variantId: 'b', sent: 10, read: 3, bookings: 5 },
        ],
      });

      await dispatchService.processABTestResults();

      expect(campaignService.selectWinner).toHaveBeenCalledWith('biz1', 'camp-ab', 'b');
    });

    it('uses read count tiebreaker when rates are inconclusive', async () => {
      const campaign = {
        id: 'camp-ab',
        businessId: 'biz1',
        isABTest: true,
        winnerMetric: 'READ_RATE',
        variants: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
      };
      prisma.campaign.findMany.mockResolvedValue([campaign] as any);
      prisma.campaign.update.mockResolvedValue({} as any);
      // Very close read rates (<5%), but 'b' has more absolute reads
      campaignService.getVariantStats.mockResolvedValue({
        variants: [
          { variantId: 'a', sent: 100, read: 30, bookings: 2 },
          { variantId: 'b', sent: 100, read: 32, bookings: 1 },
        ],
      });

      await dispatchService.processABTestResults();

      // 'b' has 32 reads vs 'a' 30 reads (tiebreaker by absolute read count)
      expect(campaignService.selectWinner).toHaveBeenCalledWith('biz1', 'camp-ab', 'b');
    });

    it('skips when no eligible campaigns', async () => {
      prisma.campaign.findMany.mockResolvedValue([]);

      await dispatchService.processABTestResults();

      expect(campaignService.selectWinner).not.toHaveBeenCalled();
    });
  });

  describe('prepareSends with frequency cap', () => {
    it('excludes frequency-capped customers', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] as any);
      campaignService.getFrequencyCapExclusions.mockResolvedValue(['c2']);
      prisma.campaignSend.createMany.mockResolvedValue({ count: 2 } as any);

      const result = await dispatchService.prepareSends('camp1', 'biz1', {});

      expect(result.total).toBe(2);
      expect(prisma.campaignSend.createMany).toHaveBeenCalledWith({
        data: [
          { campaignId: 'camp1', customerId: 'c1', status: 'PENDING' },
          { campaignId: 'camp1', customerId: 'c3', status: 'PENDING' },
        ],
      });
    });
  });

  describe('processCampaign quiet hours', () => {
    it('skips dispatch during quiet hours', async () => {
      // Mock Date.now to a known time (10:00 UTC)
      const mockDate = new Date('2026-04-05T10:00:00Z');
      jest.useFakeTimers({ now: mockDate });

      prisma.campaign.findMany.mockResolvedValue([
        { id: 'camp1', businessId: 'biz1', throttlePerMinute: 10 },
      ] as any);
      prisma.campaign.findUnique.mockResolvedValue({ status: 'SENDING' } as any);
      // Quiet hours 09:00-11:00 UTC covers the mocked time of 10:00
      prisma.business.findUnique.mockResolvedValue({
        name: 'Test Biz',
        campaignPreferences: {
          quietHours: { start: '09:00', end: '11:00', timezone: 'UTC' },
        },
      } as any);

      await dispatchService.processSendingCampaigns();

      // Should not query for pending sends
      expect(prisma.campaignSend.findMany).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('proceeds when outside quiet hours', async () => {
      prisma.campaign.findMany.mockResolvedValue([
        { id: 'camp1', businessId: 'biz1', throttlePerMinute: 10 },
      ] as any);
      prisma.campaign.findUnique.mockResolvedValue({ status: 'SENDING' } as any);
      // No quiet hours configured
      prisma.business.findUnique.mockResolvedValue({
        name: 'Test Biz',
        campaignPreferences: {},
      } as any);
      prisma.campaignSend.findMany.mockResolvedValue([]);
      prisma.campaignSend.groupBy.mockResolvedValue([]);
      prisma.campaignSend.count.mockResolvedValue(0);
      prisma.campaign.update.mockResolvedValue({} as any);

      await dispatchService.processSendingCampaigns();

      // Should query for pending sends (normal flow)
      expect(prisma.campaignSend.findMany).toHaveBeenCalled();
    });
  });
});

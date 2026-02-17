import { Test } from '@nestjs/testing';
import { CampaignDispatchService } from './campaign-dispatch.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('CampaignDispatchService', () => {
  let dispatchService: CampaignDispatchService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [CampaignDispatchService, { provide: PrismaService, useValue: prisma }],
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
  });
});

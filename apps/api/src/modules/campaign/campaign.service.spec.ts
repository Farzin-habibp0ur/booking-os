import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('CampaignService', () => {
  let campaignService: CampaignService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    campaignService = module.get(CampaignService);
  });

  describe('create', () => {
    it('creates a draft campaign', async () => {
      const campaign = { id: 'camp1', name: 'Re-engagement', status: 'DRAFT' };
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

      await expect(
        campaignService.update('biz1', 'camp1', { name: 'Nope' }),
      ).rejects.toThrow(BadRequestException);
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
          NOT: expect.objectContaining({
            bookings: { some: { startTime: { gte: expect.any(Date) } } },
          }),
        }),
      });
    });
  });
});

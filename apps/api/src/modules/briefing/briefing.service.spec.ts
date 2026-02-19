import { Test } from '@nestjs/testing';
import { BriefingService } from './briefing.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('BriefingService', () => {
  let service: BriefingService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [BriefingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BriefingService);
  });

  describe('getBriefing', () => {
    const bizId = 'biz-1';

    it('groups cards by category in correct order', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          type: 'DEPOSIT_PENDING',
          category: 'URGENT_TODAY',
          priority: 90,
          title: 'Deposit needed',
          description: 'Test',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: 'card-2',
          type: 'OPEN_SLOT',
          category: 'OPPORTUNITY',
          priority: 60,
          title: 'Open slot',
          description: 'Test',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: 'card-3',
          type: 'STALLED_QUOTE',
          category: 'NEEDS_APPROVAL',
          priority: 70,
          title: 'Quote follow-up',
          description: 'Test',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.getBriefing(bizId);

      expect(result.groups).toHaveLength(3);
      expect(result.groups[0].category).toBe('URGENT_TODAY');
      expect(result.groups[1].category).toBe('NEEDS_APPROVAL');
      expect(result.groups[2].category).toBe('OPPORTUNITY');
      expect(result.totalPending).toBe(3);
      expect(result.urgentCount).toBe(1);
    });

    it('returns empty groups when no pending cards', async () => {
      prisma.actionCard.findMany.mockResolvedValue([] as any);

      const result = await service.getBriefing(bizId);

      expect(result.groups).toHaveLength(0);
      expect(result.totalPending).toBe(0);
      expect(result.urgentCount).toBe(0);
      expect(result.lastRefreshed).toBeInstanceOf(Date);
    });

    it('filters by staff for non-admin roles', async () => {
      prisma.actionCard.findMany.mockResolvedValue([] as any);

      await service.getBriefing(bizId, 'staff-1', 'AGENT');

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: bizId,
            status: 'PENDING',
            OR: [{ staffId: 'staff-1' }, { staffId: null }],
          }),
        }),
      );
    });

    it('does not filter by staff for ADMIN role', async () => {
      prisma.actionCard.findMany.mockResolvedValue([] as any);

      await service.getBriefing(bizId, 'admin-1', 'ADMIN');

      const call = prisma.actionCard.findMany.mock.calls[0]?.[0] as any;
      expect(call?.where?.OR).toBeUndefined();
    });

    it('multiple cards in same category grouped together', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          category: 'URGENT_TODAY',
          priority: 90,
          title: 'A',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: 'card-2',
          category: 'URGENT_TODAY',
          priority: 85,
          title: 'B',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.getBriefing(bizId);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].cards).toHaveLength(2);
      expect(result.urgentCount).toBe(2);
    });

    it('includes category labels', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          category: 'OPPORTUNITY',
          priority: 60,
          title: 'Test',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.getBriefing(bizId);

      expect(result.groups[0].label).toBe('Opportunities');
    });

    it('handles cards with unknown categories', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          category: 'CUSTOM_CATEGORY',
          priority: 50,
          title: 'Custom',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.getBriefing(bizId);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].category).toBe('CUSTOM_CATEGORY');
    });

    it('all four standard categories in correct order', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        {
          id: '1',
          category: 'HYGIENE',
          priority: 30,
          title: 'H',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: '2',
          category: 'OPPORTUNITY',
          priority: 60,
          title: 'O',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: '3',
          category: 'URGENT_TODAY',
          priority: 90,
          title: 'U',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: '4',
          category: 'NEEDS_APPROVAL',
          priority: 70,
          title: 'N',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.getBriefing(bizId);

      expect(result.groups.map((g) => g.category)).toEqual([
        'URGENT_TODAY',
        'NEEDS_APPROVAL',
        'OPPORTUNITY',
        'HYGIENE',
      ]);
    });
  });

  describe('getOpportunities', () => {
    it('returns only OPPORTUNITY category cards', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        { id: 'opp-1', category: 'OPPORTUNITY', type: 'OPEN_SLOT', title: 'Open slot' },
      ] as any);

      const result = await service.getOpportunities('biz-1');

      expect(result).toHaveLength(1);
      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz-1',
            status: 'PENDING',
            category: 'OPPORTUNITY',
          },
        }),
      );
    });

    it('returns empty for no opportunities', async () => {
      prisma.actionCard.findMany.mockResolvedValue([] as any);

      const result = await service.getOpportunities('biz-1');

      expect(result).toHaveLength(0);
    });
  });
});

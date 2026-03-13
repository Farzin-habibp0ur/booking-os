import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AbTestingService } from './ab-testing.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('AbTestingService', () => {
  let service: AbTestingService;
  let prisma: MockPrisma;

  const mockTest = {
    id: 'test1',
    businessId: 'biz1',
    name: 'CTA Button Test',
    status: 'DRAFT',
    metric: 'cta_text',
    startedAt: null,
    endedAt: null,
    winnerVariantId: null,
    confidence: null,
    metadata: { elementType: 'cta_text', winThreshold: 0.15 },
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    variants: [
      { id: 'v1', variantLabel: 'control', impressions: 500, clicks: 50, conversions: 10, engagementScore: 0.1, isWinner: false, metadata: { text: 'Sign Up' } },
      { id: 'v2', variantLabel: 'test', impressions: 500, clicks: 75, conversions: 15, engagementScore: 0.15, isWinner: false, metadata: { text: 'Get Started' } },
    ],
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AbTestingService(prisma as any);
  });

  describe('create', () => {
    it('creates test with control and test variants', async () => {
      prisma.aBTest.count.mockResolvedValue(0);
      prisma.aBTest.create.mockResolvedValue({ id: 'test1' } as any);
      prisma.aBTestVariant.create.mockResolvedValue({} as any);
      prisma.aBTest.findFirst.mockResolvedValue(mockTest as any);

      const result = await service.create('biz1', {
        name: 'CTA Button Test',
        elementType: 'cta_text',
        controlVariant: { text: 'Sign Up' },
        testVariant: { text: 'Get Started' },
      } as any);

      expect(prisma.aBTest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          name: 'CTA Button Test',
          status: 'DRAFT',
          metric: 'cta_text',
        }),
      });
      expect(prisma.aBTestVariant.create).toHaveBeenCalledTimes(2);
    });

    it('enforces max 3 active tests', async () => {
      prisma.aBTest.count.mockResolvedValue(3);

      await expect(
        service.create('biz1', {
          name: 'Too many',
          elementType: 'cta_text',
          controlVariant: {},
          testVariant: {},
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses default win threshold of 0.15', async () => {
      prisma.aBTest.count.mockResolvedValue(0);
      prisma.aBTest.create.mockResolvedValue({ id: 'test1' } as any);
      prisma.aBTestVariant.create.mockResolvedValue({} as any);
      prisma.aBTest.findFirst.mockResolvedValue(mockTest as any);

      await service.create('biz1', {
        name: 'Test',
        elementType: 'cta_text',
        controlVariant: {},
        testVariant: {},
      } as any);

      expect(prisma.aBTest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ winThreshold: 0.15 }),
        }),
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated tests with filters', async () => {
      prisma.aBTest.findMany.mockResolvedValue([mockTest] as any);
      prisma.aBTest.count.mockResolvedValue(1);

      const result = await service.findAll('biz1', { status: 'DRAFT' } as any);

      expect(result).toEqual({ data: [mockTest], total: 1 });
      expect(prisma.aBTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', status: 'DRAFT' },
          include: { variants: true },
        }),
      );
    });
  });

  describe('findActive', () => {
    it('returns only running tests', async () => {
      prisma.aBTest.findMany.mockResolvedValue([]);

      await service.findActive('biz1');

      expect(prisma.aBTest.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', status: 'RUNNING' },
        include: { variants: true },
        orderBy: { startedAt: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns test with variants', async () => {
      prisma.aBTest.findFirst.mockResolvedValue(mockTest as any);

      const result = await service.findOne('biz1', 'test1');

      expect(result).toEqual(mockTest);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.aBTest.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('start', () => {
    it('transitions DRAFT to RUNNING', async () => {
      prisma.aBTest.findFirst.mockResolvedValue(mockTest as any);
      prisma.aBTest.count.mockResolvedValue(0);
      prisma.aBTest.update.mockResolvedValue({ ...mockTest, status: 'RUNNING' } as any);

      const result = await service.start('biz1', 'test1');

      expect(prisma.aBTest.update).toHaveBeenCalledWith({
        where: { id: 'test1' },
        data: { status: 'RUNNING', startedAt: expect.any(Date) },
        include: { variants: true },
      });
    });

    it('rejects non-DRAFT tests', async () => {
      prisma.aBTest.findFirst.mockResolvedValue({ ...mockTest, status: 'RUNNING' } as any);

      await expect(service.start('biz1', 'test1')).rejects.toThrow(BadRequestException);
    });

    it('enforces max active tests on start', async () => {
      prisma.aBTest.findFirst.mockResolvedValue(mockTest as any);
      prisma.aBTest.count.mockResolvedValue(3);

      await expect(service.start('biz1', 'test1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('rejects non-RUNNING tests', async () => {
      prisma.aBTest.findFirst.mockResolvedValue({ ...mockTest, status: 'DRAFT' } as any);

      await expect(service.complete('biz1', 'test1')).rejects.toThrow(BadRequestException);
    });

    it('enforces minimum 7 days running', async () => {
      const recentStart = new Date();
      recentStart.setDate(recentStart.getDate() - 3);
      prisma.aBTest.findFirst.mockResolvedValue({
        ...mockTest,
        status: 'RUNNING',
        startedAt: recentStart,
      } as any);

      await expect(service.complete('biz1', 'test1')).rejects.toThrow(/at least 7 days/);
    });

    it('declares test variant winner when improvement exceeds threshold', async () => {
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - 10);
      prisma.aBTest.findFirst.mockResolvedValue({
        ...mockTest,
        status: 'RUNNING',
        startedAt,
      } as any);
      prisma.aBTestVariant.update.mockResolvedValue({} as any);
      prisma.aBTest.update.mockResolvedValue({ ...mockTest, status: 'COMPLETED', winnerVariantId: 'v2' } as any);

      await service.complete('biz1', 'test1');

      expect(prisma.aBTestVariant.update).toHaveBeenCalledWith({
        where: { id: 'v2' },
        data: { isWinner: true },
      });
      expect(prisma.aBTest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            winnerVariantId: 'v2',
          }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('cancels a running test', async () => {
      prisma.aBTest.findFirst.mockResolvedValue({ ...mockTest, status: 'RUNNING' } as any);
      prisma.aBTest.update.mockResolvedValue({ ...mockTest, status: 'CANCELLED' } as any);

      const result = await service.cancel('biz1', 'test1');

      expect(prisma.aBTest.update).toHaveBeenCalledWith({
        where: { id: 'test1' },
        data: { status: 'CANCELLED', endedAt: expect.any(Date) },
        include: { variants: true },
      });
    });

    it('rejects cancelling completed tests', async () => {
      prisma.aBTest.findFirst.mockResolvedValue({ ...mockTest, status: 'COMPLETED' } as any);

      await expect(service.cancel('biz1', 'test1')).rejects.toThrow(BadRequestException);
    });

    it('rejects cancelling already cancelled tests', async () => {
      prisma.aBTest.findFirst.mockResolvedValue({ ...mockTest, status: 'CANCELLED' } as any);

      await expect(service.cancel('biz1', 'test1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('tenant isolation', () => {
    it('findAll filters by businessId', async () => {
      prisma.aBTest.findMany.mockResolvedValue([]);
      prisma.aBTest.count.mockResolvedValue(0);

      await service.findAll('biz1', {} as any);

      expect(prisma.aBTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });

    it('findOne filters by businessId', async () => {
      prisma.aBTest.findFirst.mockResolvedValue(null);

      try { await service.findOne('biz1', 'test1'); } catch { /* expected */ }

      expect(prisma.aBTest.findFirst).toHaveBeenCalledWith({
        where: { id: 'test1', businessId: 'biz1' },
        include: { variants: true },
      });
    });

    it('create checks active count for correct business', async () => {
      prisma.aBTest.count.mockResolvedValue(0);
      prisma.aBTest.create.mockResolvedValue({ id: 'test1' } as any);
      prisma.aBTestVariant.create.mockResolvedValue({} as any);
      prisma.aBTest.findFirst.mockResolvedValue(mockTest as any);

      await service.create('biz1', {
        name: 'Test',
        elementType: 'cta_text',
        controlVariant: {},
        testVariant: {},
      } as any);

      expect(prisma.aBTest.count).toHaveBeenCalledWith({
        where: { businessId: 'biz1', status: 'RUNNING' },
      });
    });
  });
});

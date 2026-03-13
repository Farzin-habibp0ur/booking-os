import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BudgetTrackerService, TOOL_COST_DEFAULTS, BUDGET_RULES } from './budget-tracker.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('BudgetTrackerService', () => {
  let service: BudgetTrackerService;
  let prisma: MockPrisma;

  const mockEntry = {
    id: 'be1',
    businessId: 'biz1',
    category: 'TOOLS',
    description: 'Analytics subscription',
    amount: { toNumber: () => 25, toString: () => '25' },
    currency: 'USD',
    period: 'MONTHLY',
    month: 3,
    year: 2026,
    isRecurring: true,
    metadata: { approvalStatus: 'APPROVED', requiredApprover: 'AUTO' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new BudgetTrackerService(prisma as any);
  });

  describe('constants', () => {
    it('has 8 tool cost defaults', () => {
      expect(Object.keys(TOOL_COST_DEFAULTS)).toHaveLength(8);
    });

    it('has 8 budget rules', () => {
      expect(BUDGET_RULES).toHaveLength(8);
    });
  });

  describe('create', () => {
    it('creates a budget entry with auto-approval for <$50', async () => {
      prisma.budgetEntry.create.mockResolvedValue(mockEntry as any);

      await service.create('biz1', {
        category: 'TOOLS',
        amount: '25',
        period: 'MONTHLY',
      } as any);

      expect(prisma.budgetEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          category: 'TOOLS',
          amount: '25',
          metadata: expect.objectContaining({
            approvalStatus: 'APPROVED',
            requiredApprover: 'AUTO',
          }),
        }),
      });
    });

    it('creates a budget entry with pending approval for >$50', async () => {
      prisma.budgetEntry.create.mockResolvedValue(mockEntry as any);

      await service.create('biz1', {
        category: 'ADVERTISING',
        amount: '150',
        period: 'MONTHLY',
      } as any);

      expect(prisma.budgetEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            approvalStatus: 'PENDING',
            requiredApprover: 'AGENT_LEAD',
          }),
        }),
      });
    });

    it('requires MARKETING_MANAGER for $200-500', async () => {
      prisma.budgetEntry.create.mockResolvedValue(mockEntry as any);

      await service.create('biz1', {
        category: 'ADVERTISING',
        amount: '300',
        period: 'MONTHLY',
      } as any);

      expect(prisma.budgetEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ requiredApprover: 'MARKETING_MANAGER' }),
        }),
      });
    });

    it('requires FOUNDER for >$500', async () => {
      prisma.budgetEntry.create.mockResolvedValue(mockEntry as any);

      await service.create('biz1', {
        category: 'ADVERTISING',
        amount: '1000',
        period: 'MONTHLY',
      } as any);

      expect(prisma.budgetEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ requiredApprover: 'FOUNDER' }),
        }),
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated entries with filters', async () => {
      prisma.budgetEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.budgetEntry.count.mockResolvedValue(1);

      const result = await service.findAll('biz1', { category: 'TOOLS' } as any);

      expect(result).toEqual({ data: [mockEntry], total: 1 });
      expect(prisma.budgetEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', category: 'TOOLS' },
        }),
      );
    });

    it('filters by month and year', async () => {
      prisma.budgetEntry.findMany.mockResolvedValue([]);
      prisma.budgetEntry.count.mockResolvedValue(0);

      await service.findAll('biz1', { month: '3', year: '2026' } as any);

      expect(prisma.budgetEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ month: 3, year: 2026 }),
        }),
      );
    });
  });

  describe('getSummary', () => {
    it('returns monthly summary with totals and emergency fund', async () => {
      prisma.budgetEntry.findMany.mockResolvedValue([
        { ...mockEntry, category: 'TOOLS', amount: 100 },
        { ...mockEntry, category: 'ADVERTISING', amount: 200 },
      ] as any);

      const result = await service.getSummary('biz1', 3, 2026);

      expect(result.month).toBe(3);
      expect(result.year).toBe(2026);
      expect(result.total).toBe(300);
      expect(result.emergencyFund).toBe(30); // 10%
      expect(result.effectiveBudget).toBe(270);
      expect(result.byCategory).toEqual({ TOOLS: 100, ADVERTISING: 200 });
    });

    it('includes tool cost defaults in response', async () => {
      prisma.budgetEntry.findMany.mockResolvedValue([]);

      const result = await service.getSummary('biz1');

      expect(result.toolCostDefaults).toEqual(TOOL_COST_DEFAULTS);
    });
  });

  describe('getRoi', () => {
    it('returns ROI data with spend breakdown', async () => {
      prisma.budgetEntry.findMany.mockResolvedValue([
        { ...mockEntry, category: 'TOOLS', amount: 50 },
        { ...mockEntry, category: 'ADVERTISING', amount: 200 },
      ] as any);

      const result = await service.getRoi('biz1');

      expect(result.totalSpend).toBe(250);
      expect(result.byCategory).toEqual({ TOOLS: 50, ADVERTISING: 200 });
      expect(result.budgetRules).toHaveLength(8);
      expect(result.approvalThresholds).toHaveLength(4);
    });
  });

  describe('approve', () => {
    it('approves a pending entry', async () => {
      const pendingEntry = {
        ...mockEntry,
        amount: 100,
        metadata: { approvalStatus: 'PENDING', requiredApprover: 'AGENT_LEAD' },
      };
      prisma.budgetEntry.findFirst.mockResolvedValue(pendingEntry as any);
      prisma.budgetEntry.update.mockResolvedValue({
        ...pendingEntry,
        metadata: { approvalStatus: 'APPROVED' },
      } as any);

      await service.approve('biz1', 'be1', 'AGENT_LEAD');

      expect(prisma.budgetEntry.update).toHaveBeenCalledWith({
        where: { id: 'be1' },
        data: {
          metadata: expect.objectContaining({ approvalStatus: 'APPROVED' }),
        },
      });
    });

    it('throws NotFoundException for missing entry', async () => {
      prisma.budgetEntry.findFirst.mockResolvedValue(null);

      await expect(service.approve('biz1', 'missing', 'FOUNDER')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when already approved', async () => {
      prisma.budgetEntry.findFirst.mockResolvedValue(mockEntry as any);

      await expect(service.approve('biz1', 'be1', 'FOUNDER')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects insufficient approver role', async () => {
      const pendingEntry = {
        ...mockEntry,
        amount: 300,
        metadata: { approvalStatus: 'PENDING', requiredApprover: 'MARKETING_MANAGER' },
      };
      prisma.budgetEntry.findFirst.mockResolvedValue(pendingEntry as any);

      await expect(service.approve('biz1', 'be1', 'AGENT_LEAD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows higher role to approve', async () => {
      const pendingEntry = {
        ...mockEntry,
        amount: 100,
        metadata: { approvalStatus: 'PENDING', requiredApprover: 'AGENT_LEAD' },
      };
      prisma.budgetEntry.findFirst.mockResolvedValue(pendingEntry as any);
      prisma.budgetEntry.update.mockResolvedValue(pendingEntry as any);

      await service.approve('biz1', 'be1', 'FOUNDER');

      expect(prisma.budgetEntry.update).toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('findAll filters by businessId', async () => {
      prisma.budgetEntry.findMany.mockResolvedValue([]);
      prisma.budgetEntry.count.mockResolvedValue(0);

      await service.findAll('biz1', {} as any);

      expect(prisma.budgetEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });

    it('approve scopes to businessId', async () => {
      prisma.budgetEntry.findFirst.mockResolvedValue(null);

      try {
        await service.approve('biz1', 'be1', 'FOUNDER');
      } catch { /* expected */ }

      expect(prisma.budgetEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'be1', businessId: 'biz1' },
      });
    });
  });
});

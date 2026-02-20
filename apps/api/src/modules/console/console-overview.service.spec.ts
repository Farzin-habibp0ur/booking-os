import { Test } from '@nestjs/testing';
import { ConsoleOverviewService } from './console-overview.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleOverviewService', () => {
  let service: ConsoleOverviewService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ConsoleOverviewService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ConsoleOverviewService);
  });

  // Helper to set up default mocks for getOverview dependencies
  function setupOverviewMocks() {
    prisma.business.count.mockResolvedValue(12);
    prisma.staff.count.mockResolvedValue(30);
    prisma.customer.count.mockResolvedValue(500);
    prisma.booking.count
      .mockResolvedValueOnce(2000)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(85)
      .mockResolvedValueOnce(350);
    prisma.conversation.count.mockResolvedValue(200);
    prisma.subscription.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.agentRun.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(2);
    prisma.supportCase.count.mockResolvedValue(3);
    prisma.platformAuditLog.findMany.mockResolvedValue([
      {
        id: 'log1',
        actorEmail: 'admin@test.com',
        action: 'BUSINESS_LOOKUP',
        targetType: 'BUSINESS',
        targetId: 'biz1',
        createdAt: new Date(),
      },
    ] as any);
    prisma.viewAsSession.count.mockResolvedValue(1);
    // Attention items mocks
    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.supportCase.findMany.mockResolvedValue([]);
    prisma.viewAsSession.findMany.mockResolvedValue([]);
    prisma.business.findMany.mockResolvedValue([]);
    // At-risk mocks — need additional agentRun.count for attention + agentRun counts for at-risk
    prisma.agentRun.count.mockResolvedValue(0);
    prisma.supportCase.count.mockResolvedValue(0);
    prisma.agentRun.findMany.mockResolvedValue([]);
  }

  describe('getOverview', () => {
    it('returns overview data with all sections populated', async () => {
      setupOverviewMocks();

      const result = await service.getOverview();

      expect(result.businesses).toEqual({
        total: 12,
        withActiveSubscription: 8,
        trial: 2,
        pastDue: 1,
        canceled: 1,
      });
      expect(result.bookings).toEqual({
        total: 2000,
        today: 15,
        last7d: 85,
        last30d: 350,
      });
      expect(result.platform).toEqual({
        totalStaff: 30,
        totalCustomers: 500,
        totalConversations: 200,
        totalAgentRuns: 100,
        agentRuns7d: 40,
        failedAgentRuns7d: 2,
      });
      expect(result).toHaveProperty('attentionItems');
      expect(result).toHaveProperty('accountsAtRisk');
    });

    it('returns zero counts when no data exists', async () => {
      prisma.business.count.mockResolvedValue(0);
      prisma.staff.count.mockResolvedValue(0);
      prisma.customer.count.mockResolvedValue(0);
      prisma.booking.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(0);
      prisma.subscription.count.mockResolvedValue(0);
      prisma.agentRun.count.mockResolvedValue(0);
      prisma.supportCase.count.mockResolvedValue(0);
      prisma.platformAuditLog.findMany.mockResolvedValue([]);
      prisma.viewAsSession.count.mockResolvedValue(0);
      prisma.subscription.findMany.mockResolvedValue([]);
      prisma.supportCase.findMany.mockResolvedValue([]);
      prisma.viewAsSession.findMany.mockResolvedValue([]);
      prisma.business.findMany.mockResolvedValue([]);
      prisma.agentRun.findMany.mockResolvedValue([]);

      const result = await service.getOverview();

      expect(result.businesses.total).toBe(0);
      expect(result.bookings.total).toBe(0);
      expect(result.attentionItems).toEqual([]);
      expect(result.accountsAtRisk).toEqual([]);
    });
  });

  describe('getAttentionItems', () => {
    beforeEach(() => {
      // Default: everything empty/healthy
      prisma.subscription.findMany.mockResolvedValue([]);
      prisma.supportCase.findMany.mockResolvedValue([]);
      prisma.viewAsSession.findMany.mockResolvedValue([]);
      prisma.agentRun.count.mockResolvedValue(0);
      prisma.business.findMany.mockResolvedValue([]);
      prisma.supportCase.count.mockResolvedValue(0);
    });

    it('returns empty array when everything is healthy', async () => {
      const result = await service.getAttentionItems();
      expect(result).toEqual([]);
    });

    it('generates critical item for past-due subscriptions', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub1', businessId: 'biz1', business: { name: 'Test Clinic' } },
      ] as any);

      const result = await service.getAttentionItems();

      expect(result.length).toBeGreaterThanOrEqual(1);
      const item = result.find((r) => r.id === 'past-due-subs');
      expect(item).toBeDefined();
      expect(item!.severity).toBe('critical');
      expect(item!.actionHref).toBe('/console/billing');
    });

    it('generates warning item for urgent support cases', async () => {
      prisma.supportCase.findMany.mockResolvedValue([
        { id: 'case1', subject: 'System down', businessName: 'Test Biz' },
      ] as any);

      const result = await service.getAttentionItems();

      const item = result.find((r) => r.id === 'urgent-support');
      expect(item).toBeDefined();
      expect(item!.severity).toBe('warning');
      expect(item!.actionHref).toBe('/console/support');
    });

    it('generates warning for active view-as sessions', async () => {
      prisma.viewAsSession.findMany.mockResolvedValue([
        { id: 'vas1', superAdminId: 'admin1', startedAt: new Date() },
      ] as any);

      const result = await service.getAttentionItems();

      const item = result.find((r) => r.id === 'active-view-as');
      expect(item).toBeDefined();
      expect(item!.severity).toBe('warning');
      expect(item!.actionHref).toBe('/console/audit');
    });

    it('generates warning for high agent failure rate (>20%)', async () => {
      prisma.agentRun.count
        .mockResolvedValueOnce(100) // total 7d
        .mockResolvedValueOnce(25); // failed 7d

      const result = await service.getAttentionItems();

      const item = result.find((r) => r.id === 'agent-failure-rate');
      expect(item).toBeDefined();
      expect(item!.severity).toBe('warning');
      expect(item!.title).toContain('25%');
    });

    it('does NOT generate warning when failure rate <= 20%', async () => {
      prisma.agentRun.count
        .mockResolvedValueOnce(100) // total 7d
        .mockResolvedValueOnce(10); // failed 7d = 10%

      const result = await service.getAttentionItems();

      const item = result.find((r) => r.id === 'agent-failure-rate');
      expect(item).toBeUndefined();
    });

    it('generates info for dormant businesses', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz1', name: 'Idle Clinic' },
      ] as any);

      const result = await service.getAttentionItems();

      const item = result.find((r) => r.id === 'dormant-businesses');
      expect(item).toBeDefined();
      expect(item!.severity).toBe('info');
      expect(item!.actionHref).toBe('/console/businesses');
    });

    it('generates info for open support cases', async () => {
      prisma.supportCase.count.mockResolvedValue(5);

      const result = await service.getAttentionItems();

      const item = result.find((r) => r.id === 'open-support-cases');
      expect(item).toBeDefined();
      expect(item!.severity).toBe('info');
    });

    it('sorts items by severity: critical > warning > info', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub1', businessId: 'biz1', business: { name: 'Test' } },
      ] as any);
      prisma.supportCase.findMany.mockResolvedValue([
        { id: 'case1', subject: 'Help', businessName: 'Test' },
      ] as any);
      prisma.supportCase.count.mockResolvedValue(2);

      const result = await service.getAttentionItems();

      const severities = result.map((r) => r.severity);
      const criticalIdx = severities.indexOf('critical');
      const warningIdx = severities.indexOf('warning');
      const infoIdx = severities.indexOf('info');

      if (criticalIdx >= 0 && warningIdx >= 0) {
        expect(criticalIdx).toBeLessThan(warningIdx);
      }
      if (warningIdx >= 0 && infoIdx >= 0) {
        expect(warningIdx).toBeLessThan(infoIdx);
      }
    });
  });

  describe('getAccountsAtRisk', () => {
    beforeEach(() => {
      prisma.supportCase.findMany.mockResolvedValue([]);
      prisma.agentRun.findMany.mockResolvedValue([]);
    });

    it('returns empty when all businesses are healthy', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Healthy Biz',
          subscription: { status: 'active', plan: 'pro' },
          bookings: [{ createdAt: new Date() }],
        },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result).toEqual([]);
    });

    it('scores canceled businesses highest for billing signal', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Canceled Biz',
          subscription: { status: 'canceled', plan: 'basic' },
          bookings: [{ createdAt: new Date() }],
        },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result).toHaveLength(1);
      expect(result[0].businessName).toBe('Canceled Biz');
      expect(result[0].topSignal).toBe('Billing');
      // 100*0.35 = 35 (billing) + 0 (activity) + 0 (support) + 0 (ai) = 35
      expect(result[0].riskScore).toBe(35);
    });

    it('scores inactive businesses for activity signal', async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Inactive Biz',
          subscription: { status: 'past_due', plan: 'basic' },
          bookings: [{ createdAt: sixtyDaysAgo }],
        },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result).toHaveLength(1);
      // billing: 70*0.35=24.5, activity: 100*0.30=30 → 54.5 → 55
      expect(result[0].riskScore).toBe(55);
      expect(result[0].topSignal).toBe('Inactivity');
    });

    it('filters out businesses with score <= 30', async () => {
      // A business with active sub, recent booking, no issues = score 0
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Good Biz',
          subscription: { status: 'active', plan: 'pro' },
          bookings: [{ createdAt: new Date() }],
        },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result).toEqual([]);
    });

    it('includes support issues in risk scoring', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Troubled Biz',
          subscription: { status: 'past_due', plan: 'basic' },
          bookings: [{ createdAt: new Date() }],
        },
      ] as any);
      prisma.supportCase.findMany.mockResolvedValue([
        { businessId: 'biz1', priority: 'urgent' },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result).toHaveLength(1);
      // billing: 70*0.35=24.5, support: 100*0.20=20 → 44.5 → 45
      expect(result[0].riskScore).toBe(45);
    });

    it('includes AI failures in risk scoring', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'AI Trouble Biz',
          subscription: { status: 'past_due', plan: 'pro' },
          bookings: [{ createdAt: new Date() }],
        },
      ] as any);
      prisma.agentRun.findMany.mockResolvedValue([
        { businessId: 'biz1', status: 'FAILED' },
        { businessId: 'biz1', status: 'FAILED' },
        { businessId: 'biz1', status: 'COMPLETED' },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result).toHaveLength(1);
      // billing: 70*0.35=24.5, ai: 100*0.15=15 → 39.5 → 40
      expect(result[0].riskScore).toBe(40);
    });

    it('sorts results by risk score descending', async () => {
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Medium Risk',
          subscription: { status: 'past_due', plan: 'basic' },
          bookings: [{ createdAt: twentyDaysAgo }],
        },
        {
          id: 'biz2',
          name: 'High Risk',
          subscription: { status: 'canceled', plan: 'basic' },
          bookings: [],
        },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result.length).toBe(2);
      expect(result[0].businessName).toBe('High Risk');
      expect(result[0].riskScore).toBeGreaterThan(result[1].riskScore);
    });

    it('respects limit parameter', async () => {
      const businesses = Array.from({ length: 15 }, (_, i) => ({
        id: `biz${i}`,
        name: `Biz ${i}`,
        subscription: { status: 'canceled', plan: 'basic' },
        bookings: [],
      }));
      prisma.business.findMany.mockResolvedValue(businesses as any);

      const result = await service.getAccountsAtRisk(5);

      expect(result).toHaveLength(5);
    });

    it('computes all 4 signals together', async () => {
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Max Risk',
          subscription: { status: 'canceled', plan: 'basic' },
          bookings: [{ createdAt: oldDate }],
        },
      ] as any);
      prisma.supportCase.findMany.mockResolvedValue([
        { businessId: 'biz1', priority: 'urgent' },
      ] as any);
      prisma.agentRun.findMany.mockResolvedValue([
        { businessId: 'biz1', status: 'FAILED' },
      ] as any);

      const result = await service.getAccountsAtRisk();

      expect(result).toHaveLength(1);
      // billing: 100*0.35=35, activity: 100*0.30=30, support: 100*0.20=20, ai: 100*0.15=15 → 100
      expect(result[0].riskScore).toBe(100);
    });
  });
});

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

  it('returns overview data with all sections populated', async () => {
    prisma.business.count.mockResolvedValue(12);
    prisma.staff.count.mockResolvedValue(30);
    prisma.customer.count.mockResolvedValue(500);
    prisma.booking.count
      .mockResolvedValueOnce(2000) // total
      .mockResolvedValueOnce(15) // today
      .mockResolvedValueOnce(85) // 7d
      .mockResolvedValueOnce(350); // 30d
    prisma.conversation.count.mockResolvedValue(200);
    prisma.subscription.count
      .mockResolvedValueOnce(8) // active
      .mockResolvedValueOnce(2) // trialing
      .mockResolvedValueOnce(1) // past_due
      .mockResolvedValueOnce(1); // canceled
    prisma.agentRun.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(40) // 7d
      .mockResolvedValueOnce(2); // failed 7d
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
    expect(result.support).toEqual({ openCases: 3 });
    expect(result.security).toEqual({ activeViewAsSessions: 1 });
    expect(result.recentAuditLogs).toHaveLength(1);
    expect(result.recentAuditLogs[0].action).toBe('BUSINESS_LOOKUP');
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

    const result = await service.getOverview();

    expect(result.businesses).toEqual({
      total: 0,
      withActiveSubscription: 0,
      trial: 0,
      pastDue: 0,
      canceled: 0,
    });
    expect(result.bookings).toEqual({
      total: 0,
      today: 0,
      last7d: 0,
      last30d: 0,
    });
    expect(result.platform).toEqual({
      totalStaff: 0,
      totalCustomers: 0,
      totalConversations: 0,
      totalAgentRuns: 0,
      agentRuns7d: 0,
      failedAgentRuns7d: 0,
    });
    expect(result.support).toEqual({ openCases: 0 });
    expect(result.security).toEqual({ activeViewAsSessions: 0 });
    expect(result.recentAuditLogs).toEqual([]);
  });
});

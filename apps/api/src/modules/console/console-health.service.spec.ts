import { Test } from '@nestjs/testing';
import { ConsoleHealthService } from './console-health.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleHealthService', () => {
  let service: ConsoleHealthService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ConsoleHealthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ConsoleHealthService);
  });

  it('returns healthy status when all checks pass', async () => {
    // Database check
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    // Business activity: 10 total, 8 active => 80% ratio => healthy
    prisma.business.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(8); // active in 7d

    // Agent health: 50 total runs, 1 failed => 2% fail rate => healthy
    prisma.agentRun.count
      .mockResolvedValueOnce(50) // total 7d
      .mockResolvedValueOnce(1); // failed 7d

    // Calendar sync: 20 connections, 1 error => 5% error rate => healthy
    prisma.calendarConnection.count
      .mockResolvedValueOnce(20) // total sync enabled
      .mockResolvedValueOnce(1); // with errors

    // Message delivery: 100 outbound, 1 failed => 1% fail rate => healthy
    prisma.message.count
      .mockResolvedValueOnce(100) // total outbound
      .mockResolvedValueOnce(1); // failed

    // Business health distribution
    prisma.business.findMany.mockResolvedValue([
      {
        id: 'biz1',
        subscription: { status: 'active' },
        bookings: [{ createdAt: new Date() }],
      },
    ] as any);

    const result = await service.getHealth();

    expect(result.status).toBe('healthy');
    expect(result.checks).toHaveLength(5);
    expect(result.checks.every((c) => c.status === 'healthy')).toBe(true);
    expect(result.businessHealth).toBeDefined();
    expect(result.businessHealth.green).toBe(1);
    expect(result.checkedAt).toBeDefined();
  });

  it('returns degraded when some checks have issues', async () => {
    // Database check — healthy
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    // Business activity: 10 total, 3 active => 30% ratio => degraded
    prisma.business.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3); // active in 7d

    // Agent health: 50 total runs, 8 failed => 16% fail rate => degraded
    prisma.agentRun.count
      .mockResolvedValueOnce(50) // total 7d
      .mockResolvedValueOnce(8); // failed 7d

    // Calendar sync: 10 connections, 3 with errors => 30% error rate => degraded
    prisma.calendarConnection.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);

    // Message delivery: 100 outbound, 1 failed => 1% => healthy
    prisma.message.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(1);

    // Business health distribution
    prisma.business.findMany.mockResolvedValue([
      {
        id: 'biz1',
        subscription: { status: 'past_due' },
        bookings: [{ createdAt: new Date() }],
      },
    ] as any);

    const result = await service.getHealth();

    expect(result.status).toBe('degraded');
    const degradedChecks = result.checks.filter((c) => c.status === 'degraded');
    expect(degradedChecks.length).toBeGreaterThan(0);
  });

  it('database check returns latency', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    // Provide remaining mocks so getHealth() completes
    prisma.business.count.mockResolvedValue(0);
    prisma.agentRun.count.mockResolvedValue(0);
    prisma.calendarConnection.count.mockResolvedValue(0);
    prisma.message.count.mockResolvedValue(0);
    prisma.business.findMany.mockResolvedValue([]);

    const result = await service.getHealth();

    const dbCheck = result.checks.find((c) => c.name === 'Database');
    expect(dbCheck).toBeDefined();
    expect(dbCheck!.status).toBe('healthy');
    expect(dbCheck!.latencyMs).toBeDefined();
    expect(typeof dbCheck!.latencyMs).toBe('number');
    expect(dbCheck!.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
